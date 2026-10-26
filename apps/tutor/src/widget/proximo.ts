import AsyncStorage from '@react-native-async-storage/async-storage'
import { criarClienteTemporario, supabase } from '../lib/supabase'

/**
 * Widget da tela inicial (BUSINESS.md 5.34): a próxima dose de remédio (com o
 * botão Feito) ou, sem remédio nas próximas 24 horas, a próxima vacina. O app
 * guarda o último resultado no aparelho para o widget desenhar sem internet.
 */
export type Proximo = (
  | { tipo: 'dose'; pet: string; pet_id: string; remedio: string; dose: string; medication_id: string; prevista_para: string }
  | { tipo: 'vacina'; pet: string; pet_id: string; vacina: string; data: string }
  | { tipo: 'nada' }
  | { tipo: 'sem_conta' }
  | { tipo: 'erro'; mensagem: string }
) & { tutor_id?: string; offline?: boolean }

type Remedio = { id: string; pet_id: string; nome: string; dose: string; horarios: string[] | null; inicio: string; fim: string | null; pets: { nome: string } | null }
type Vacina = { pet_id: string; nome: string; proxima_dose: string; pets: { nome: string } | null }

export const CHAVE_WIDGET = 'petlive-widget-proximo'
export const CHAVE_OCULTAR = 'petlive-widget-ocultar-remedio'
const chaveConta = (tutor: string) => `${CHAVE_WIDGET}:v2:${tutor}`
const VALIDADE_CACHE = 15 * 60_000
// Impede reapresentar uma dose confirmada caso o armazenamento esteja indisponível.
const cachesInvalidados = new Set<string>()
let revisaoDoses = 0

async function sessaoAtual() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error('Não foi possível conferir a conta do widget.')
  return data.session
}

async function conferirConta(tutor: string) {
  if ((await sessaoAtual())?.user.id !== tutor) throw new Error('A conta mudou. Abra o PetLive para atualizar o widget.')
}

export async function conferirProximoAtual(proximo: Proximo | null): Promise<Proximo | null> {
  try {
    const tutor = (await sessaoAtual())?.user.id;
    if (!tutor) return { tipo: 'sem_conta' };
    if (proximo?.tutor_id && proximo.tutor_id !== tutor) return null;
    return proximo;
  } catch { return null; }
}

/** Remove também o formato antigo, que não identificava o titular. */
export async function limparCacheWidget(tutor?: string): Promise<void> {
  await AsyncStorage.removeItem(CHAVE_WIDGET)
  if (tutor) await AsyncStorage.removeItem(chaveConta(tutor))
}

const diaIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Inclui ontem para preservar as doses atrasadas na virada do dia. */
export function dosesPrevistas(remedios: Remedio[], agora: Date): { quando: Date; remedio: Remedio }[] {
  const lista: { quando: Date; remedio: Remedio }[] = []
  for (const remedio of remedios) {
    for (let i = -1; i < 2; i++) {
      const dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i)
      const iso = diaIso(dia)
      if (iso < remedio.inicio || (remedio.fim && iso > remedio.fim)) continue
      for (const bruto of remedio.horarios ?? []) {
        const [h, min] = String(bruto).slice(0, 5).split(':').map(Number)
        if (!Number.isInteger(h) || !Number.isInteger(min) || h < 0 || h > 23 || min < 0 || min > 59) continue
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
  const revisao = revisaoDoses
  const sessao = await sessaoAtual()
  if (!sessao) {
    await limparCacheWidget()
    return { tipo: 'sem_conta' }
  }
  const tutor = sessao.user.id
  const cliente = criarClienteTemporario(sessao.access_token)
  const hoje = diaIso(agora)
  const inicioJanela = diaIso(new Date(agora.getTime() - 2 * 3_600_000))
  const [{ data: remedios, error: e1 }, { data: vacinas, error: e2 }] = await Promise.all([
    cliente.from('medications').select('id, pet_id, nome, dose, horarios, inicio, fim, pets(nome)').eq('ativo', true).lte('inicio', diaIso(new Date(agora.getTime() + 86_400_000))).or(`fim.is.null,fim.gte.${inicioJanela}`),
    cliente.from('vaccinations').select('pet_id, nome, proxima_dose, pets(nome)').gte('proxima_dose', hoje).order('proxima_dose').limit(5),
  ])
  if (e1 || e2) throw new Error((e1 ?? e2)!.message)
  const lista = (remedios ?? []) as unknown as Remedio[]
  const dadas = new Set<string>()
  if (lista.length) {
    const { data: confirmadas, error: erroDoses } = await cliente
      .from('medication_doses')
      .select('medication_id, prevista_para')
      .in('medication_id', lista.map((r) => r.id))
      .gte('prevista_para', new Date(agora.getTime() - 3 * 3_600_000).toISOString())
      .not('confirmada_em', 'is', null)
    if (erroDoses) throw new Error('Não foi possível conferir as doses já dadas. Abra o app para atualizar.')
    for (const d of confirmadas ?? []) dadas.add(`${d.medication_id}@${new Date(d.prevista_para).getTime()}`)
  }
  const proximo = { ...escolherProximo(lista, dadas, (vacinas ?? []) as unknown as Vacina[], agora), tutor_id: tutor }
  await conferirConta(tutor)
  if (revisao !== revisaoDoses) throw new Error('As doses mudaram. Atualize o widget.')
  await AsyncStorage.setItem(chaveConta(tutor), JSON.stringify({ tutor, atualizado: agora.getTime(), proximo }))
  if (revisao !== revisaoDoses) throw new Error('As doses mudaram. Atualize o widget.')
  cachesInvalidados.delete(tutor)
  await conferirConta(tutor)
  return proximo
}

export async function ultimoProximo(): Promise<Proximo | null> {
  try {
    const tutor = (await sessaoAtual())?.user.id
    if (!tutor) return { tipo: 'sem_conta' }
    if (cachesInvalidados.has(tutor)) return null
    const texto = await AsyncStorage.getItem(chaveConta(tutor))
    if (!texto) return null
    const cache = JSON.parse(texto)
    const idade = Date.now() - cache.atualizado
    if (cache.tutor !== tutor || cache.proximo?.tutor_id !== tutor ||
      !Number.isFinite(idade) || idade < 0 || idade > VALIDADE_CACHE ||
      !['dose', 'vacina', 'nada'].includes(cache.proximo?.tipo)) return null
    if (cache.proximo.tipo === 'dose' && (!Number.isFinite(Date.parse(cache.proximo.prevista_para)) ||
      Math.abs(Date.parse(cache.proximo.prevista_para) - Date.now()) > 24 * 3_600_000)) return null
    await conferirConta(tutor)
    return { ...cache.proximo, offline: true } as Proximo
  } catch {
    return null
  }
}

export async function ocultarRemedio(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CHAVE_OCULTAR)) === '1'
  } catch {
    return true
  }
}

export async function definirOcultarRemedio(ocultar: boolean): Promise<void> {
  await AsyncStorage.setItem(CHAVE_OCULTAR, ocultar ? '1' : '0')
}

/** Botão Feito do widget: mesma função do servidor da notificação, com origem widget. */
export async function confirmarDoseWidget(medicationId: string, previstaPara: string, tutor?: string): Promise<void> {
  const sessao = await sessaoAtual()
  if (!tutor || sessao?.user.id !== tutor) throw new Error('A conta mudou. Abra o app para confirmar a dose.')
  if (!medicationId || !Number.isFinite(Date.parse(previstaPara))) throw new Error('Dose inválida. Atualize o widget.')
  const cliente = criarClienteTemporario(sessao.access_token)
  const { error } = await cliente.rpc('registrar_dose', {
    p_medication_id: medicationId,
    p_prevista_para: previstaPara,
    p_acao: 'dei',
    p_origem: 'widget',
  })
  if (error) throw new Error(error.message)
  revisaoDoses++
  cachesInvalidados.add(tutor)
  // A gravação no servidor já ocorreu: uma falha local não desfaz a confirmação.
  await AsyncStorage.removeItem(chaveConta(tutor)).catch(() => undefined)
  await conferirConta(tutor)
}
