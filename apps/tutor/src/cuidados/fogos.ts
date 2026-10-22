import { supabase } from '../lib/supabase'

/**
 * Fogos e trovão (BUSINESS.md 5.33): datas do conteúdo mestre, preferências
 * de aviso, checklist para acalmar e o modo calmo da noite. O conteúdo não
 * recomenda remédio.
 */
export type DataFogos = { id: string; nome: string; data: string; regiao: string; dica: string | null }
export type PrefsFogos = { avisar: boolean; lembrar_em_casa: boolean; checklist: string[]; modo_calmo_em: string | null }

export const PREFS_PADRAO: PrefsFogos = { avisar: true, lembrar_em_casa: true, checklist: [], modo_calmo_em: null }

/** Itens do checklist. `rota` leva à tela certa do app (ex.: a carteirinha, enquanto o QR da coleira não existe). */
export const CHECKLIST: { chave: string; texto: string; rota?: 'carteirinha' }[] = [
  { chave: 'comodo', texto: 'Deixe-o em um cômodo calmo, com a janela fechada' },
  { chave: 'plaquinha', texto: 'Confira a plaquinha e o contato na coleira', rota: 'carteirinha' },
  { chave: 'companhia', texto: 'Não o deixe sozinho nessa noite' },
  { chave: 'favoritos', texto: 'Separe o brinquedo e a caminha favoritos' },
  { chave: 'passeio', texto: 'Passeie mais cedo, antes de escurecer' },
]

export async function proximaData(): Promise<DataFogos | null> {
  const hoje = new Date()
  const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  const { data } = await supabase.from('datas_fogos').select('id, nome, data, regiao, dica').gte('data', iso).order('data').limit(1)
  return ((data ?? [])[0] as DataFogos | undefined) ?? null
}

export async function carregarPrefs(tutorId: string): Promise<PrefsFogos> {
  const { data } = await supabase
    .from('fogos_prefs')
    .select('avisar, lembrar_em_casa, checklist, modo_calmo_em')
    .eq('tutor_id', tutorId)
    .maybeSingle()
  return (data as PrefsFogos | null) ?? PREFS_PADRAO
}

export async function salvarPrefs(tutorId: string, prefs: PrefsFogos): Promise<void> {
  const { error } = await supabase
    .from('fogos_prefs')
    .upsert({ tutor_id: tutorId, ...prefs, atualizado_em: new Date().toISOString() }, { onConflict: 'tutor_id' })
  if (error) throw new Error(error.message)
}

/** Data de hoje no aparelho (a noite do modo calmo). */
export function hojeLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function diasAte(dataIso: string): number {
  const alvo = new Date(`${dataIso}T00:00:00`).getTime()
  const hoje = new Date(`${hojeLocal()}T00:00:00`).getTime()
  return Math.round((alvo - hoje) / 86_400_000)
}
