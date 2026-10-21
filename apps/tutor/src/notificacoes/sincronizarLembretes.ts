import type { Lembrete } from '../lembretes/types'
import { ROTULO_TIPO } from '../lembretes/types'
import { agendarLocal, cancelarLocal, contarAgendadas } from './notificacoes'
import { HORARIO_PADRAO, preferenciasAvisos } from './prefs'

/** Prefixo dos ids que criamos, para não mexer nas notificações de terceiros. */
const PREFIXO = 'petlive-lembrete-'

/** Dias de antecedência em que o aviso dispara (às 9h do dia anterior-ish). */
const ANTECEDENCIA_DIAS = 1

/**
 * Reconstrói as notificações locais a partir da lista de lembretes.
 *
 * Chame depois de criar, concluir ou remover um lembrete. Como usamos o id
 * do lembrete como identificador da notificação, reagendar substitui a
 * antiga em vez de duplicar.
 *
 * Retorna quantas notificações ficaram agendadas.
 */
export async function sincronizarLembretes(lembretes: Lembrete[]): Promise<number> {
  // Tela Avisos: tipos desligados não agendam e o horário vem da preferência.
  const avisos = await preferenciasAvisos().catch(() => null)

  // Cancela só as nossas; deixa as outras notificações do aparelho em paz.
  const agendadas = await listarAgendadas()
  for (const identificador of agendadas) {
    if (identificador.startsWith(PREFIXO)) {
      await cancelarLocal(identificador)
    }
  }

  const futuros = lembretes.filter(
    (lembrete) =>
      lembrete.ativo &&
      lembrete.aviso_antes !== false &&
      avisos?.ativos[lembrete.tipo] !== false,
  )

  for (const lembrete of futuros) {
    const quando = calcularDisparo(lembrete, avisos?.horario ?? HORARIO_PADRAO)
    if (!quando) continue

    await agendarLocal(
      tituloDe(lembrete),
      corpoDe(lembrete),
      quando,
      { identificador: `${PREFIXO}${lembrete.id}`, url: '/lembretes' },
    )
  }

  return contarAgendadas()
}

/**
 * Quando o aviso deve tocar: 1 dia antes, na "Hora dos avisos" (padrão 9h).
 * Se já passou (lembrete de hoje ou atrasado), agenda para daqui a 1 minuto
 * para o usuário receber o feedback imediato.
 */
function calcularDisparo(lembrete: Lembrete, horaAvisos: string): Date | null {
  const alvo = new Date(lembrete.proxima_em)
  if (Number.isNaN(alvo.getTime())) return null

  const disparo = new Date(alvo)
  disparo.setDate(disparo.getDate() - ANTECEDENCIA_DIAS)
  const [hora, minuto] = horaAvisos.split(':').map(Number)
  disparo.setHours(hora ?? 9, minuto ?? 0, 0, 0)

  const agora = Date.now()
  if (disparo.getTime() <= agora) {
    return new Date(agora + 60_000)
  }
  return disparo
}

function tituloDe(lembrete: Lembrete): string {
  const tipo = ROTULO_TIPO[lembrete.tipo] ?? 'Lembrete'
  return `${tipo}: ${lembrete.titulo}`
}

function corpoDe(lembrete: Lembrete): string {
  const quando = new Date(lembrete.proxima_em)
  if (Number.isNaN(quando.getTime())) return 'Confira os detalhes no app.'

  const dia = quando.getDate()
  const mes = quando.getMonth() + 1
  const hora = String(quando.getHours()).padStart(2, '0')
  const minuto = String(quando.getMinutes()).padStart(2, '0')
  return `Em ${dia}/${mes} às ${hora}:${minuto}. Toque para ver o lembrete.`
}

/** Ids de todas as notificações agendadas neste aparelho. */
async function listarAgendadas(): Promise<string[]> {
  const { getAllScheduledNotificationsAsync } = await import('expo-notifications')
  const todas = await getAllScheduledNotificationsAsync()
  return todas.map((n) => n.identifier)
}

/** Cancela a notificação de um lembrete específico. */
export async function cancelarLembrete(lembreteId: string): Promise<void> {
  await cancelarLocal(`${PREFIXO}${lembreteId}`)
}

/** Reagenda só um lembrete (usado ao criar/editar). */
export async function agendarUmLembrete(lembrete: Lembrete): Promise<void> {
  const avisos = await preferenciasAvisos().catch(() => null)

  // Desligado na tela Avisos, sem "Avisar 1 dia antes" ou lembrete inativo:
  // nada agendado.
  if (!lembrete.ativo || lembrete.aviso_antes === false || avisos?.ativos[lembrete.tipo] === false) {
    await cancelarLembrete(lembrete.id)
    return
  }
  const quando = calcularDisparo(lembrete, avisos?.horario ?? HORARIO_PADRAO)
  if (!quando) return

  await agendarLocal(tituloDe(lembrete), corpoDe(lembrete), quando, {
    identificador: `${PREFIXO}${lembrete.id}`,
    url: '/lembretes',
  })
}
