import { supabase } from '../lib/supabase'

/** Selos de cuidado (BUSINESS.md 5.27): sem ranking nem pontos. */
export type Selo = 'vacinas' | 'rotina' | 'peso' | 'um_ano' | 'primeira_consulta' | 'cartao_completo'

export const SELOS: { chave: Selo; rotulo: string; como: string; fundo: string }[] = [
  { chave: 'vacinas', rotulo: 'Vacinas em dia', como: 'Nenhuma vacina vencida', fundo: '#DDF3E6' },
  { chave: 'rotina', rotulo: 'Rotina em dia', como: 'Cuidados da rotina sem atraso', fundo: '#E3F3FC' },
  { chave: 'peso', rotulo: 'Peso em dia', como: 'Pesagem nos últimos 3 meses', fundo: '#FFF0C9' },
  { chave: 'um_ano', rotulo: '1 ano no app', como: 'Um ano de cuidados registrados', fundo: '#EBDDFB' },
  { chave: 'primeira_consulta', rotulo: 'Primeira consulta', como: 'Uma consulta registrada', fundo: '#FBDADF' },
  { chave: 'cartao_completo', rotulo: 'Cartão completo', como: 'Foto, dados, vacina, alergias e veterinário', fundo: '#FFE3CC' },
]

/** Recalcula no servidor e devolve os selos do pet. */
export async function conferirSelos(petId: string): Promise<Set<Selo>> {
  const { data, error } = await supabase.rpc('conferir_selos', { p_pet: petId })
  if (error) throw new Error(error.message)
  return new Set((data ?? []) as Selo[])
}
