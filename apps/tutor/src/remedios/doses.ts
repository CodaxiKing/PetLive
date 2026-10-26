import { supabase } from '../lib/supabase'
import type { Remedio } from './types'

export type DoseHoje = {
  id: string
  medication_id: string
  /** ISO do horário previsto (instante UTC). */
  prevista_para: string
  confirmada_em: string | null
  pulada: boolean
}

/** 'YYYY-MM-DD' de hoje no fuso local. */
export function hojeIso(): string {
  const hoje = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${hoje.getFullYear()}-${p(hoje.getMonth() + 1)}-${p(hoje.getDate())}`
}

/** Instante UTC (ISO) de um horário de um dia 'YYYY-MM-DD' no fuso local. */
function instanteLocal(dataIso: string, hhmm: string): string {
  const [a, m, d] = dataIso.split('-').map(Number)
  const [h, min] = hhmm.split(':').map(Number)
  return new Date(a, m - 1, d, h, min, 0, 0).toISOString()
}

/** O remédio está em tratamento hoje (início passou e não acabou). */
export function emTratamentoHoje(remedio: Remedio): boolean {
  const hoje = hojeIso()
  return remedio.inicio <= hoje && (remedio.fim == null || remedio.fim >= hoje)
}

/** Tratamento já terminou (fim no passado) ou foi encerrado. */
export function concluido(remedio: Remedio): boolean {
  return !remedio.ativo || (remedio.fim != null && remedio.fim < hojeIso())
}

/** Dia atual do tratamento (1-based) e total de dias, quando houver fim. */
export function progressoDias(remedio: Remedio): { dia: number; total: number | null } {
  const [ai, mi, di] = remedio.inicio.split('-').map(Number)
  const inicio = new Date(ai, mi - 1, di)
  inicio.setHours(0, 0, 0, 0)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const dia = Math.max(1, Math.round((hoje.getTime() - inicio.getTime()) / 86_400_000) + 1)

  if (!remedio.fim) return { dia, total: null }
  const [af, mf, df] = remedio.fim.split('-').map(Number)
  const fim = new Date(af, mf - 1, df)
  fim.setHours(0, 0, 0, 0)
  const total = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / 86_400_000) + 1)
  return { dia, total }
}

/**
 * Garante as linhas de dose de hoje de cada remédio ativo (idempotente:
 * a unique constraint medication_id + prevista_para ignora duplicatas).
 */
export async function garantirDosesHoje(remedios: Remedio[]): Promise<void> {
  const hoje = hojeIso()
  const linhas = remedios
    .filter((r) => r.ativo && emTratamentoHoje(r))
    .flatMap((r) =>
      r.horarios.map((h) => ({
        medication_id: r.id,
        prevista_para: instanteLocal(hoje, h),
      })),
    )

  if (linhas.length === 0) return

  const { error } = await supabase
    .from('medication_doses')
    .upsert(linhas, { onConflict: 'medication_id,prevista_para', ignoreDuplicates: true })

  if (error) throw new Error(error.message)
}

/** Doses de hoje dos remédios informados, em ordem de horário. */
export async function carregarDosesHoje(medicationIds: string[]): Promise<DoseHoje[]> {
  if (medicationIds.length === 0) return []

  const hoje = hojeIso()
  const inicio = instanteLocal(hoje, '00:00')
  const fim = instanteLocal(
    (() => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      const p = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    })(),
    '00:00',
  )

  const { data, error } = await supabase
    .from('medication_doses')
    .select('id, medication_id, prevista_para, confirmada_em, pulada')
    .in('medication_id', medicationIds)
    .gte('prevista_para', inicio)
    .lt('prevista_para', fim)
    .order('prevista_para', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as DoseHoje[]
}

/** Marca a dose como dada agora. */
export async function confirmarDose(doseId: string): Promise<void> {
  const { error } = await supabase
    .from('medication_doses')
    .update({ confirmada_em: new Date().toISOString(), origem: 'app' })
    .eq('id', doseId)

  if (error) throw new Error(error.message)
  // Widget da tela inicial passa para a próxima dose.
  void import('../widget/tarefaWidget').then((w) => w.atualizarWidget()).catch(() => undefined)
}

/** '2026-10-20T11:00:00+00:00' -> '11:00'. */
export function horaDaDose(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}
