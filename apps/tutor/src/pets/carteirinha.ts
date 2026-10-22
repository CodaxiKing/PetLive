import { supabase } from '../lib/supabase'
import { emTratamentoHoje } from '../remedios/doses'
import { normalizarHorarios, type Remedio } from '../remedios/types'
import { diasAte, type Vacina } from '../saude/types'

/** Próxima vacina do pet: a dose com data mais perto (atrasadas primeiro). */
export type ProximaVacina = {
  vacina: Vacina
  dias: number
  /** Quanto do intervalo entre a aplicação e a próxima dose já passou (0 a 1). */
  fracao: number
}

export function proximaVacina(vacinas: Vacina[]): ProximaVacina | null {
  const comData = vacinas
    .map((vacina) => ({ vacina, dias: diasAte(vacina.proxima_dose) }))
    .filter((v): v is { vacina: Vacina; dias: number } => v.dias !== null)
    .sort((a, b) => a.dias - b.dias)
  const primeira = comData[0]
  if (!primeira) return null

  const intervalo = diasEntre(primeira.vacina.aplicada_em, primeira.vacina.proxima_dose ?? '')
  const fracao = intervalo > 0 ? 1 - primeira.dias / intervalo : 1
  return { ...primeira, fracao: Math.max(0, Math.min(1, fracao)) }
}

function diasEntre(deIso: string, ateIso: string): number {
  const de = new Date(`${deIso}T00:00:00`).getTime()
  const ate = new Date(`${ateIso}T00:00:00`).getTime()
  return Number.isNaN(de) || Number.isNaN(ate) ? 0 : Math.round((ate - de) / 86_400_000)
}

/** "V10 em 5 dias", "V10 hoje", "V10 atrasada há 3 dias". */
export function textoProximaVacina({ vacina, dias }: ProximaVacina): string {
  if (dias === 0) return `${vacina.nome} hoje`
  if (dias < 0) return `${vacina.nome} atrasada há ${-dias} ${-dias === 1 ? 'dia' : 'dias'}`
  return `${vacina.nome} em ${dias} ${dias === 1 ? 'dia' : 'dias'}`
}

/** Selo curto do cartão: "V10 · 5 dias". */
export function seloProximaVacina({ vacina, dias }: ProximaVacina): string {
  if (dias === 0) return `${vacina.nome} · hoje`
  if (dias < 0) return `${vacina.nome} · atrasada`
  return `${vacina.nome} · ${dias} ${dias === 1 ? 'dia' : 'dias'}`
}

/** Antirrábica aplicada e sem dose vencida: o selo verde "Antirrábica ok". */
export function antirrabicaEmDia(vacinas: Vacina[]): boolean {
  const doses = vacinas.filter((v) => /antirr[aá]bica|raiva/i.test(v.nome))
  if (doses.length === 0) return false
  return doses.some((v) => {
    const dias = diasAte(v.proxima_dose)
    return dias === null || dias >= 0
  })
}

/** Remédios em tratamento hoje (carteirinha e mensagem para o veterinário). */
export async function remediosEmUso(petId: string): Promise<Remedio[]> {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('pet_id', petId)
    .eq('ativo', true)
    .order('inicio', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as (Omit<Remedio, 'horarios'> & { horarios: (string | number)[] | null })[])
    .map((linha) => ({ ...linha, horarios: normalizarHorarios(linha.horarios) }))
    .filter(emTratamentoHoje)
}
