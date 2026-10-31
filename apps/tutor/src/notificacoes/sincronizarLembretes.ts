import type { Lembrete } from '../lembretes/types'
import { ROTULO_TIPO } from '../lembretes/types'
import { agendarLocal, cancelarLocal, contarAgendadas } from './notificacoes'
import { momentosDoAviso } from './antecedencia'
import { preferenciasAvisos } from './prefs'

/** Prefixo dos ids que criamos, para não mexer nas notificações de terceiros. */
const PREFIXO = 'petlive-lembrete-'

/**
 * Reconstrói as notificações locais a partir da lista de lembretes.
 *
 * Chame depois de criar, concluir ou remover um lembrete. Cada aviso do
 * lembrete usa o id dele mais a ordem do aviso (vacina: 1 dia e 2 horas
 * antes), então reagendar substitui os antigos em vez de duplicar.
 *
 * Retorna quantas notificações ficaram agendadas.
 */
export async function sincronizarLembretes(lembretes: Lembrete[]): Promise<number> {
  // Tela Avisos: tipos desligados não agendam; a antecedência vem do tipo.
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

  for (const lembrete of futuros) await agendarAvisos(lembrete)

  return contarAgendadas()
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

/** Agenda os avisos de um lembrete, um por antecedência do tipo. */
async function agendarAvisos(lembrete: Lembrete): Promise<void> {
  const momentos = momentosDoAviso(lembrete.tipo, lembrete.proxima_em)
  for (const [i, quando] of momentos.entries()) {
    await agendarLocal(tituloDe(lembrete), corpoDe(lembrete), quando, {
      identificador: `${PREFIXO}${lembrete.id}-${i}`,
      url: '/lembretes',
    })
  }
}

/** Cancela os avisos de um lembrete específico (todas as antecedências). */
export async function cancelarLembrete(lembreteId: string): Promise<void> {
  for (const identificador of await listarAgendadas()) {
    if (identificador.startsWith(`${PREFIXO}${lembreteId}`)) await cancelarLocal(identificador)
  }
}

/** Reagenda só um lembrete (usado ao criar/editar). */
export async function agendarUmLembrete(lembrete: Lembrete): Promise<void> {
  const avisos = await preferenciasAvisos().catch(() => null)

  // Troca os avisos antigos deste lembrete pelos novos.
  await cancelarLembrete(lembrete.id)
  // Desligado na tela Avisos ou lembrete inativo: nada agendado.
  if (!lembrete.ativo || lembrete.aviso_antes === false || avisos?.ativos[lembrete.tipo] === false) return
  await agendarAvisos(lembrete)
}
