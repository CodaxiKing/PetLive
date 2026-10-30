import { supabase } from '../lib/supabase'
import { gerarLink } from '../pets/linkCarteirinha'
import { ITENS_FICHA, secoesFicha } from '../pets/fichaEmergencia'

/**
 * SOS pré-chegada (protótipo EstouACaminho): avisar uma clínica 24 h do
 * PetLive que o pet está a caminho, com a ficha de emergência e o tempo de
 * chegada, e acompanhar a resposta até tocar em Cheguei.
 */
export type Clinica24h = { id: string; name: string; address: string | null; neighborhood: string | null; phone: string | null; lat: number; lng: number; distancia_km: number }
export type StatusChegada = 'enviada' | 'vista' | 'preparando' | 'pronta' | 'indisponivel' | 'cancelada' | 'chegou' | 'expirada'
export type Chegada = {
  id: string
  status: StatusChegada
  eta_min: number
  eta_at: string
  resposta: string | null
  criado_em: string
  vista_em: string | null
  preparando_em: string | null
  pronta_em: string | null
  chegou_em: string | null
  substituido_por: string | null
  pet: { id: string; nome: string }
  ficha: { codigo: string; secoes: string[]; expira_em: string } | null
  clinica: { id: string; name: string; phone: string | null; address: string | null; lat: number | null; lng: number | null }
}

async function rpc<T>(nome: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(nome, args)
  if (error) throw new Error(error.message)
  return data as T
}

export const clinicas24hPerto = (lat: number, lng: number) => rpc<Clinica24h[]>('clinicas_24h_perto', { p_lat: lat, p_lng: lng })
export const chegadaDetalhe = (id: string) => rpc<Chegada | null>('sos_chegada_detalhe', { p_id: id })
export const chegadaAtual = () => rpc<string | null>('sos_chegada_atual')
export const mudarDeClinica = (id: string, clinicaId: string, etaMin: number) =>
  rpc<string>('sos_chegada_mudar_clinica', { p_id: id, p_store: clinicaId, p_eta_min: etaMin })
export const cheguei = (id: string) => rpc<void>('sos_chegada_encerrar', { p_id: id, p_cheguei: true })
export const cancelarIda = (id: string) => rpc<void>('sos_chegada_encerrar', { p_id: id, p_cheguei: false })

/** Ficha de emergência completa (6 h) e o aviso à clínica. Devolve o id do aviso. */
export async function avisarClinica(petId: string, clinicaId: string, etaMin: number): Promise<string> {
  const todas = new Set(ITENS_FICHA.map((i) => i.chave))
  const { codigo } = await gerarLink(petId, secoesFicha(todas), 6, { tipo: 'emergencia', lugar: null })
  return rpc<string>('sos_chegada_criar', { p_store: clinicaId, p_pet: petId, p_codigo: codigo, p_eta_min: etaMin })
}

/** Tempo de carro estimado: 0,4 km por minuto no trânsito, entre 3 e 120 min. */
export function minutosAte(km: number): number {
  return Math.min(120, Math.max(3, Math.round(km / 0.4)))
}

/** "Chego em 9 min" contando até a hora prevista; perto ou passada, "Chegando". */
export function textoChego(etaIso: string, agora = Date.now()): string {
  const min = Math.ceil((Date.parse(etaIso) - agora) / 60000)
  return min > 1 ? `Chego em ${min} min` : 'Chegando'
}

/** "agora", "há 3 min", "há 1 h". */
export function haQuanto(iso: string, agora = Date.now()): string {
  const min = Math.floor((agora - Date.parse(iso)) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  return `há ${Math.floor(min / 60)} h`
}

export const CHEGADA_ENCERRADA: StatusChegada[] = ['cancelada', 'chegou', 'expirada']
