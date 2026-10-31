import { useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { Wrench } from 'phosphor-react-native/src/icons/Wrench'
import { conferirOperacao, textoPrevisao, type Manutencao } from '../lib/operacao'
import { colors } from '../theme/colors'
import { fontFamily } from '../theme/typography'
import { BotaoPrimario } from './BotaoPrimario'

const URL_STATUS = process.env.EXPO_PUBLIC_STATUS_URL ?? ''

/**
 * Tela de manutenção: aparece por cima do app quando a API cai ou quando a
 * equipe liga a manutenção planejada. O SOS continua ao alcance, porque os
 * guias de emergência funcionam sem o servidor.
 */
export function TelaManutencao({ planejada, detalhes, onAbrirSos }: { planejada: boolean; detalhes: Manutencao; onAbrirSos?: () => void }) {
  const [conferindo, setConferindo] = useState(false)
  const previsao = textoPrevisao(detalhes.previsao)

  async function tentar() {
    setConferindo(true)
    await conferirOperacao().catch(() => undefined)
    setConferindo(false)
  }

  return (
    <View style={s.tela} accessibilityViewIsModal accessibilityLiveRegion="polite">
      <View style={s.centro}>
        <View style={s.icone}>
          <Wrench size={40} color={colors.primaryDeep} weight="duotone" />
        </View>
        <Text style={s.titulo} accessibilityRole="header">
          Estamos em manutenção
        </Text>
        <Text style={s.texto}>
          {detalhes.mensagem ??
            (planejada
              ? 'Estamos melhorando o PetLive. Volte em instantes.'
              : 'Alguns serviços do PetLive estão fora do ar. Já estamos cuidando disso.')}
        </Text>
        {previsao ? <Text style={s.previsao}>{previsao}</Text> : null}
        <Text style={s.nota}>Seus dados estão guardados. Nada se perde enquanto isso.</Text>
      </View>

      <View style={s.rodape}>
        {onAbrirSos ? (
          <Pressable accessibilityRole="button" onPress={onAbrirSos} style={({ pressed }) => [s.sos, pressed && { opacity: 0.8 }]}>
            <Text style={s.sosTitulo}>Emergência com o pet?</Text>
            <Text style={s.sosTexto}>Os primeiros socorros e o SOS funcionam sem o servidor.</Text>
          </Pressable>
        ) : null}
        <BotaoPrimario titulo="Tentar de novo" carregando={conferindo} onPress={tentar} />
        {URL_STATUS ? (
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(URL_STATUS).catch(() => undefined)} hitSlop={8} style={s.link}>
            <Text style={s.linkTexto}>Ver o status do PetLive</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  tela: { ...StyleSheet.absoluteFill, backgroundColor: colors.background, paddingHorizontal: 24, paddingTop: 72, paddingBottom: 32, zIndex: 100, elevation: 100 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  icone: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  titulo: { fontFamily: fontFamily.bold, fontSize: 26, letterSpacing: -0.8, color: colors.text, textAlign: 'center' },
  texto: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 23, color: colors.textMuted, textAlign: 'center' },
  previsao: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.primaryDeep, backgroundColor: colors.primarySurface, borderRadius: 999, overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 6 },
  nota: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
  rodape: { gap: 12 },
  sos: { backgroundColor: '#FDE0E6', borderRadius: 22, padding: 16, gap: 2 },
  sosTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.emergency },
  sosTexto: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: colors.text },
  link: { alignSelf: 'center', paddingVertical: 4 },
  linkTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.primaryDeep, textDecorationLine: 'underline' },
})
