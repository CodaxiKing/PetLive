import * as Notifications from 'expo-notifications'
import * as TaskManager from 'expo-task-manager'
import { tratarRespostaDose } from './doses'

/**
 * Tarefa de segundo plano dos botões Feito e Adiar. No Android ela roda ao
 * tocar no botão com o app em segundo plano ou fechado; com o app aberto,
 * quem trata é o listener do layout raiz. Precisa ser definida no escopo do
 * módulo, num arquivo carregado cedo (importado por app/_layout.tsx).
 */
export const TAREFA_DOSE = 'petlive-tarefa-dose'

TaskManager.defineTask<Notifications.NotificationTaskPayload>(TAREFA_DOSE, async ({ data, error }) => {
  if (error || !data || !('actionIdentifier' in data)) return
  await tratarRespostaDose(data as Notifications.NotificationResponse).catch(() => undefined)
})

export async function registrarTarefaDose(): Promise<void> {
  await Notifications.registerTaskAsync(TAREFA_DOSE)
}
