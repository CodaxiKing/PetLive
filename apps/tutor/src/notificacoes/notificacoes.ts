import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

/**
 * Camada de notificações locais do PetLive.
 *
 * Notificações remotas (push) exigem um development build a partir do
 * SDK 53 no Android; as locais continuam funcionando no Expo Go, que é o
 * que usamos para agendar os lembretes no aparelho.
 */

/** Canal padrão no Android. Sem canal, o pedido de permissão não aparece. */
const CANAL_PADRAO = 'lembretes'

/**
 * Como o app se comporta quando uma notificação chega em primeiro plano.
 * `shouldShowBanner`/`shouldShowList` substituíram `shouldShow` no SDK 52+.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

/** Cria o canal Android (no-op no iOS). Necessário antes de pedir permissão. */
export async function garantirCanal(): Promise<void> {
  if (Platform.OS !== 'android') return

  await Notifications.setNotificationChannelAsync(CANAL_PADRAO, {
    name: 'Lembretes de saúde',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#9AD6F8',
    sound: 'default',
  })
}

export type PermissaoNotificacoes = 'concedida' | 'negada' | 'indefinida'

/**
 * Pede a permissão de notificação. Cria o canal antes (Android) e devolve
 * o estado para a UI decidir se mostra o convite.
 */
export async function pedirPermissao(): Promise<PermissaoNotificacoes> {
  await garantirCanal()

  const atual = await Notifications.getPermissionsAsync()
  if (atual.granted) return 'concedida'

  // iOS 12+ pode conceder provisoriamente sem diálogo; conta como sim.
  if (atual.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return 'concedida'
  }

  if (!atual.canAskAgain) return 'negada'

  const pedido = await Notifications.requestPermissionsAsync()
  return pedido.granted ? 'concedida' : 'negada'
}

export async function permissaoConcedida(): Promise<boolean> {
  const atual = await Notifications.getPermissionsAsync()
  return (
    atual.granted ||
    atual.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  )
}

/**
 * Agenda uma notificação local única em `data`.
 *
 * `identificador` é opcional e, quando passado, vira o id da notificação —
 * usamos o id do lembrete para reagendar/cancelar sem duplicar.
 * O id do registro também vai em `data.url` para o toque abrir a tela certa.
 */
export async function agendarLocal(
  titulo: string,
  corpo: string,
  quando: Date,
  opcoes?: { url?: string; identificador?: string },
) {
  // Datas no passado não agenda; ignora em vez de lançar.
  if (quando.getTime() <= Date.now()) return null

  return Notifications.scheduleNotificationAsync({
    identifier: opcoes?.identificador,
    content: {
      title: titulo,
      body: corpo,
      sound: 'default',
      data: opcoes?.url ? { url: opcoes.url } : {},
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: quando,
      channelId: CANAL_PADRAO,
    },
  })
}

/** Cancela uma notificação agendada pelo identificador. */
export async function cancelarLocal(identificador: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identificador)
  } catch {
    // Já cancelada ou apagada pelo sistema; não precisa propagar.
  }
}

/** Apaga todas as notificações agendadas neste aparelho. */
export async function cancelarTodas(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync()
}

/** Mostra na hora (uso em teste e em "enviar agora"). */
export async function mostrarAgora(titulo: string, corpo: string, url?: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title: titulo, body: corpo, data: url ? { url } : {} },
    trigger: null,
  })
}

/** Quantas notificações estão agendadas neste aparelho. */
export async function contarAgendadas(): Promise<number> {
  const agendadas = await Notifications.getAllScheduledNotificationsAsync()
  return agendadas.length
}
