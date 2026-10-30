import { useCallback, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Check } from 'phosphor-react-native/src/icons/Check'
import { useAuth } from '../../src/auth/AuthProvider'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../src/components/HeroiOnda'
import { supabase } from '../../src/lib/supabase'
import { cancelarAssinatura, lerAssinatura, podeCancelar, type MinhaAssinatura } from '../../src/perfil/assinatura'
import { colors } from '../../src/theme/colors'
import { shadow } from '../../src/theme/tokens'
import { fontFamily } from '../../src/theme/typography'

const MOTIVOS = ['Está caro', 'Não uso os recursos Premium', 'Vou pausar por um tempo', 'Outro motivo']
const MANTEM = ['Todos os pets, vacinas, remédios e o histórico', 'Os lembretes e a carteirinha', 'O SOS, a ficha de emergência e o mapa']

/** Cancelar a assinatura: o Premium continua até o fim do período pago. */
export default function CancelarAssinatura() {
  const { user } = useAuth()
  const [dados, setDados] = useState<MinhaAssinatura | null>(null)
  const [motivo, setMotivo] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [feito, setFeito] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (!user) return
      supabase.rpc('minha_assinatura', { p_tutor: user.id }).then(({ data, error }) => {
        if (error) setErro('Não foi possível consultar sua assinatura.')
        else setDados(lerAssinatura(data))
      })
    }, [user]),
  )

  async function cancelar() {
    setEnviando(true)
    setErro(null)
    try {
      const r = await cancelarAssinatura(motivo)
      setFeito(new Date(r.periodo_fim).toLocaleDateString('pt-BR'))
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setEnviando(false)
    }
  }

  const fim = dados?.assinatura ? new Date(dados.assinatura.periodo_fim).toLocaleDateString('pt-BR') : null

  if (feito) {
    return (
      <View style={s.tela}>
        <HeroiOnda titulo="Cancelamento agendado" semVoltar />
        <View style={s.conteudo}>
          <View style={s.cartaoEscuro}>
            <Text style={s.escuroRotulo}>Seu Premium continua até</Text>
            <Text style={s.escuroData}>{feito}</Text>
            <Text style={s.escuroTexto}>Nenhuma nova cobrança será feita. Depois disso, a conta volta ao plano grátis.</Text>
          </View>
          <Text style={s.nota}>Mudou de ideia? Em Minha assinatura, toque em Manter o Premium antes dessa data.</Text>
        </View>
        <View style={s.rodape}>
          <BotaoPrimario titulo="Voltar para Minha assinatura" onPress={() => router.back()} />
        </View>
      </View>
    )
  }

  return (
    <View style={s.tela}>
      <HeroiOnda titulo="Cancelar assinatura" />
      {!dados ? (
        <View style={s.centro}>{erro ? <Text style={s.texto}>{erro}</Text> : <ActivityIndicator color={colors.primaryDeep} />}</View>
      ) : !podeCancelar(dados) ? (
        <View style={s.conteudo}>
          <Text style={s.texto}>Não há assinatura para cancelar pelo app.</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={s.conteudo} showsVerticalScrollIndicator={false}>
            <View style={s.cartaoEscuro}>
              <Text style={s.escuroRotulo}>O Premium continua até</Text>
              <Text style={s.escuroData}>{fim}</Text>
              <Text style={s.escuroTexto}>Você já pagou por este período. Depois dele, a conta volta ao plano grátis.</Text>
            </View>

            <Text style={s.secao}>Continua com você no plano grátis</Text>
            <View style={s.lista}>
              {MANTEM.map((t, i) => (
                <View key={t} style={[s.item, i > 0 && s.divisor]}>
                  <View style={s.icone}>
                    <Check size={18} color={colors.successText} weight="bold" />
                  </View>
                  <Text style={s.itemTexto}>{t}</Text>
                </View>
              ))}
            </View>

            <Text style={s.secao}>Por que você está cancelando?</Text>
            <View style={s.motivos}>
              {MOTIVOS.map((m) => (
                <Pressable
                  key={m}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: motivo === m }}
                  onPress={() => setMotivo(motivo === m ? null : m)}
                  style={[s.motivo, motivo === m && s.motivoAtivo]}
                >
                  <Text style={[s.motivoTexto, motivo === m && s.motivoTextoAtivo]}>{m}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.nota}>Opcional. Ajuda a melhorar o PetLive.</Text>
            {erro ? <Text style={s.erro} accessibilityRole="alert">{erro}</Text> : null}
          </ScrollView>
          <View style={s.rodape}>
            <BotaoPrimario titulo="Manter o Premium" onPress={() => router.back()} />
            <BotaoPrimario titulo="Cancelar assinatura" claro carregando={enviando} onPress={cancelar} />
          </View>
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  conteudo: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
  cartaoEscuro: { backgroundColor: colors.black, borderRadius: 28, padding: 22, gap: 4 },
  escuroRotulo: { fontFamily: fontFamily.bold, fontSize: 14, color: '#F2C14E' },
  escuroData: { fontFamily: fontFamily.bold, fontSize: 30, letterSpacing: -0.8, color: colors.white },
  escuroTexto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.75)' },
  secao: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.text, marginTop: 4 },
  lista: { backgroundColor: colors.surface, borderRadius: 26, ...shadow.card },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  divisor: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  icone: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.successSurface, alignItems: 'center', justifyContent: 'center' },
  itemTexto: { flex: 1, fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 21, color: colors.text },
  motivos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  motivo: { borderRadius: 999, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 9, ...shadow.card },
  motivoAtivo: { backgroundColor: colors.black },
  motivoTexto: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.text },
  motivoTextoAtivo: { color: colors.white },
  texto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  nota: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted, paddingHorizontal: 4 },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger, paddingHorizontal: 4 },
  rodape: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, gap: 10 },
})
