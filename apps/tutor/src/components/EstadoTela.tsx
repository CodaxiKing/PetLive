import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme/colors'
import { fontFamily } from '../theme/typography'
import { BotaoPrimario } from './BotaoPrimario'

type Props =
  | { tipo: 'carregando'; texto?: string }
  | { tipo: 'erro'; texto: string; onTentar: () => void }
  | { tipo: 'vazio'; titulo: string; texto?: string; acao?: { titulo: string; onPress: () => void } }

/**
 * Os três estados de uma tela que busca dados: carregando, erro com "Tentar
 * de novo" e vazio com o próximo passo. Nenhuma tela fica girando sem dizer
 * o que aconteceu.
 */
export function EstadoTela(p: Props) {
  if (p.tipo === 'carregando') {
    return (
      <View style={s.centro} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.primaryDeep} accessibilityLabel={p.texto ?? 'Carregando'} />
        {p.texto ? <Text style={s.texto}>{p.texto}</Text> : null}
      </View>
    )
  }
  if (p.tipo === 'erro') {
    return (
      <View style={s.centro}>
        <Text style={s.titulo}>Não deu para abrir</Text>
        <Text style={s.texto} accessibilityRole="alert">
          {p.texto}
        </Text>
        <BotaoPrimario titulo="Tentar de novo" estilo={s.botao} onPress={p.onTentar} />
      </View>
    )
  }
  return (
    <View style={s.centro}>
      <Text style={s.titulo}>{p.titulo}</Text>
      {p.texto ? <Text style={s.texto}>{p.texto}</Text> : null}
      {p.acao ? <BotaoPrimario titulo={p.acao.titulo} estilo={s.botao} onPress={p.acao.onPress} /> : null}
    </View>
  )
}

const s = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 40, gap: 10 },
  titulo: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.text, textAlign: 'center' },
  texto: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 21, color: colors.textMuted, textAlign: 'center' },
  botao: { alignSelf: 'stretch', marginTop: 8 },
})
