import { Share } from 'react-native'
import { supabase } from '../lib/supabase'
import { emTratamentoHoje } from '../remedios/doses'
import { normalizarHorarios, type Remedio } from '../remedios/types'
import { dataParaExibicao, diasAte, type Vacina } from '../saude/types'
import { idadeEmAnos, type Pet } from './types'

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

/**
 * Carteirinha em texto, para o menu de compartilhar do sistema (BUSINESS.md:
 * sem depender de API do WhatsApp). A carteira em PDF fica para a Fase 2.
 */
export function textoCarteirinha(pet: Pet, vacinas: Vacina[], remedios: Remedio[]): string {
  const especie = pet.especie === 'gato' ? 'Gato' : 'Cão'
  const dados = [
    [especie, pet.raca].filter(Boolean).join(' · '),
    idadeEmAnos(pet.nascimento),
    pet.sexo ? (pet.sexo === 'femea' ? 'Fêmea' : 'Macho') : null,
    pet.peso_atual ? `${String(pet.peso_atual).replace('.', ',')} kg` : null,
    pet.castrado === null ? null : pet.castrado ? 'Castrado' : 'Não castrado',
  ].filter(Boolean)

  const linhas = [`Carteirinha de ${pet.nome} (PetLive)`, dados.join(' · ')]

  if (vacinas.length > 0) {
    linhas.push('', 'Vacinas:')
    for (const v of vacinas) {
      const proxima = v.proxima_dose ? ` · próxima ${dataParaExibicao(v.proxima_dose)}` : ''
      linhas.push(`- ${v.nome}: aplicada ${dataParaExibicao(v.aplicada_em)}${proxima}`)
    }
  }
  if (remedios.length > 0) {
    linhas.push('', 'Remédios em uso:')
    for (const r of remedios) linhas.push(`- ${r.nome}: ${[r.dose, r.frequencia].filter(Boolean).join(', ')}`)
  }
  return linhas.join('\n')
}

/** Abre o menu de compartilhar com a carteirinha em texto. */
export async function compartilharCarteirinha(pet: Pet, vacinas: Vacina[]): Promise<void> {
  const remedios = await remediosEmUso(pet.id).catch(() => [] as Remedio[])
  await Share.share({
    title: `Carteirinha de ${pet.nome}`,
    message: textoCarteirinha(pet, vacinas, remedios),
  }).catch(() => undefined)
}
