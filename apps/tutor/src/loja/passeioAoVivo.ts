import { supabase } from '../lib/supabase'
import type { PontoPasseio } from '../passeios/passeio'

/** Passeio ao vivo (BUSINESS.md 19.7): o tutor acompanha o passeador em tempo real. */
export type FasePasseio = 'buscou' | 'passeando' | 'voltando' | 'entregue'
export type RegistroPasseio = { id: number; type: 'foto' | 'xixi' | 'coco' | 'agua'; media_path: string | null; at: string }
export type PasseioAoVivo =
  | { disponivel: false }
  | {
      disponivel: true
      request_id: string
      starts_at: string | null
      ends_at: string | null
      request_status: string
      pet: string | null
      loja: string
      passeador: string | null
      walk: { id: string; status: 'agendado' | 'iniciado' | 'em_andamento' | 'encerrado' | 'avaliado' | 'perdido'; fase: FasePasseio; started_at: string | null; ended_at: string | null; distance_m: number; summary: string | null } | null
      pontos: { lat: number; lng: number; at: string }[]
      registros: RegistroPasseio[]
    }

export const FASES: { valor: FasePasseio; rotulo: string }[] = [
  { valor: 'buscou', rotulo: 'Buscou' },
  { valor: 'passeando', rotulo: 'Passeando' },
  { valor: 'voltando', rotulo: 'Voltando' },
  { valor: 'entregue', rotulo: 'Entregue' },
]
export const TEXTO_REGISTRO: Record<RegistroPasseio['type'], string> = { foto: 'Foto', xixi: 'Xixi', coco: 'Cocô', agua: 'Água' }

export async function abrirPasseio(requestId: string): Promise<PasseioAoVivo> {
  const { data, error } = await supabase.rpc('passeio_ao_vivo', { p_request: requestId })
  if (error) throw new Error(error.message)
  return data as PasseioAoVivo
}

/** Pontos no formato do desenho de trajeto dos passeios do tutor (um trecho só). */
export const paraTrajeto = (pontos: { lat: number; lng: number; at: string }[]): PontoPasseio[] =>
  pontos.map((p) => ({ lat: p.lat, lng: p.lng, instante: Date.parse(p.at), precisao: 10, trecho: 0 }))

/** Minutos de passeio (até agora ou até o fim) e quanto falta do horário reservado. */
export function tempos(startedAt: string | null, endedAt: string | null, endsAt: string | null, agora = Date.now()) {
  if (!startedAt) return { minutos: 0, faltam: null as number | null }
  const fim = endedAt ? Date.parse(endedAt) : agora
  const minutos = Math.max(0, Math.round((fim - Date.parse(startedAt)) / 60000))
  const faltam = endedAt || !endsAt ? null : Math.max(0, Math.round((Date.parse(endsAt) - agora) / 60000))
  return { minutos, faltam }
}

export async function urlsFotosPasseio(registros: RegistroPasseio[]): Promise<Record<string, string>> {
  const caminhos = registros.filter((r) => r.media_path).map((r) => r.media_path as string)
  if (!caminhos.length) return {}
  const { data } = await supabase.storage.from('passeios-loja').createSignedUrls(caminhos, 3600)
  return Object.fromEntries((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])))
}

/** Novos pontos, registros e mudanças do passeio em tempo real (RLS: só o tutor e a loja). */
export function ouvirPasseio(walkId: string, aoMudar: () => void): () => void {
  const canal = supabase
    .channel(`passeio-${walkId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'walk_points', filter: `walk_id=eq.${walkId}` }, aoMudar)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'walk_events', filter: `walk_id=eq.${walkId}` }, aoMudar)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'walks', filter: `id=eq.${walkId}` }, aoMudar)
    .subscribe()
  return () => {
    supabase.removeChannel(canal)
  }
}
