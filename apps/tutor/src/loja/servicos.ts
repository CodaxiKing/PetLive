import { supabase } from '../lib/supabase'
import { diaIso } from './reservas'

/** Creche, hotelzinho e passeador (BUSINESS.md 6 e 19.6): regras e reservas pelo banco. */
export type Porte = 'pequeno' | 'medio' | 'grande'
export type Plano = { id: string; period: 'dia' | 'meio'; price_cents: number; package_days: number | null; package_cents: number | null }
export type Extra = { id: string; nome: string; price_cents: number; por_dia: boolean }
export type RegraPasseio = { price_30_cents: number; price_60_cents: number; radius_km: number; max_pets: number; weekdays: number[]; window_start: string; window_end: string }
export type DetalheServico =
  | { disponivel: false }
  | {
      disponivel: true
      servico: { id: string; name: string; description: string | null; modelo: 'horario' | 'passeio' | 'dia' | 'diarias'; capacity: number; requires_vaccines: boolean; entrada_ate: string | null; retirada_desde: string | null }
      loja: { id: string; name: string; cancel_until_min: number }
      tarifas: Partial<Record<Porte, number>>
      extras: Extra[]
      planos: Plano[]
      passeio: RegraPasseio | null
      vagas: Record<string, number> | null
    }

async function rpc<T>(nome: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(nome, args)
  if (error) throw new Error(error.message)
  return data as T
}

export const detalheServico = (id: string) => rpc<DetalheServico>('servico_detalhe', { p_service: id })

export const reservarCreche = (servico: string, dias: Date[], periodo: 'dia' | 'meio', pacote: boolean, pet: string, mensagem: string) =>
  rpc<{ id: string; total_cents: number }>('creche_reservar', { p_service: servico, p_dias: dias.map(diaIso), p_periodo: periodo, p_pacote: pacote, p_pet: pet, p_message: mensagem.trim() || null })

export const reservarHotel = (servico: string, entrada: Date, saida: Date, pet: string, extras: string[], mensagem: string) =>
  rpc<{ id: string; total_cents: number }>('hotel_reservar', { p_service: servico, p_checkin: diaIso(entrada), p_checkout: diaIso(saida), p_pet: pet, p_extras: extras, p_message: mensagem.trim() || null })

export const horariosPasseio = (servico: string, dia: Date, duracao: 30 | 60) =>
  rpc<{ inicio: string; vagas_livres: number }[]>('passeio_horarios', { p_service: servico, p_dia: diaIso(dia), p_duracao: duracao })

export const reservarPasseio = (servico: string, inicio: string, duracao: 30 | 60, pet: string, endereco: string, mensagem: string) =>
  rpc<{ id: string; total_cents: number }>('passeio_reservar', { p_service: servico, p_inicio: inicio, p_duracao: duracao, p_pet: pet, p_address_id: endereco, p_message: mensagem.trim() || null })

/** Mesmo corte do banco (porte_do_pet): até 10 kg pequeno, até 25 kg médio. */
export function porteDoPet(peso: number | null): Porte {
  if (peso === null || peso < 10) return 'pequeno'
  return peso <= 25 ? 'medio' : 'grande'
}
export const TEXTO_PORTE: Record<Porte, string> = { pequeno: 'porte pequeno', medio: 'porte médio', grande: 'porte grande' }

/** Preço da creche: pacote com o mesmo número de dias, senão avulso por dia. */
export function precoCreche(planos: Plano[], periodo: 'dia' | 'meio', dias: number, pacote: boolean): number | null {
  if (!dias) return 0
  if (pacote) return planos.find((p) => p.period === periodo && p.package_days === dias)?.package_cents ?? null
  const avulso = planos.find((p) => p.period === periodo && p.package_days === null)
  return avulso ? avulso.price_cents * dias : null
}

export const noitesEntre = (entrada: Date, saida: Date) => Math.round((saida.getTime() - entrada.getTime()) / 86_400_000)

export function precoHotel(noite: number | undefined, noites: number, extras: Extra[], escolhidos: string[]): number | null {
  if (noite === undefined || noites <= 0) return null
  return noite * noites + extras.filter((e) => escolhidos.includes(e.id)).reduce((s, e) => s + e.price_cents * (e.por_dia ? noites : 1), 0)
}
