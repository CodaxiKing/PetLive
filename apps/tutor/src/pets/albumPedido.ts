import { supabase } from '../lib/supabase'

/** Pedido do álbum impresso (BUSINESS.md 5.33): formato, endereço com CEP e Pix. */
export type FormatoAlbum = {
  formato: string
  nome: string
  descricao: string
  paginas: 20 | 40 | 60
  preco_cents: number
  frete_cents: number
  total_cents: number
  prazo_dias_uteis: number
}
export type StatusPedidoAlbum = 'aguardando_pagamento' | 'pago' | 'em_producao' | 'enviado' | 'entregue' | 'cancelado' | 'expirado'
export type PedidoAlbum = {
  id: string
  numero: number
  status: StatusPedidoAlbum
  pet_id: string | null
  pet_nome: string
  ano: number
  formato: string
  formato_nome: string
  paginas: number
  lembrancas: number
  endereco: string
  cep: string
  preco_cents: number
  frete_cents: number
  total_cents: number
  prazo_dias_uteis: number
  rastreio: string | null
  pago_em: string | null
  criado_em: string
  pagamento: { id: string; status: string } | null
}
export type EnderecoPostal = { id: string; street: string; number: string | null; complement: string | null; neighborhood: string | null; city: string | null; cep: string | null }

export const TEXTO_PEDIDO_ALBUM: Record<StatusPedidoAlbum, string> = {
  aguardando_pagamento: 'Esperando o Pix',
  pago: 'Pago · vai para a gráfica',
  em_producao: 'Em produção',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  expirado: 'Expirado',
}

async function rpc<T>(nome: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(nome, args)
  if (error) throw new Error(error.message)
  return data as T
}

export const cotarAlbum = (lembrancas: number) => rpc<FormatoAlbum[]>('album_formatos_cotar', { p_lembrancas: lembrancas })
export const meusPedidosAlbum = (petId: string) => rpc<PedidoAlbum[]>('album_pedidos_meus', { p_pet: petId })
/** Pedidos de álbum de todos os pets da conta (tela inicial). */
export const meusPedidosAlbumTodos = () => rpc<PedidoAlbum[]>('album_pedidos_meus')
export const cancelarPedidoAlbum = (id: string) => rpc<void>('album_pedido_cancelar', { p_order: id })
export const pedirAlbum = (petId: string, ano: number, formato: string, itens: string[], enderecoId: string) =>
  rpc<{ id: string; total_cents: number }>('album_pedido_criar', { p_pet: petId, p_ano: ano, p_formato: formato, p_itens: itens, p_address: enderecoId })

/** 20510-060 enquanto digita. */
export function mascararCep(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/** Endereço que serve para o correio: rua, número, CEP e cidade. */
export function enderecoPostalCompleto(e: Pick<EnderecoPostal, 'street' | 'cep' | 'city'>): boolean {
  return e.street.trim().length >= 2 && /^\d{8}$/.test(e.cep ?? '') && (e.city ?? '').trim().length >= 2
}

/** "Rua Uruguai, 380 · Tijuca". */
export function linhaEndereco(e: Pick<EnderecoPostal, 'street' | 'number' | 'neighborhood'>): string {
  return [e.street + (e.number ? `, ${e.number}` : ''), e.neighborhood].filter(Boolean).join(' · ')
}

export async function enderecosPostais(): Promise<EnderecoPostal[]> {
  const { data, error } = await supabase
    .from('addresses')
    .select('id, street, number, complement, neighborhood, city, cep')
    .order('criado_em', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as EnderecoPostal[]
}

export async function salvarEnderecoPostal(e: Omit<EnderecoPostal, 'id'>): Promise<EnderecoPostal> {
  const cep = (e.cep ?? '').replace(/\D/g, '')
  if (!enderecoPostalCompleto({ street: e.street, cep, city: e.city })) throw new Error('Preencha rua, CEP e cidade.')
  const { data, error } = await supabase
    .from('addresses')
    .insert({
      street: e.street.trim().slice(0, 160),
      number: e.number?.trim().slice(0, 20) || null,
      complement: e.complement?.trim().slice(0, 80) || null,
      neighborhood: e.neighborhood?.trim().slice(0, 80) || null,
      city: (e.city ?? '').trim().slice(0, 80),
      cep,
    })
    .select('id, street, number, complement, neighborhood, city, cep')
    .single()
  if (error) throw new Error('Não deu para salvar o endereço. Tente de novo.')
  return data as EnderecoPostal
}
