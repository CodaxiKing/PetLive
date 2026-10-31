import { supabase } from '../lib/supabase'

/**
 * Preço do Premium definido no painel (premium_planos_publicos). Quem cobra é
 * a loja de apps; este valor só aparece enquanto a loja ainda não respondeu.
 */
export type PlanoPremium = { ciclo: 'mensal' | 'anual'; preco_centavos: number; dias_teste: number }

export async function planosPremium(): Promise<PlanoPremium[]> {
  const { data, error } = await supabase.rpc('premium_planos_publicos')
  if (error) throw new Error(error.message)
  return data as PlanoPremium[]
}

/** "R$ 19,90". */
export const precoTexto = (centavos: number) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
