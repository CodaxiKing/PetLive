import { FlexWidget, TextWidget } from 'react-native-android-widget'
import { textoData, textoHorario, type Proximo } from './proximo'

/**
 * Widget "Próxima dose" (protótipo Widget, BUSINESS.md 5.34): fundo pastel
 * com o pet, o que vem a seguir e o botão Feito para a dose. Com "esconder o
 * nome do remédio" ligado, aparece só "Remédio" (tela bloqueada).
 */
const COR = { fundo: '#FDE0E6', fundoVacina: '#E0F1FA', texto: '#17212F', apoio: '#566070', botao: '#17212F', branco: '#FFFFFF' } as const

export function WidgetProximo({ proximo, ocultar, agora = new Date(), largura = 250 }: { proximo: Proximo | null; ocultar: boolean; agora?: Date; largura?: number }) {
  const estreito = largura < 200
  if (!proximo || proximo.tipo === 'sem_conta' || proximo.tipo === 'nada' || proximo.tipo === 'erro') {
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        accessibilityLabel="Abrir o PetLive"
        style={{ height: 'match_parent', width: 'match_parent', backgroundColor: COR.fundoVacina, borderRadius: 24, padding: 14, justifyContent: 'center' }}
      >
        <TextWidget text="PetLive" style={{ fontSize: 12, color: COR.apoio, fontWeight: '700' }} />
        <TextWidget
          text={!proximo ? 'Abra o app para atualizar' : proximo.tipo === 'erro' ? proximo.mensagem : proximo.tipo === 'sem_conta' ? 'Entre no app para ver a próxima dose' : proximo.offline ? 'Sem conexão. Abra o app para atualizar.' : 'Nada para hoje. Tudo em dia!'}
          maxLines={2}
          style={{ fontSize: 15, color: COR.texto, fontWeight: '700', marginTop: 4 }}
        />
      </FlexWidget>
    )
  }

  if (proximo.tipo === 'vacina') {
    return (
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: `petlive://pet/${proximo.pet_id}` }}
        accessibilityLabel={`Próxima vacina de ${proximo.pet}: ${proximo.vacina}, ${textoData(proximo.data, agora)}`}
        style={{ height: 'match_parent', width: 'match_parent', backgroundColor: COR.fundoVacina, borderRadius: 24, padding: 14, justifyContent: 'center' }}
      >
        <TextWidget text={`${proximo.pet} · próxima vacina`} maxLines={1} truncate="END" style={{ fontSize: 12, color: COR.apoio, fontWeight: '700' }} />
        <TextWidget text={proximo.vacina} maxLines={1} truncate="END" style={{ fontSize: 18, color: COR.texto, fontWeight: '800', marginTop: 2 }} />
        <TextWidget text={textoData(proximo.data, agora)} style={{ fontSize: 13, color: COR.texto, marginTop: 2 }} />
      </FlexWidget>
    )
  }

  const remedio = ocultar ? 'Remédio' : proximo.remedio
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: `petlive://pet/${proximo.pet_id}/medicamentos` }}
      accessibilityLabel={`Próxima dose de ${proximo.pet}: ${remedio}, ${textoHorario(proximo.prevista_para, agora)}`}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: COR.fundo, borderRadius: 24, padding: 14, flexDirection: estreito ? 'column' : 'row', alignItems: estreito ? 'flex-start' : 'center' }}
    >
      <FlexWidget style={{ flex: 1, width: estreito ? 'match_parent' : 'wrap_content' }}>
        <TextWidget text={`${proximo.pet} · ${textoHorario(proximo.prevista_para, agora)}`} maxLines={1} truncate="END" style={{ fontSize: 12, color: COR.apoio, fontWeight: '700' }} />
        <TextWidget text={remedio} maxLines={1} truncate="END" style={{ fontSize: 18, color: COR.texto, fontWeight: '800', marginTop: 2 }} />
        {!ocultar && proximo.dose ? <TextWidget text={proximo.dose} maxLines={1} truncate="END" style={{ fontSize: 13, color: COR.texto, marginTop: 2 }} /> : null}
      </FlexWidget>
      <FlexWidget
        clickAction={proximo.offline || !proximo.tutor_id ? 'OPEN_APP' : 'FEITO'}
        clickActionData={{ medication_id: proximo.medication_id, prevista_para: proximo.prevista_para, tutor_id: proximo.tutor_id ?? '' }}
        accessibilityLabel={proximo.offline ? 'Sem conexão: abrir o app para conferir a dose' : 'Feito: marcar a dose como dada'}
        style={{ backgroundColor: COR.botao, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, marginLeft: estreito ? 0 : 10, marginTop: estreito ? 8 : 0 }}
      >
        <TextWidget text={proximo.offline || !proximo.tutor_id ? 'Ver no app' : 'Feito'} style={{ fontSize: 14, color: COR.branco, fontWeight: '700' }} />
      </FlexWidget>
    </FlexWidget>
  )
}
