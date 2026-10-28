import { supabase } from '../lib/supabase'

/** Endereços de entrega do tutor (BUSINESS.md 21.4 `addresses`): só a própria conta lê e escreve. */
export type Endereco = { id: string; label: string | null; street: string; number: string | null; complement: string | null; lat: number | null; lng: number | null }

export async function carregarEnderecos(): Promise<Endereco[]> {
  const { data, error } = await supabase.from('addresses').select('id, label, street, number, complement, lat, lng').order('criado_em', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Endereco[]
}

export async function salvarEndereco(e: { street: string; number: string; complement: string; lat: number; lng: number }): Promise<Endereco> {
  const rua = e.street.trim()
  if (rua.length < 2) throw new Error('Escreva a rua.')
  const { data, error } = await supabase
    .from('addresses')
    .insert({ street: rua.slice(0, 160), number: e.number.trim().slice(0, 20) || null, complement: e.complement.trim().slice(0, 80) || null, lat: e.lat, lng: e.lng })
    .select('id, label, street, number, complement, lat, lng')
    .single()
  if (error) throw new Error('Não deu para salvar o endereço. Tente de novo.')
  return data as Endereco
}
