import { supabase } from '../lib/supabase'
import { hojeIso } from './peso'

export type Consulta = {
  id: string
  motivo: string
  realizada_em: string
  local: string | null
  veterinario: string | null
  observacao: string | null
}

export type ConsultaForm = {
  motivo: string
  realizada_em: string
  local: string
  veterinario: string
  observacao: string
}

export const CONSULTA_FORM_VAZIO: ConsultaForm = {
  motivo: '',
  realizada_em: '',
  local: '',
  veterinario: '',
  observacao: '',
}

/** Consultas do pet, mais recentes primeiro (histórico). */
export async function carregarConsultas(petId: string): Promise<Consulta[]> {
  const { data, error } = await supabase
    .from('visits')
    .select('id, motivo, realizada_em, local, veterinario, observacao')
    .eq('pet_id', petId)
    .order('realizada_em', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Consulta[]
}

/** Registra uma consulta (data futura = consulta agendada). */
export async function registrarConsulta(petId: string, form: ConsultaForm): Promise<void> {
  const { error } = await supabase.from('visits').insert({
    pet_id: petId,
    motivo: form.motivo.trim(),
    realizada_em: form.realizada_em,
    local: form.local.trim() || null,
    veterinario: form.veterinario.trim() || null,
    observacao: form.observacao.trim() || null,
  })
  if (error) throw new Error(error.message)
}

/** A consulta ainda vai acontecer (data posterior a hoje). */
export function ehAgendada(consulta: Consulta): boolean {
  return consulta.realizada_em > hojeIso()
}
