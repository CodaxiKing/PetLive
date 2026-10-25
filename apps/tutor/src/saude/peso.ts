import { supabase } from '../lib/supabase'

export type RegistroPeso = {
  id: string
  peso: number
  medido_em: string
  /** Quem registrou (guarda compartilhada). */
  criado_por?: string | null
}

/** '28,5' ou '28.5' -> 28.5. Null se inválido (fora de 0,1–299,9). */
export function kgParaNumero(bruto: string): number | null {
  const texto = bruto.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(texto)) return null
  const valor = Number(texto)
  if (!(valor > 0) || valor >= 300) return null
  return Math.round(valor * 100) / 100
}

/** 28.5 -> '28,5' (formato pt-BR com vírgula). */
export function formatarKg(valor: number): string {
  return valor.toFixed(1).replace('.', ',')
}

/** 'YYYY-MM-DD' de hoje no fuso local (evita o UTC do toISOString). */
export function hojeIso(): string {
  const hoje = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${hoje.getFullYear()}-${p(hoje.getMonth() + 1)}-${p(hoje.getDate())}`
}

/** Registros do pet em ordem cronológica (alimenta o gráfico). */
export async function carregarPesos(petId: string): Promise<RegistroPeso[]> {
  const { data, error } = await supabase
    .from('weights')
    .select('id, peso, medido_em, criado_por')
    .eq('pet_id', petId)
    .order('medido_em', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as { id: string; peso: number | string; medido_em: string; criado_por: string | null }[]).map((r) => ({
    id: r.id,
    peso: Number(r.peso),
    medido_em: r.medido_em,
    criado_por: r.criado_por,
  }))
}

/**
 * Salva o peso de hoje: atualiza o registro do dia se já existir, insere se
 * não, e mantém pets.peso_atual em dia (exibido no resumo e na ficha).
 */
export async function registrarPeso(petId: string, kg: number): Promise<void> {
  const dia = hojeIso()

  const { data: existente, error: erroLeitura } = await supabase
    .from('weights')
    .select('id')
    .eq('pet_id', petId)
    .eq('medido_em', dia)
    .limit(1)

  if (erroLeitura) throw new Error(erroLeitura.message)

  const registroHoje = (existente ?? [])[0] as { id: string } | undefined
  const gravacao = registroHoje
    ? supabase.from('weights').update({ peso: kg }).eq('id', registroHoje.id)
    : supabase.from('weights').insert({ pet_id: petId, peso: kg, medido_em: dia })

  const { error: erroSalvar } = await gravacao
  if (erroSalvar) throw new Error(erroSalvar.message)

  const { error: erroPet } = await supabase.from('pets').update({ peso_atual: kg }).eq('id', petId)
  if (erroPet) throw new Error(erroPet.message)
}

/**
 * Variação nos últimos 6 meses: diferença entre o registro atual e o mais
 * antigo do período. Null quando não há base para comparar.
 */
export function variacaoSeisMeses(
  registros: RegistroPeso[],
): { delta: number; texto: string } | null {
  if (registros.length < 2) return null

  const atual = registros[registros.length - 1]
  const corte = new Date()
  corte.setMonth(corte.getMonth() - 6)
  const p = (n: number) => String(n).padStart(2, '0')
  const corteIso = `${corte.getFullYear()}-${p(corte.getMonth() + 1)}-${p(corte.getDate())}`

  const base = registros.find((r) => r.medido_em >= corteIso)
  if (!base || base.id === atual.id) return null

  const delta = Math.round((atual.peso - base.peso) * 10) / 10
  const sinal = delta > 0 ? '+' : delta < 0 ? '-' : 'sem variação '
  const valor = formatarKg(Math.abs(delta))
  const texto = delta === 0 ? `sem variação em 6 meses` : `${sinal}${valor} kg em 6 meses`
  return { delta, texto }
}
