import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'

/**
 * Widget da tela inicial (BUSINESS.md 5.34): a próxima dose de remédio (com o
 * botão Feito) ou, sem remédio nas próximas 24 horas, a próxima vacina. O app
 * guarda o último resultado no aparelho para o widget desenhar sem internet.
 */
export type Proximo =
  | { tipo: 'dose'; pet: string; pet_id: string; remedio: string; dose: string; medication_id: string; prevista_para: string }
  | { tipo: 'vacina'; pet: string; pet_id: string; vacina: string; data: string }
  | { tipo: 'nada' }
  | { tipo: 'sem_conta' }

type Remedio = { id: string; pet_id: string; nome: string; dose: string; horarios: string[] | null; inicio: string; fim: string | null; pets: { nome: string } | null }
type Vacina = { pet_id: string; nome: string; proxima_dose: string; pets: { nome: string } | null }

export const CHAVE_WIDGET = 'petlive-widget-proximo'
export const CHAVE_OCULTAR = 'petlive-widget-ocultar-remedio'

const diaIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Próximas doses (hoje e amanhã) a partir dos horários dos remédios ativos. */
export function dosesPrevistas(remedios: Remedio[], agora: Date): { quando: Date; remedio: Remedio }[] {
  const lista: { quando: Date; remedio: Remedio }[] = []
  for (const remedio of remedios) {
    for (let i = 0; i < 2; i++) {
      const dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i)
      const iso = diaIso(dia)
      if (iso < remedio.inicio || (remedio.fim && iso > remedio.fim)) continue
      for (const bruto of remedio.horarios ?? []) {
        const [h, min] = String(bruto).slice(0, 5).split(':').map(Number)
        if (Number.isNaN(h) || Number.isNaN(min)) continue
        lista.push({ quando: new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, min), remedio })
      }
    }
  }
  return lista.sort((a, b) => a.quando.getTime() - b.quando.getTime())
}

/**
 * Escolhe o que mostrar: a dose mais antiga ainda não dada (até 2 horas de
 * atraso) ou a próxima dentro de 24 horas; senão, a próxima vacina.
 */
export function escolherProximo(remedios: Remedio[], dadas: Set<string>, vacinas: Vacina[], agora: Date): Proximo {
  const limite = agora.getTime() + 24 * 3_600_000
  const atraso = agora.getTime() - 2 * 3_600_000
  const dose = dosesPrevistas(remedios, agora).find(
    ({ quando, remedio }) => quando.getTime() >= atraso && quando.getTime() <= limite && !dadas.has(`${remedio.id}@${quando.getTime()}`),
  )
  if (dose) {
    return {
      tipo: 'dose',
      pet: dose.remedio.pets?.nome ?? 'Seu pet',
      pet_id: dose.remedio.pet_id,
      remedio: dose.remedio.nome,
      dose: dose.remedio.dose,
      medication_id: dose.remedio.id,
      prevista_para: dose.quando.toISOString(),
    }
  }
  const vacina = [...vacinas].filter((v) => v.proxima_dose >= diaIso(agora)).sort((a, b) => a.proxima_dose.localeCompare(b.proxima_dose))[0]
  if (vacina) return { tipo: 'vacina', pet: vacina.pets?.nome ?? 'Seu pet', pet_id: vacina.pet_id, vacina: vacina.nome, data: vacina.proxima_dose }
  return { tipo: 'nada' }
}

/** "às 14:00", "amanhã às 08:00", "atrasada (14:00)". */
export function textoHorario(iso: string, agora: Date): string {
  const quando = new Date(iso)
  const hora = `${String(quando.getHours()).padStart(2, '0')}:${String(quando.getMinutes()).padStart(2, '0')}`
  if (quando.getTime() < agora.getTime()) return `atrasada (${hora})`
  return diaIso(quando) === diaIso(agora) ? `às ${hora}` : `amanhã às ${hora}`
}

/** "hoje", "amanhã", "em 5 dias", "em 12/03". */
export function textoData(iso: string, agora: Date): string {
  const dias = Math.round((new Date(`${iso}T12:00:00`).getTime() - new Date(`${diaIso(agora)}T12:00:00`).getTime()) / 86_400_000)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  if (dias <= 30) return `em ${dias} dias`
  return `em ${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

/** Busca no servidor (com a sessão guardada no aparelho) e guarda o resultado. */
export async function atualizarProximo(agora = new Date()): Promise<Proximo> {
  const { data: sessao } = await supabase.auth.getSession()
  if (!sessao.session) {
    await AsyncStorage.setItem(CHAVE_WIDGET, JSON.stringify({ tipo: 'sem_conta' })).catch(() => undefined)
    return { tipo: 'sem_conta' }
  }
  const hoje = diaIso(agora)
  const [{ data: remedios, error: e1 }, { data: vacinas, error: e2 }] = await Promise.all([
    supabase.from('medications').select('id, pet_id, nome, dose, horarios, inicio, fim, pets(nome)').eq('ativo', true).lte('inicio', diaIso(new Date(agora.getTime() + 86_400_000))).or(`fim.is.null,fim.gte.${hoje}`),
    supabase.from('vaccinations').select('pet_id, nome, proxima_dose, pets(nome)').gte('proxima_dose', hoje).order('proxima_dose').limit(5),
  ])
  if (e1 || e2) throw new Error((e1 ?? e2)!.message)
  const lista = (remedios ?? []) as unknown as Remedio[]
  const dadas = new Set<string>()
  if (lista.length) {
    const { data: confirmadas } = await supabase
      .from('medication_doses')
      .select('medication_id, prevista_para')
      .in('medication_id', lista.map((r) => r.id))
      .gte('prevista_para', new Date(agora.getTime() - 3 * 3_600_000).toISOString())
      .not('confirmada_em', 'is', null)
    for (const d of confirmadas ?? []) dadas.add(`${d.medication_id}@${new Date(d.prevista_para).getTime()}`)
  }
  const proximo = escolherProximo(lista, dadas, (vacinas ?? []) as unknown as Vacina[], agora)
  await AsyncStorage.setItem(CHAVE_WIDGET, JSON.stringify(proximo)).catch(() => undefined)
  return proximo
}

export async function ultimoProximo(): Promise<Proximo | null> {
  try {
    const texto = await AsyncStorage.getItem(CHAVE_WIDGET)
    return texto ? (JSON.parse(texto) as Proximo) : null
  } catch {
    return null
  }
}

export async function ocultarRemedio(): Promise<boolean> {
  return (await AsyncStorage.getItem(CHAVE_OCULTAR).catch(() => null)) === '1'
}

export async function definirOcultarRemedio(ocultar: boolean): Promise<void> {
  await AsyncStorage.setItem(CHAVE_OCULTAR, ocultar ? '1' : '0')
}

/** Botão Feito do widget: mesma função do servidor da notificação, com origem widget. */
export async function confirmarDoseWidget(medicationId: string, previstaPara: string): Promise<void> {
  const { error } = await supabase.rpc('registrar_dose', {
    p_medication_id: medicationId,
    p_prevista_para: previstaPara,
    p_acao: 'dei',
    p_origem: 'widget',
  })
  if (error) throw new Error(error.message)
}
