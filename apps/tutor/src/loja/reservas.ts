import { supabase } from '../lib/supabase'

/** Reservas por horário (BUSINESS.md 6 e 19.5): horários livres calculados no banco. */
export type HorarioLivre = { inicio: string; fim: string; vagas_livres: number }

async function rpc<T>(nome: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(nome, args)
  if (error) throw new Error(error.message)
  return data as T
}

/** "2026-10-28" no fuso do aparelho (lojas do Brasil). */
export const diaIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function proximosDias(n = 14, hoje = new Date()): Date[] {
  return Array.from({ length: n }, (_, i) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i))
}

export const horariosLivres = (servicoId: string, dia: Date, ignorar?: string) =>
  rpc<HorarioLivre[]>('horarios_livres', { p_service: servicoId, p_dia: diaIso(dia), p_vagas: 1, p_ignorar: ignorar ?? null })

export const reservar = (servicoId: string, inicio: string, petId: string | null, mensagem: string) =>
  rpc<{ id: string; status: string }>('servico_reservar', { p_service: servicoId, p_inicio: inicio, p_pet: petId, p_message: mensagem.trim() || null, p_vagas: 1 })

export const remarcar = (reservaId: string, inicio: string) => rpc<void>('servico_remarcar', { p_request: reservaId, p_inicio: inicio })

export const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
export const duracaoTexto = (min: number | null) => (!min ? '' : min % 60 === 0 ? `${min / 60}h` : min > 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min} min`)

/** Link do Google Agenda com o horário (abre no app ou no navegador, sem permissão de calendário). */
export function linkAgenda(titulo: string, inicio: string, fim: string, local: string | null): string {
  const z = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const p = new URLSearchParams({ action: 'TEMPLATE', text: titulo, dates: `${z(inicio)}/${z(fim)}`, details: 'Reservado pelo PetLive', location: local ?? '' })
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}
