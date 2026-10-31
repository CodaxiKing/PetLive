import { Linking, NativeModules, Platform } from 'react-native'
import type { PurchasesPackage } from 'react-native-purchases'

/**
 * Assinatura do Premium pela loja de apps (Google Play e App Store), via
 * RevenueCat. É o único jeito de assinar: a Apple e o Google exigem a compra
 * pela loja para assinatura digital. O servidor fica sabendo pelo webhook
 * (revenuecat-webhook) e libera o Premium da conta.
 *
 * O SDK é nativo: num app instalado antes dele (atualização pelo ar) ou sem as
 * chaves configuradas, a tela mostra que a assinatura vem com a versão da loja,
 * em vez de fechar o app.
 */
const CHAVE = Platform.select({
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
})
/** Direito (entitlement) configurado no RevenueCat para o Premium. */
export const DIREITO_PREMIUM = 'premium'

type Purchases = typeof import('react-native-purchases').default
let sdk: Purchases | null = null
let usuarioConfigurado: string | null = null

function carregar(): Purchases | null {
  if (sdk) return sdk
  if (!CHAVE || !NativeModules.RNPurchases) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sdk = (require('react-native-purchases') as typeof import('react-native-purchases')).default
  } catch {
    sdk = null
  }
  return sdk
}

/** A loja está pronta para vender neste aparelho? */
export function lojaDisponivel(): boolean {
  return carregar() !== null
}

/** Liga o SDK com a conta do PetLive (o webhook usa este id para achar o tutor). */
async function preparar(tutorId: string): Promise<Purchases> {
  const p = carregar()
  if (!p) throw new Error('A assinatura chega com a próxima versão do app na loja.')
  if (!usuarioConfigurado) {
    p.configure({ apiKey: CHAVE as string, appUserID: tutorId })
    usuarioConfigurado = tutorId
  } else if (usuarioConfigurado !== tutorId) {
    await p.logIn(tutorId)
    usuarioConfigurado = tutorId
  }
  return p
}

export type OfertaLoja = { pacote: PurchasesPackage; preco: string; temTeste: boolean }

/** Plano mensal da loja, com o preço já na moeda e no formato da loja. */
export async function ofertaDaLoja(tutorId: string): Promise<OfertaLoja | null> {
  const p = await preparar(tutorId)
  const ofertas = await p.getOfferings()
  const pacote = ofertas.current?.monthly ?? ofertas.current?.availablePackages[0]
  if (!pacote) return null
  const produto = pacote.product
  const teste = produto.introPrice?.price === 0 || Boolean(produto.defaultOption?.freePhase)
  return { pacote, preco: produto.priceString, temTeste: teste }
}

/** Abre a compra da loja. "cancelado" quando o tutor fecha a tela da loja. */
export async function comprarNaLoja(tutorId: string, oferta: OfertaLoja): Promise<'premium' | 'cancelado' | 'pendente'> {
  const p = await preparar(tutorId)
  try {
    const { customerInfo } = await p.purchasePackage(oferta.pacote)
    return customerInfo.entitlements.active[DIREITO_PREMIUM] ? 'premium' : 'pendente'
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return 'cancelado'
    throw e
  }
}

/** Restaurar compra (trocou de aparelho ou reinstalou). A Apple exige este botão. */
export async function restaurarNaLoja(tutorId: string): Promise<boolean> {
  const p = await preparar(tutorId)
  const info = await p.restorePurchases()
  return Boolean(info.entitlements.active[DIREITO_PREMIUM])
}

/** Cancelar e trocar de plano ficam na loja: abre a página de assinaturas dela. */
export function gerenciarNaLoja(provedor: 'google_play' | 'app_store' = Platform.OS === 'ios' ? 'app_store' : 'google_play'): void {
  const url = provedor === 'app_store' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions'
  Linking.openURL(url).catch(() => undefined)
}

/** "Google Play" ou "App Store", para os textos da tela. */
export const NOME_LOJA = Platform.OS === 'ios' ? 'App Store' : 'Google Play'
