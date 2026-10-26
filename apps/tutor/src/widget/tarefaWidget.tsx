import { Platform } from 'react-native'
import { registerWidgetTaskHandler, requestWidgetUpdate, type WidgetTaskHandlerProps } from 'react-native-android-widget'
import { atualizarProximo, confirmarDoseWidget, ocultarRemedio, ultimoProximo } from './proximo'
import { WidgetProximo } from './WidgetProximo'

export const NOME_WIDGET = 'ProximaDose'

/** Busca o próximo item; sem internet, usa o último guardado no aparelho. */
async function proximoAtual() {
  try {
    return await atualizarProximo()
  } catch {
    return ultimoProximo()
  }
}

async function tratar({ widgetInfo, widgetAction, clickAction, clickActionData, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED') return
  if (widgetAction === 'WIDGET_CLICK' && clickAction === 'FEITO' && clickActionData) {
    // Mostra o próximo item na hora e confirma a dose (a função do servidor ignora repetição).
    await confirmarDoseWidget(String(clickActionData.medication_id), String(clickActionData.prevista_para)).catch(() => undefined)
  }
  const [proximo, ocultar] = await Promise.all([proximoAtual(), ocultarRemedio()])
  renderWidget(<WidgetProximo proximo={proximo} ocultar={ocultar} largura={widgetInfo.width} />)
}

/** Registrado no início do app (index.js), só no Android. */
export function registrarWidget() {
  if (Platform.OS !== 'android') return
  registerWidgetTaskHandler(tratar)
}

/** O app pede para redesenhar o widget quando doses, remédios ou vacinas mudam. */
export async function atualizarWidget(): Promise<void> {
  if (Platform.OS !== 'android') return
  await requestWidgetUpdate({
    widgetName: NOME_WIDGET,
    renderWidget: async (info) => {
      const [proximo, ocultar] = await Promise.all([proximoAtual(), ocultarRemedio()])
      return <WidgetProximo proximo={proximo} ocultar={ocultar} largura={info.width} />
    },
  }).catch(() => undefined)
}
