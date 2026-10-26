import { Platform } from 'react-native'
import { requireOptionalNativeModule } from 'expo'
import { registerWidgetTaskHandler, requestWidgetUpdate, type WidgetTaskHandlerProps } from 'react-native-android-widget'
import { atualizarProximo, confirmarDoseWidget, conferirProximoAtual, ocultarRemedio, ultimoProximo } from './proximo'
import { WidgetProximo } from './WidgetProximo'

export const NOME_WIDGET = 'ProximaDose'

/** Busca o próximo item; sem internet, usa o último guardado no aparelho. */
async function proximoAtual() {
  try {
    return await atualizarProximo()
  } catch {
    return await ultimoProximo() ?? { tipo: 'erro' as const, mensagem: 'Não foi possível atualizar. Abra o PetLive e tente novamente.' }
  }
}

async function tratar({ widgetInfo, widgetAction, clickAction, clickActionData, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED') return
  let falha: string | null = null
  if (widgetAction === 'WIDGET_CLICK' && clickAction === 'FEITO' && clickActionData) {
    try {
      await confirmarDoseWidget(String(clickActionData.medication_id ?? ''), String(clickActionData.prevista_para ?? ''),
        typeof clickActionData.tutor_id === 'string' ? clickActionData.tutor_id : undefined)
    } catch {
      falha = 'Dose não confirmada. Abra o PetLive para conferir sua conta e conexão.'
    }
  }
  const [proximo, ocultar] = await Promise.all([proximoAtual(), ocultarRemedio()])
  const seguro = await conferirProximoAtual(proximo)
  renderWidget(<WidgetProximo proximo={falha ? { tipo: 'erro', mensagem: falha } : seguro} ocultar={ocultar} largura={widgetInfo.width} />)
}

/** Registrado no início do app (index.js), só no Android. */
export function registrarWidget() {
  if (Platform.OS !== 'android') return
  registerWidgetTaskHandler(tratar)
}

/** O app pede para redesenhar o widget quando doses, remédios ou vacinas mudam. */
async function executarAtualizacao(): Promise<void> {
  if (Platform.OS === 'ios') {
    if (!requireOptionalNativeModule('ExpoWidgets')) return
    const [{ default: widget }, { apresentarWidgetIOS }] = await Promise.all([import('./WidgetPetIOS'), import('./apresentacaoIOS')]);
    const [proximo, ocultar] = await Promise.all([proximoAtual(), ocultarRemedio()]);
    const agora = new Date();
    // Expira a fotografia antiga mesmo que o app permaneça fechado.
    widget.updateTimeline([
      { date: agora, props: apresentarWidgetIOS(await conferirProximoAtual(proximo), ocultar, agora) },
      { date: new Date(agora.getTime() + 15 * 60_000), props: apresentarWidgetIOS(null, ocultar, agora) },
    ]);
    return;
  }
  if (Platform.OS !== 'android') return
  await requestWidgetUpdate({
    widgetName: NOME_WIDGET,
    renderWidget: async (info) => {
      const [proximo, ocultar] = await Promise.all([proximoAtual(), ocultarRemedio()])
      return <WidgetProximo proximo={await conferirProximoAtual(proximo)} ocultar={ocultar} largura={info.width} />
    },
  }).catch(() => undefined)
}

let revisao = 0
let fila: Promise<void> = Promise.resolve()
export function atualizarWidget(): Promise<void> {
  const versao = ++revisao
  fila = fila.catch(() => undefined).then(async () => {
    if (versao !== revisao) return
    await executarAtualizacao()
  })
  return fila
}
