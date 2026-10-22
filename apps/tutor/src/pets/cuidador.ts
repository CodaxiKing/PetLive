import { supabase } from '../lib/supabase'
import { quando } from './linkCarteirinha'
import { erroDoServidor } from './limite'

/**
 * Cuidador temporário (BUSINESS.md 5.24): acesso com prazo, por link, ao que
 * o tutor liberar. O cuidador vê os dados ao vivo e marca a dose dada.
 */
export type AcessoCuidador = {
  id: string
  codigo: string
  pet_ids: string[]
  cuidador: string
  inicio: string
  fim: string
  ver_vacinas: boolean
  ver_remedios: boolean
  ver_contatos: boolean
  revogado_em: string | null
  aberturas: number
  ultima_abertura_em: string | null
}

const SITE = (process.env.EXPO_PUBLIC_SITE_URL || 'https://petlive.app.br').replace(/\/$/, '')

export function urlCuidador(codigo: string): string {
  return `${SITE}/cuidador/${codigo}`
}

/** Durações rápidas do período (o acesso começa agora). */
export const DURACOES: { rotulo: string; horas: number }[] = [
  { rotulo: '1 dia', horas: 24 },
  { rotulo: '3 dias', horas: 72 },
  { rotulo: '1 semana', horas: 168 },
  { rotulo: '15 dias', horas: 360 },
]

export async function criarAcesso(opcoes: {
  pets: string[]
  cuidador: string
  fim: Date
  vacinas: boolean
  remedios: boolean
  contatos: boolean
}): Promise<{ codigo: string; fim: string }> {
  const { data, error } = await supabase.rpc('criar_acesso_cuidador', {
    p_pets: opcoes.pets,
    p_cuidador: opcoes.cuidador,
    p_fim: opcoes.fim.toISOString(),
    p_vacinas: opcoes.vacinas,
    p_remedios: opcoes.remedios,
    p_contatos: opcoes.contatos,
  })
  if (error) throw erroDoServidor(error)
  return data as { codigo: string; fim: string }
}

export async function revogarAcesso(id: string): Promise<void> {
  const { error } = await supabase.rpc('revogar_acesso_cuidador', { p_id: id })
  if (error) throw new Error(error.message)
}

/** Acessos ainda valendo, de qualquer pet do tutor. */
export async function acessosAtivos(): Promise<AcessoCuidador[]> {
  const { data, error } = await supabase
    .from('cuidador_acessos')
    .select('id, codigo, pet_ids, cuidador, inicio, fim, ver_vacinas, ver_remedios, ver_contatos, revogado_em, aberturas, ultima_abertura_em')
    .is('revogado_em', null)
    .gt('fim', new Date().toISOString())
    .order('criado_em', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as AcessoCuidador[]
}

export function mensagemCuidador(nomes: string, codigo: string, fim: string): string {
  return `Oi! Criei um acesso para você cuidar ${nomes} pelo PetLive: ${urlCuidador(codigo)}\n\nLá tem os remédios do dia (com o botão Feito), vacinas, alergias e contatos. Vale até ${quando(fim)}, sem precisar de conta.`
}
