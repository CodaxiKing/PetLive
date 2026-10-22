import { Platform } from 'react-native'
import {
  deepLinkToSubscriptions,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  isEligibleForIntroOfferIOS,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
  type ProductSubscription,
  type Purchase,
} from 'expo-iap'
import { supabase } from '../lib/supabase'
import { recarregarPlano } from '../lib/plano'
import {
  PRODUTOS,
  diasDoPeriodo,
  diasIso,
  resultadoDoErro,
  type PlanoLoja,
  type ResultadoCompra,
} from './planos'

/**
 * Compra do Premium pela loja de apps (BUSINESS.md 5.13), com o expo-iap: a
 * folha de pagamento é a nativa da Apple ou do Google, e o app nunca libera o
 * Premium sozinho. Toda compra vai para a Edge Function validar-compra-loja,
 * que consulta a loja; só depois a transação é finalizada.
 */

const SKUS = [PRODUTOS.mensal, PRODUTOS.anual]
const PACOTE_ANDROID = 'app.petlive.tutor'

let conexao: Promise<unknown> | null = null
let usuarioAtual: string | null = null
let esperando: ((r: ResultadoCompra) => void) | null = null

function ehNosso(p: Purchase): boolean {
  return (SKUS as string[]).includes(p.productId)
}

/** Comprovante que o servidor aceita: a transação na Apple, o token no Google. */
function comprovante(p: Purchase) {
  return Platform.OS === 'ios'
    ? { loja: 'app_store', transacao: p.id }
    : { loja: 'google_play', token: p.purchaseToken ?? '' }
}

/** Manda as compras para o servidor confirmar com a loja. Devolve o plano. */
async function confirmarNoServidor(compras: Purchase[]): Promise<'gratis' | 'premium'> {
  const { data, error } = await supabase.functions.invoke<{ plano: 'gratis' | 'premium' }>('validar-compra-loja', {
    body: { compras: compras.map(comprovante) },
  })
  if (error) {
    // A função devolve a mensagem em português (ex.: assinatura de outra conta).
    const corpo = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(corpo?.mensagem ?? 'Não foi possível confirmar a assinatura agora.')
  }
  return data?.plano ?? 'gratis'
}

async function aoComprar(compra: Purchase) {
  if (!ehNosso(compra)) return
  const avisar = esperando
  if (compra.purchaseState === 'pending') {
    esperando = null
    avisar?.({ tipo: 'pendente' })
    return
  }
  try {
    const plano = await confirmarNoServidor([compra])
    // Só finaliza depois do servidor: se falhar, a loja entrega de novo na próxima abertura.
    await finishTransaction({ purchase: compra, isConsumable: false })
    if (usuarioAtual) await recarregarPlano(usuarioAtual)
    esperando = null
    avisar?.({ tipo: 'ok', plano })
  } catch (e) {
    esperando = null
    avisar?.({ tipo: 'erro', mensagem: e instanceof Error ? e.message : 'Não foi possível confirmar a assinatura agora.' })
  }
}

/**
 * Liga a loja e os ouvintes da compra. Também recebe as compras que ficaram
 * sem finalizar (app fechado no meio, aprovação dos pais, renovação no iOS).
 */
export function iniciarLoja(userId: string): Promise<unknown> {
  usuarioAtual = userId
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return Promise.resolve()
  if (!conexao) {
    conexao = initConnection().then((r) => {
      purchaseUpdatedListener((compra) => {
        void aoComprar(compra)
      })
      purchaseErrorListener((erro) => {
        const avisar = esperando
        esperando = null
        avisar?.(resultadoDoErro(erro))
      })
      return r
    })
    conexao.catch(() => {
      conexao = null
    })
  }
  return conexao
}

/** Primeira fase grátis de uma oferta da Google Play (em dias). */
function testeAndroid(fases: { priceAmountMicros: string; billingPeriod: string; billingCycleCount: number }[]): number {
  const gratis = fases.find((f) => Number(f.priceAmountMicros) === 0)
  return gratis ? diasIso(gratis.billingPeriod) * Math.max(gratis.billingCycleCount, 1) : 0
}

async function paraPlano(p: ProductSubscription): Promise<PlanoLoja> {
  const periodo = p.id === PRODUTOS.anual ? 'anual' : 'mensal'
  if (p.platform === 'android') {
    const ofertas = (p.subscriptionOffers ?? []).map((o) => {
      const fases = o.pricingPhasesAndroid?.pricingPhaseList ?? []
      return { token: o.offerTokenAndroid ?? undefined, fases, dias: testeAndroid(fases) }
    })
    // A Google só devolve o teste para quem ainda pode usá-lo.
    const comTeste = ofertas.find((o) => o.dias > 0)
    const semTeste = ofertas.find((o) => o.dias === 0) ?? ofertas[0]
    const recorrente = semTeste?.fases[semTeste.fases.length - 1]
    return {
      periodo,
      produto: p.id,
      preco: recorrente?.formattedPrice ?? p.displayPrice,
      valor: recorrente ? Number(recorrente.priceAmountMicros) / 1e6 : (p.price ?? null),
      diasTeste: comTeste?.dias ?? 0,
      ofertaAndroid: (comTeste ?? semTeste)?.token,
      ofertaAndroidSemTeste: semTeste?.token,
    }
  }
  const intro = (p.subscriptionOffers ?? []).find((o) => o.type === 'introductory' && o.paymentMode === 'free-trial')
  let dias = intro ? diasDoPeriodo(intro.period, intro.periodCount ?? 1) : 0
  // A Apple diz se este Apple ID ainda pode usar o teste do grupo.
  if (dias && p.platform === 'ios' && p.subscriptionGroupIdIOS) {
    const elegivel = await isEligibleForIntroOfferIOS(p.subscriptionGroupIdIOS).catch(() => true)
    if (!elegivel) dias = 0
  }
  return { periodo, produto: p.id, preco: p.displayPrice, valor: p.price ?? null, diasTeste: dias }
}

/** Planos com o preço que a loja devolveu. Sem resposta da loja, lança erro. */
export async function buscarPlanos(userId: string): Promise<PlanoLoja[]> {
  await iniciarLoja(userId)
  const produtos = ((await fetchProducts({ skus: SKUS, type: 'subs' })) ?? []) as ProductSubscription[]
  const planos = await Promise.all(produtos.filter((p) => (SKUS as string[]).includes(p.id)).map(paraPlano))
  if (!planos.length) throw new Error('A loja não devolveu os planos.')
  return planos.sort((a, b) => (a.periodo === 'mensal' ? -1 : 1) - (b.periodo === 'mensal' ? -1 : 1))
}

/** Abre a folha de pagamento nativa. O resultado vem pelos ouvintes. */
export async function comprar(plano: PlanoLoja, userId: string, comTeste: boolean): Promise<ResultadoCompra> {
  await iniciarLoja(userId)
  if (esperando) return { tipo: 'erro', mensagem: 'Já existe uma compra em andamento.' }
  const resultado = new Promise<ResultadoCompra>((resolve) => {
    esperando = resolve
  })
  const oferta = comTeste ? plano.ofertaAndroid : plano.ofertaAndroidSemTeste
  try {
    await requestPurchase({
      type: 'subs',
      request: {
        // A conta do PetLive vai junto: o servidor recusa o comprovante em outra conta.
        apple: { sku: plano.produto, appAccountToken: userId },
        google: {
          skus: [plano.produto],
          obfuscatedAccountId: userId,
          subscriptionOffers: oferta ? [{ sku: plano.produto, offerToken: oferta }] : undefined,
        },
      },
    })
  } catch (e) {
    esperando = null
    return resultadoDoErro(e as { code?: string })
  }
  return resultado
}

/** Restaurar compras (exigido pela Apple): reenvia ao servidor as assinaturas desta conta da loja. */
export async function restaurar(userId: string): Promise<'gratis' | 'premium' | 'nada'> {
  await iniciarLoja(userId)
  await restorePurchases().catch(() => undefined)
  const compras = ((await getAvailablePurchases()) ?? []).filter(ehNosso)
  if (!compras.length) return 'nada'
  const plano = await confirmarNoServidor(compras)
  await Promise.all(compras.map((c) => finishTransaction({ purchase: c, isConsumable: false }).catch(() => undefined)))
  await recarregarPlano(userId)
  return plano
}

/** Cancelar e mudar de plano acontecem na tela de assinaturas da própria loja. */
export async function abrirAssinaturasDaLoja(produto?: string): Promise<void> {
  await deepLinkToSubscriptions({ skuAndroid: produto ?? PRODUTOS.mensal, packageNameAndroid: PACOTE_ANDROID })
}
