/**
 * Regras puras da Tela Premium (BUSINESS.md 5.13 e 10): os planos que a loja
 * devolveu, o teste grátis e os textos. Nenhum preço fica fixo no app: tudo
 * vem da App Store ou da Google Play, na moeda do usuário.
 */

/** Ids dos produtos nas duas lojas (iguais aos de supabase/functions/_shared/assinatura-estado.ts). */
export const PRODUTOS = { mensal: 'petlive_premium_mensal', anual: 'petlive_premium_anual' } as const

export type Periodo = keyof typeof PRODUTOS

export type PlanoLoja = {
  periodo: Periodo
  produto: string
  /** Preço formatado pela loja (ex.: "R$ 19,90"). */
  preco: string
  /** Valor numérico, só para comparar mensal e anual. */
  valor: number | null
  /** Dias de teste grátis oferecidos pela loja (0 = sem oferta). */
  diasTeste: number
  /** Google Play: oferta escolhida na compra (com ou sem teste). */
  ofertaAndroid?: string
  ofertaAndroidSemTeste?: string
}

/** Benefícios do Premium (coluna Premium da tabela da seção 10 do BUSINESS.md). */
export const BENEFICIOS = [
  'Vários pets, até 20 ativos, todos editáveis',
  'Ler o cartão de vacina por foto',
  'Anexos de exames e carteira em PDF',
  'Acesso da família',
  'Vários acessos de cuidador temporário',
  'Linha do tempo com mais fotos e em PDF',
  'Passeios com GPS e despesas com o histórico completo',
  'Exportar despesas em CSV ou PDF',
  'Todos os temas do cartão do pet',
  'Checklist de viagem e resumo do pet sênior em PDF',
  'QR da coleira completo, com o que mostrar escolhido',
] as const

/** Por que a Tela Premium abriu (convites dos recursos bloqueados). */
export type MotivoConvite = 'limite_pets' | 'somente_leitura' | 'cartao_vacina' | 'pdf_linha_do_tempo'

export const TEXTO_MOTIVO: Record<MotivoConvite, { titulo: string; texto: string }> = {
  limite_pets: {
    titulo: 'Mais pets com o Premium',
    texto: 'No plano Grátis você tem 1 pet ativo, com todas as funções. Pets em memória não contam. Com o Premium, cadastre vários pets e edite todos.',
  },
  somente_leitura: {
    titulo: 'Este pet está só para consulta',
    texto: 'No plano Grátis, só o pet ativo há mais tempo fica editável. Os outros continuam no app, com perfil, vacinas, histórico e carteirinha, só para consulta.',
  },
  cartao_vacina: {
    titulo: 'Leia o cartão de vacina por foto',
    texto: 'Tire uma foto do cartão e o PetLive lê o nome, a data e a próxima dose. Você revisa tudo antes de salvar.',
  },
  pdf_linha_do_tempo: {
    titulo: 'A linha do tempo em PDF',
    texto: 'Gere o PDF com os marcos e as fotos do seu pet para guardar ou compartilhar.',
  },
}

export function ehMotivo(valor: unknown): valor is MotivoConvite {
  return typeof valor === 'string' && valor in TEXTO_MOTIVO
}

/** Período do teste da loja em dias (ex.: { unit: 'week', value: 1 } = 7). */
export function diasDoPeriodo(periodo: { unit?: string | null; value?: number | null } | null | undefined, vezes = 1): number {
  if (!periodo?.value) return 0
  const dias = { day: 1, week: 7, month: 30, year: 365 }[periodo.unit ?? ''] ?? 0
  return dias * periodo.value * Math.max(vezes, 1)
}

/** Período ISO 8601 da Google Play (P7D, P1W, P1M) em dias. */
export function diasIso(periodo: string | null | undefined): number {
  const m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(periodo ?? '')
  if (!m) return 0
  const [, a, me, s, d] = m.map((v) => Number(v ?? 0))
  return a * 365 + me * 30 + s * 7 + d
}

/** Mostra o teste grátis só para quem nunca assinou e quando a loja oferece. */
export function mostraTeste(plano: PlanoLoja | null, jaAssinou: boolean): boolean {
  return Boolean(plano && !jaAssinou && plano.diasTeste > 0)
}

/** Data da primeira cobrança depois do teste. */
export function primeiraCobranca(diasTeste: number, hoje = new Date()): Date {
  const data = new Date(hoje)
  data.setDate(data.getDate() + diasTeste)
  return data
}

export function dataCurta(data: Date | string): string {
  return new Date(data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Quanto o anual economiza frente a 12 mensalidades (em %), se a loja deu os dois valores. */
export function economiaAnual(mensal: PlanoLoja | undefined, anual: PlanoLoja | undefined): number | null {
  if (!mensal?.valor || !anual?.valor) return null
  const pct = Math.round((1 - anual.valor / (mensal.valor * 12)) * 100)
  return pct > 0 ? pct : null
}

export type ResultadoCompra =
  | { tipo: 'ok'; plano: 'gratis' | 'premium' }
  | { tipo: 'cancelada' }
  | { tipo: 'pendente' }
  | { tipo: 'erro'; mensagem: string }

/** Erro da loja (expo-iap) para o que a tela mostra. Desistir da folha não é erro. */
export function resultadoDoErro(erro: { code?: string; message?: string } | null | undefined): ResultadoCompra {
  switch (erro?.code) {
    case 'user-cancelled':
      return { tipo: 'cancelada' }
    case 'deferred-payment':
    case 'pending':
      return { tipo: 'pendente' }
    case 'already-owned':
      return { tipo: 'erro', mensagem: 'Você já tem esta assinatura nesta conta da loja. Toque em "Restaurar compras".' }
    case 'network-error':
    case 'service-error':
    case 'billing-unavailable':
    case 'iap-not-available':
      return { tipo: 'erro', mensagem: 'Não foi possível falar com a loja. Confira a internet e tente de novo. Nada foi cobrado.' }
    default:
      return { tipo: 'erro', mensagem: 'A compra não foi concluída e nada foi cobrado. Tente de novo em instantes.' }
  }
}

export type Assinatura = {
  loja: 'app_store' | 'google_play'
  produto: string
  periodo: Periodo
  status: 'em_teste' | 'ativa' | 'pagamento_falhou' | 'cancelando' | 'cancelada' | 'expirada'
  renova_auto: boolean
  renews_at: string | null
  trial_ends_at: string | null
  cancel_at: string | null
  vale: boolean
}

export const NOME_LOJA = { app_store: 'App Store', google_play: 'Google Play' } as const

/** Situação da assinatura em uma frase (Minha assinatura). */
export function situacao(a: Assinatura): string {
  const fim = a.renews_at ? dataCurta(a.renews_at) : null
  if (!a.vale) return 'Assinatura encerrada. Você está no plano Grátis.'
  switch (a.status) {
    case 'em_teste':
      return fim ? `Teste grátis até ${fim}. A primeira cobrança é nesse dia.` : 'Teste grátis.'
    case 'cancelando':
      return fim ? `Cancelada. O Premium vale até ${fim} e depois a conta volta ao Grátis.` : 'Cancelada.'
    case 'pagamento_falhou':
      return `A loja não conseguiu cobrar.${fim ? ` Atualize o pagamento até ${fim} para não perder o Premium.` : ''}`
    default:
      return fim ? `Renova automaticamente em ${fim}.` : 'Ativa.'
  }
}
