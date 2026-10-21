import * as Notifications from 'expo-notifications'
import { supabase } from '../lib/supabase'
import { CANAL_PADRAO, cancelarLocal } from './notificacoes'
import { preferenciasAvisos } from './prefs'

/**
 * Notificação da dose com os botões Feito e Adiar 15 min (BUSINESS.md 5.34 e
 * fluxo 19.25). As doses dos próximos dias são agendadas no aparelho; o
 * toque no botão chama `registrar_dose` sem abrir o app.
 */

/** Sem ":" nem "-" no identificador da categoria (exigência da lib). */
export const CATEGORIA_DOSE = 'dose'
const ACAO_DEI = 'dei'
const ACAO_ADIAR = 'adiar'

const PREFIXO = 'petlive-dose-'
/** Quantos dias à frente agendar: renova a cada abertura do app. */
const DIAS_A_FRENTE = 3
/** O iOS guarda até 64 agendadas por app; o resto fica para os lembretes. */
const LIMITE_AGENDADAS = 40
const ADIAR_MINUTOS = 15

type DadosDose = {
  tipo: 'dose'
  medication_id: string
  /** Instante previsto da dose (ISO UTC), chave da linha em medication_doses. */
  prevista_para: string
  url: string
}

type RemedioComPet = {
  id: string
  pet_id: string
  nome: string
  dose: string
  horarios: (string | number)[] | null
  inicio: string
  fim: string | null
  pets: { nome: string } | null
}

/** Registra os botões da notificação. Chamar uma vez ao abrir o app. */
export async function registrarCategoriaDose(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(CATEGORIA_DOSE, [
    { identifier: ACAO_DEI, buttonTitle: 'Feito', options: { opensAppToForeground: false } },
    {
      identifier: ACAO_ADIAR,
      buttonTitle: `Adiar ${ADIAR_MINUTOS} min`,
      options: { opensAppToForeground: false },
    },
  ])
}

const p2 = (n: number) => String(n).padStart(2, '0')

function diaIso(data: Date): string {
  return `${data.getFullYear()}-${p2(data.getMonth() + 1)}-${p2(data.getDate())}`
}

function conteudo(titulo: string, corpo: string, dados: DadosDose): Notifications.NotificationContentInput {
  return { title: titulo, body: corpo, sound: 'default', categoryIdentifier: CATEGORIA_DOSE, data: dados }
}

/**
 * Refaz as notificações das doses dos próximos dias de todos os remédios
 * ativos do tutor. Doses já dadas não são avisadas. Respeita o tipo
 * "Remédios" da tela Avisos.
 */
export async function sincronizarDoses(): Promise<number> {
  const agendadas = await Notifications.getAllScheduledNotificationsAsync()
  for (const n of agendadas) {
    // Os adiamentos ("-adiada") continuam: são de uma dose que já tocou.
    if (n.identifier.startsWith(PREFIXO) && !n.identifier.endsWith('-adiada')) {
      await cancelarLocal(n.identifier)
    }
  }

  const avisos = await preferenciasAvisos().catch(() => null)
  if (avisos?.ativos.remedio === false) return 0

  const hoje = diaIso(new Date())
  const { data, error } = await supabase
    .from('medications')
    .select('id, pet_id, nome, dose, horarios, inicio, fim, pets(nome)')
    .eq('ativo', true)
    .lte('inicio', diaIso(new Date(Date.now() + DIAS_A_FRENTE * 86_400_000)))
    .or(`fim.is.null,fim.gte.${hoje}`)
  if (error) throw new Error(error.message)
  const remedios = (data ?? []) as unknown as RemedioComPet[]

  const agora = Date.now()
  const doses: { quando: Date; remedio: RemedioComPet }[] = []
  for (const remedio of remedios) {
    for (let i = 0; i < DIAS_A_FRENTE; i++) {
      const dia = new Date()
      dia.setDate(dia.getDate() + i)
      const iso = diaIso(dia)
      if (iso < remedio.inicio || (remedio.fim && iso > remedio.fim)) continue
      for (const bruto of remedio.horarios ?? []) {
        const [h, min] = String(bruto).slice(0, 5).split(':').map(Number)
        const quando = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, min, 0, 0)
        if (quando.getTime() > agora) doses.push({ quando, remedio })
      }
    }
  }
  doses.sort((a, b) => a.quando.getTime() - b.quando.getTime())

  // Doses que já foram dadas (pelo app, antes da hora) não tocam.
  const dadas = new Set<string>()
  if (doses.length) {
    const { data: confirmadas } = await supabase
      .from('medication_doses')
      .select('medication_id, prevista_para')
      .in('medication_id', remedios.map((r) => r.id))
      .gte('prevista_para', new Date(agora).toISOString())
      .not('confirmada_em', 'is', null)
    for (const linha of confirmadas ?? []) {
      dadas.add(`${linha.medication_id}@${new Date(linha.prevista_para).getTime()}`)
    }
  }

  let total = 0
  for (const { quando, remedio } of doses) {
    if (total >= LIMITE_AGENDADAS) break
    if (dadas.has(`${remedio.id}@${quando.getTime()}`)) continue
    const pet = remedio.pets?.nome ?? 'seu pet'
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIXO}${remedio.id}-${quando.getTime()}`,
      content: conteudo(`Hora do remédio do ${pet}`, `${remedio.nome} · ${remedio.dose}`, {
        tipo: 'dose',
        medication_id: remedio.id,
        prevista_para: quando.toISOString(),
        url: `/pet/${remedio.pet_id}/medicamentos`,
      }),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: quando, channelId: CANAL_PADRAO },
    })
    total++
  }
  return total
}

function ehDose(dados: unknown): dados is DadosDose {
  return typeof dados === 'object' && dados !== null && (dados as { tipo?: unknown }).tipo === 'dose'
}

/**
 * Trata o toque em Feito ou Adiar. Devolve true quando era um botão da dose
 * (o chamador não navega). Usado pelo listener com o app aberto e pela
 * tarefa de segundo plano; a função do servidor é idempotente.
 */
export async function tratarRespostaDose(resposta: Notifications.NotificationResponse): Promise<boolean> {
  const { actionIdentifier, notification } = resposta
  const dados = notification.request.content.data
  if (!ehDose(dados) || (actionIdentifier !== ACAO_DEI && actionIdentifier !== ACAO_ADIAR)) return false

  const { error } = await supabase.rpc('registrar_dose', {
    p_medication_id: dados.medication_id,
    p_prevista_para: dados.prevista_para,
    p_acao: actionIdentifier,
    p_origem: 'notificacao',
  })

  const idAdiada = `${PREFIXO}${dados.medication_id}-${new Date(dados.prevista_para).getTime()}-adiada`
  if (actionIdentifier === ACAO_ADIAR) {
    // Mesmo sem rede o adiamento vale: a nova notificação é só do aparelho.
    await Notifications.scheduleNotificationAsync({
      identifier: idAdiada,
      content: conteudo(
        notification.request.content.title ?? 'Hora do remédio',
        notification.request.content.body ?? '',
        dados,
      ),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + ADIAR_MINUTOS * 60_000),
        channelId: CANAL_PADRAO,
      },
    })
  } else {
    await cancelarLocal(idAdiada)
  }

  await Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => undefined)
  if (error) throw new Error(error.message)
  return true
}
