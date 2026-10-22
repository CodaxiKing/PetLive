import { supabase } from '../lib/supabase'
import { erroDoServidor } from '../pets/limite'

/** Despesas do pet (BUSINESS.md 5.32): só registro, privado do tutor. */
export type Categoria = 'racao' | 'veterinario' | 'banho_tosa' | 'remedios' | 'acessorios' | 'hotel_creche' | 'outros'

export type Despesa = {
  id: string
  pet_id: string | null
  categoria: Categoria
  valor_centavos: number
  data: string
  anotacao: string | null
  recibo_path: string | null
  criado_em: string
}

export const CATEGORIAS: { valor: Categoria; rotulo: string; cor: string }[] = [
  { valor: 'racao', rotulo: 'Ração', cor: '#9AD6F8' },
  { valor: 'veterinario', rotulo: 'Veterinário', cor: '#FBDADF' },
  { valor: 'banho_tosa', rotulo: 'Banho e tosa', cor: '#FFE9A8' },
  { valor: 'remedios', rotulo: 'Remédios', cor: '#E4D3FA' },
  { valor: 'acessorios', rotulo: 'Acessórios', cor: '#FFD3B5' },
  { valor: 'hotel_creche', rotulo: 'Hotel e creche', cor: '#C9E7F5' },
  { valor: 'outros', rotulo: 'Outros', cor: '#D2EFDD' },
]

export const ROTULO_CATEGORIA = Object.fromEntries(CATEGORIAS.map((c) => [c.valor, c.rotulo])) as Record<Categoria, string>

/** 12345 -> "R$ 123,45". */
export function reais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** "2026-11" do mês, para agrupar. */
export function chaveMes(dataIso: string): string {
  return dataIso.slice(0, 7)
}

export async function carregarDespesas(desde: string): Promise<Despesa[]> {
  const { data, error } = await supabase
    .from('despesas')
    .select('id, pet_id, categoria, valor_centavos, data, anotacao, recibo_path, criado_em')
    .gte('data', desde)
    .order('data', { ascending: false })
    .order('criado_em', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Despesa[]
}

export async function carregarDespesa(id: string): Promise<Despesa | null> {
  const { data, error } = await supabase
    .from('despesas')
    .select('id, pet_id, categoria, valor_centavos, data, anotacao, recibo_path, criado_em')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Despesa | null
}

export type DespesaForm = Omit<Despesa, 'id' | 'criado_em'>

export async function salvarDespesa(id: string | null, despesa: DespesaForm): Promise<string> {
  const pedido = id
    ? supabase.from('despesas').update(despesa).eq('id', id).select('id').single()
    : supabase.from('despesas').insert(despesa).select('id').single()
  const { data, error } = await pedido
  if (error) throw erroDoServidor(error)
  return (data as { id: string }).id
}

export async function apagarDespesa(despesa: Despesa): Promise<void> {
  const { error } = await supabase.from('despesas').delete().eq('id', despesa.id)
  if (error) throw erroDoServidor(error)
  if (despesa.recibo_path) await supabase.storage.from('anexos').remove([despesa.recibo_path]).catch(() => undefined)
}

/**
 * Foto do recibo no bucket privado `anexos`, na pasta do tutor (as policies
 * exigem a primeira pasta = uid). Envia os bytes, como a foto do pet.
 */
export async function enviarRecibo(tutorId: string, uri: string, mimeType?: string): Promise<string> {
  const extensao = mimeType?.includes('png') ? 'png' : 'jpg'
  const caminho = `${tutorId}/despesas/${Date.now()}.${extensao}`
  const bytes = await (await fetch(uri)).arrayBuffer()
  const { error } = await supabase.storage
    .from('anexos')
    .upload(caminho, bytes, { contentType: mimeType ?? `image/${extensao === 'jpg' ? 'jpeg' : extensao}` })
  if (error) throw new Error('Não deu para enviar a foto do recibo.')
  return caminho
}

/** Link temporário (10 min) para ver o recibo: o bucket é privado. */
export async function urlRecibo(caminho: string): Promise<string | null> {
  const { data } = await supabase.storage.from('anexos').createSignedUrl(caminho, 600)
  return data?.signedUrl ?? null
}
