import { useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'

/** Lojas do marketplace (BUSINESS.md 5.1 a 5.10, Fase 3): vitrine, produto e solicitação. */

export type CategoriaProduto = 'racao' | 'petiscos' | 'higiene' | 'acessorios' | 'brinquedos' | 'farmacia' | 'outros'
export const CATEGORIAS_PRODUTO: { valor: CategoriaProduto; rotulo: string }[] = [
  { valor: 'racao', rotulo: 'Ração' },
  { valor: 'petiscos', rotulo: 'Petiscos' },
  { valor: 'higiene', rotulo: 'Higiene' },
  { valor: 'acessorios', rotulo: 'Acessórios' },
  { valor: 'brinquedos', rotulo: 'Brinquedos' },
  { valor: 'farmacia', rotulo: 'Farmácia' },
  { valor: 'outros', rotulo: 'Outros' },
]

export type Produto = {
  id: string
  store_id: string
  name: string
  categoria: CategoriaProduto
  description: string | null
  price_cents: number | null
  photo_url: string | null
  venda: 'app' | 'local_com_receita'
  receita_msg: string | null
  mensagem_tutor: string | null
  stock: number | null
  disponivel: boolean
}

export type Loja = {
  id: string
  name: string
  kind: string
  oferece: 'produtos' | 'servicos' | 'ambos'
  address: string | null
  neighborhood: string | null
  city: string | null
  lat: number | null
  lng: number | null
  phone: string | null
  photo_url: string | null
  aberta: boolean
  rating_avg: number | null
  rating_count: number
  pickup_enabled: boolean
  pickup_prepare_min: number
  delivery_enabled: boolean
  delivery_fee_cents: number
  delivery_radius_km: number
  delivery_min_order_cents: number
  delivery_free_over_cents: number | null
  delivery_eta_min: number
  delivery_eta_max: number
  response_deadline_min: number
  cancel_until_min: number
  horarios: { weekday: number; opens: string; closes: string }[]
}

export type TipoClinico = 'consulta' | 'vacina' | 'retorno'
export type Servico = { id: string; name: string; description: string | null; modelo: string; duration_min: number | null; price_cents: number | null; tipo_clinico?: TipoClinico | null }
export type Vitrine = { disponivel: false } | { disponivel: true; loja: Loja; produtos: Produto[]; servicos: Servico[] }

export type StatusSolicitacao = 'aguardando_pagamento' | 'enviada' | 'confirmada' | 'recusada' | 'expirada' | 'cancelada' | 'pronta' | 'em_entrega' | 'em_andamento' | 'concluida' | 'nao_compareceu'
export const TEXTO_STATUS: Record<StatusSolicitacao, string> = {
  aguardando_pagamento: 'Aguardando o Pix',
  enviada: 'Aguardando a loja',
  confirmada: 'Confirmada',
  recusada: 'Recusada',
  expirada: 'Sem resposta',
  cancelada: 'Cancelada',
  pronta: 'Pronta para retirar',
  em_entrega: 'Saiu para entrega',
  em_andamento: 'Em atendimento',
  concluida: 'Concluída',
  nao_compareceu: 'Não retirada',
}
export const STATUS_FINAIS: StatusSolicitacao[] = ['recusada', 'expirada', 'cancelada', 'concluida', 'nao_compareceu']

export type Solicitacao = {
  id: string
  numero: number
  status: StatusSolicitacao
  kind: 'produto' | 'servico'
  fulfillment: 'retirada' | 'entrega' | null
  subtotal_cents: number
  delivery_fee_cents: number
  discount_cents: number
  total_cents: number
  pay_method: 'pix_app' | 'na_loja'
  cupom: string | null
  pagamento: { id: string; status: 'criando' | 'pendente' | 'pago' | 'expirado' | 'cancelado' | 'estorno_pendente' | 'estornado'; paid_at: string | null } | null
  message: string | null
  motivo: string | null
  endereco: string | null
  codigo_entrega: string | null
  expira_em: string | null
  criado_em: string
  starts_at: string | null
  ends_at: string | null
  pet: { id: string; nome: string } | null
  service_id: string | null
  modelo: 'horario' | 'passeio' | 'dia' | 'diarias' | null
  loja: { id: string; name: string; phone: string | null; address: string | null; lat: number | null; lng: number | null; pickup_prepare_min: number; cancel_until_min: number }
  itens: { nome: string; qty: number; unit_cents: number; product_id: string | null }[]
  eventos: { status: StatusSolicitacao; at: string; reason: string | null }[]
}

async function rpc<T>(nome: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(nome, args)
  if (error) throw new Error(error.message)
  return data as T
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const abrirVitrine = (lojaId: string) => rpc<Vitrine>('loja_vitrine', { p_store: lojaId })
export const abrirProduto = (id: string) =>
  rpc<{ disponivel: false } | { disponivel: true; produto: Produto; loja: Loja }>('loja_produto', { p_id: id })
export const minhasSolicitacoes = () => rpc<Solicitacao[]>('minhas_solicitacoes')
export const abrirSolicitacao = (id: string) =>
  rpc<{ disponivel: false } | { disponivel: true; solicitacao: Solicitacao }>('solicitacao_detalhe', { p_id: id })
export const MOTIVOS_DENUNCIA_LOJA = ['Produto falsificado ou ilegal', 'Medicamento sem receita', 'Preço ou descrição enganosa', 'Outro problema']
export const denunciarItem = (tipo: 'produto' | 'avaliacao' | 'loja', id: string, motivo: string) =>
  rpc<void>('loja_denunciar', { p_kind: tipo, p_target: id, p_motivo: motivo })
export type Entrega = {
  status: 'preparando' | 'pronta_para_sair' | 'em_rota' | 'entregue' | 'falhou' | 'devolvida'
  eta_at: string | null
  left_at: string | null
  delivered_at: string | null
  fail_reason: string | null
  tentativas: number
  entregador: string | null
  posicao: { lat: number; lng: number; em: string } | null
}
export const TEXTO_ENTREGA: Record<Entrega['status'], string> = {
  preparando: 'Separando o pedido',
  pronta_para_sair: 'Pronto para sair',
  em_rota: 'Saiu para entrega',
  entregue: 'Entregue',
  falhou: 'Tentativa sem sucesso',
  devolvida: 'Devolvido à loja',
}
export const entregaDetalhe = (id: string) => rpc<Entrega | null>('entrega_detalhe', { p_request: id })

/** "Chega em 12 min" a partir do prazo da entrega. */
export function textoChegada(etaIso: string | null, agora = Date.now()): string | null {
  if (!etaIso) return null
  const min = Math.round((Date.parse(etaIso) - agora) / 60000)
  return min > 1 ? `Chega em até ${min} min` : 'Chegando'
}

export const cancelarSolicitacao = (id: string) => rpc<void>('solicitacao_mudar', { p_id: id, p_para: 'cancelada', p_motivo: 'Cancelada pelo tutor' })

/** Loja que assumiu o lugar do mapa (só lugares do PetLive têm id uuid). */
export async function lojaDoLugar(placeId: string): Promise<string | null> {
  if (!UUID.test(placeId)) return null
  return rpc<string | null>('loja_do_lugar', { p_place: placeId }).catch(() => null)
}

export async function enviarSolicitacao(
  lojaId: string,
  itens: { product_id: string; qty: number }[],
  fulfillment: 'retirada' | 'entrega',
  mensagem: string,
  enderecoId: string | null,
  pagamento: 'pix_app' | 'na_loja' = 'na_loja',
  cupom: string | null = null,
) {
  if (!itens.length) throw new Error('Escolha ao menos um produto.')
  return rpc<{ id: string; status: StatusSolicitacao; total_cents: number; pay_method: 'pix_app' | 'na_loja' }>('solicitacao_criar', {
    p_store: lojaId,
    p_itens: itens,
    p_fulfillment: fulfillment,
    p_message: mensagem.trim() || null,
    p_address_id: fulfillment === 'entrega' ? enderecoId : null,
    p_pay_method: pagamento,
    p_cupom: cupom,
  })
}

/** Taxa de entrega (modo fixo): grátis acima do valor da loja; fora do mínimo não entrega. */
export function taxaEntrega(loja: Pick<Loja, 'delivery_fee_cents' | 'delivery_free_over_cents' | 'delivery_min_order_cents'>, subtotal: number): { ok: boolean; taxa: number; falta: number } {
  if (subtotal < loja.delivery_min_order_cents) return { ok: false, taxa: 0, falta: loja.delivery_min_order_cents - subtotal }
  const gratis = loja.delivery_free_over_cents !== null && subtotal >= loja.delivery_free_over_cents
  return { ok: true, taxa: gratis ? 0 : loja.delivery_fee_cents, falta: 0 }
}

/** O tutor pode cancelar enquanto a loja não respondeu, ou depois de confirmada e antes de ficar pronta. */
export const podeCancelar = (s: Pick<Solicitacao, 'status'>) => s.status === 'enviada' || s.status === 'confirmada'

// ---------- Carrinho (uma loja por vez, só na memória do app) ----------
export type ItemCarrinho = { produto: Pick<Produto, 'id' | 'name' | 'price_cents' | 'photo_url'>; qty: number }
type Carrinho = { lojaId: string | null; itens: ItemCarrinho[] }

let carrinho: Carrinho = { lojaId: null, itens: [] }
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((o) => o())

export function adicionarAoCarrinho(lojaId: string, produto: ItemCarrinho['produto'], qty: number): 'ok' | 'outra_loja' {
  if (carrinho.lojaId && carrinho.lojaId !== lojaId && carrinho.itens.length) return 'outra_loja'
  const existente = carrinho.itens.find((i) => i.produto.id === produto.id)
  const itens = existente
    ? carrinho.itens.map((i) => (i.produto.id === produto.id ? { ...i, qty: Math.min(99, i.qty + qty) } : i))
    : [...carrinho.itens, { produto, qty: Math.min(99, qty) }]
  carrinho = { lojaId, itens }
  avisar()
  return 'ok'
}

export function mudarQuantidade(produtoId: string, qty: number) {
  const itens = qty <= 0 ? carrinho.itens.filter((i) => i.produto.id !== produtoId) : carrinho.itens.map((i) => (i.produto.id === produtoId ? { ...i, qty: Math.min(99, qty) } : i))
  carrinho = { lojaId: itens.length ? carrinho.lojaId : null, itens }
  avisar()
}

export function esvaziarCarrinho() {
  carrinho = { lojaId: null, itens: [] }
  avisar()
}

export const subtotalCarrinho = (c: Carrinho) => c.itens.reduce((s, i) => s + (i.produto.price_cents ?? 0) * i.qty, 0)

export function useCarrinho(): Carrinho {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o)
      return () => ouvintes.delete(o)
    },
    () => carrinho,
  )
}

export function lerCarrinho(): Carrinho {
  return carrinho
}

/** "Seg a Sex 08:00 às 18:00" simplificado: horário de hoje. */
export function horarioDeHoje(loja: Pick<Loja, 'horarios'>, agora = new Date()): string | null {
  const hoje = loja.horarios.filter((h) => h.weekday === agora.getDay())
  if (!loja.horarios.length) return null
  if (!hoje.length) return 'Fechada hoje'
  return `Hoje ${hoje.map((h) => `${h.opens} às ${h.closes}`).join(', ')}`
}
