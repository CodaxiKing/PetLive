import { useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'

/** Pix e cupons (BUSINESS.md 5.4 e 5.9). A cobrança é criada pela função create-pix-charge. */
export type StatusPagamento = 'criando' | 'pendente' | 'pago' | 'expirado' | 'cancelado' | 'estorno_pendente' | 'estornado'
export type Pagamento = {
  id: string
  codigo: string
  status: StatusPagamento
  amount_cents: number
  descricao: string
  method: 'pix'
  pix_payload: string | null
  pix_qr: string | null
  expires_at: string
  paid_at: string | null
  criado_em: string
  request_id: string | null
  album_order_id: string | null
  para: string | null
  itens: string[]
}
export type Cupom = { code: string; descricao: string | null; tipo: 'percentual' | 'valor'; valor: number; minimo_cents?: number; valido_ate: string | null }
export type CupomAplicado = Cupom & { id: string; desconto_cents: number }

async function rpc<T>(nome: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(nome, args)
  if (error) throw new Error(error.message)
  return data as T
}

export const pagamentoDetalhe = (id: string) => rpc<Pagamento | null>('pagamento_detalhe', { p_id: id })
export const desistirDoPix = (pedidoId: string) => rpc<void>('pagamento_desistir', { p_request: pedidoId })
/** A conta ainda não tem cliente no provedor: o primeiro Pix pede nome e CPF. */
export const precisaCpf = () => rpc<boolean>('pagamento_precisa_cpf')

// Nome e CPF digitados na solicitação, só na memória, até a tela do Pix usar uma vez.
let dadosPix: { nome: string; cpf: string } | null = null
export function guardarDadosPix(dados: { nome: string; cpf: string }) {
  dadosPix = dados
}
export function tomarDadosPix(): { nome: string; cpf: string } | undefined {
  const d = dadosPix ?? undefined
  dadosPix = null
  return d
}
export const cuponsParaMim = (lojaId: string) => rpc<Cupom[]>('cupons_para_mim', { p_store: lojaId })
export const aplicarCupom = (lojaId: string, codigo: string, subtotal: number) =>
  rpc<CupomAplicado>('cupom_aplicar', { p_store: lojaId, p_codigo: codigo, p_subtotal: subtotal })

/** Erro de gerar o Pix: "cpf" pede nome e CPF (primeira cobrança da conta). */
export class ErroPix extends Error {
  constructor(readonly codigo: string, mensagem: string) {
    super(mensagem)
  }
}

/** Cria (ou reabre) a cobrança Pix do pedido da loja ou do álbum. Devolve o id do pagamento. */
export async function gerarPix(alvo: { pedido: string } | { album: string }, dados?: { nome: string; cpf: string }): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ id: string }>('create-pix-charge', { body: { ...alvo, ...dados } })
  if (error) {
    // A resposta da função diz o motivo (cpf, sem_chave, pedido...).
    const contexto = (error as { context?: Response }).context
    const corpo: { erro?: string; mensagem?: string } = contexto ? await contexto.json().catch(() => ({})) : {}
    throw new ErroPix(corpo.erro ?? 'rede', corpo.mensagem ?? 'Não deu para gerar o Pix. Confira a internet e tente de novo.')
  }
  if (!data?.id) throw new ErroPix('interno', 'Não deu para gerar o Pix. Tente de novo.')
  return data.id
}

/** CPF com 11 dígitos e dígitos verificadores corretos (mesma regra do servidor). */
export function cpfValido(valor: string): boolean {
  const d = valor.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  for (const n of [9, 10]) {
    let soma = 0
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i)
    if (((soma * 10) % 11) % 10 !== Number(d[n])) return false
  }
  return true
}

/** 529.982.247-25 enquanto digita. */
export function mascararCpf(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11)
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

/** "29:41" até o Pix vencer; "00:00" quando passou. */
export function tempoRestante(expiraIso: string, agora = Date.now()): string {
  const s = Math.max(0, Math.floor((Date.parse(expiraIso) - agora) / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** "10% no primeiro pedido" ou "R$ 15 de desconto" quando a loja não escreveu a descrição. */
export function textoCupom(c: Pick<Cupom, 'descricao' | 'tipo' | 'valor'>): string {
  if (c.descricao) return c.descricao
  return c.tipo === 'percentual' ? `${c.valor}% de desconto` : `${(c.valor / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de desconto`
}

// ---------- Cupom escolhido para o pedido em andamento (só na memória do app) ----------
let cupomAtual: { lojaId: string; cupom: CupomAplicado } | null = null
const ouvintes = new Set<() => void>()

export function escolherCupom(lojaId: string, cupom: CupomAplicado | null) {
  cupomAtual = cupom ? { lojaId, cupom } : null
  ouvintes.forEach((o) => o())
}

export function useCupom(lojaId: string | null): CupomAplicado | null {
  const atual = useSyncExternalStore(
    (o) => {
      ouvintes.add(o)
      return () => ouvintes.delete(o)
    },
    () => cupomAtual,
  )
  return atual && atual.lojaId === lojaId ? atual.cupom : null
}
