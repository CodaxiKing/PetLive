import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { BotaoPrimario } from '../src/components/BotaoPrimario'
import { CabecalhoTela } from '../src/components/CabecalhoTela'
import { Interruptor } from '../src/components/Interruptor'
import {
  CARTOES_AVISO,
  JANELA_NAO_PERTURBE,
  carregarAvisos,
  salvarAvisos,
  type EstadoAvisos,
  type TipoAviso,
} from '../src/notificacoes/prefs'
import { colors } from '../src/theme/colors'
import { radius, spacing } from '../src/theme/tokens'
import { fontFamily, typography } from '../src/theme/typography'

/** Opções do "Horário dos avisos": de 30 em 30 minutos. */
const HORARIOS = Array.from({ length: 48 }, (_, i) => {
  const hora = String(Math.floor(i / 2)).padStart(2, '0')
  const minuto = i % 2 === 1 ? '30' : '00'
  return `${hora}:${minuto}`
})

function horaHumana(hhmm: string): string {
  const [h] = hhmm.split(':')
  return `${Number(h)}h`
}

function desenhoIcone(nome: string, cor: string) {
  const comuns = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: cor,
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (nome) {
    case 'vacina':
      return (
        <Svg width={20} height={20} {...comuns}>
          <Path d="M14 4l6 6-9 9-6-6z" />
          <Path d="M5 13l6 6" />
        </Svg>
      )
    case 'remedio':
      return (
        <Svg width={20} height={20} {...comuns}>
          <Path d="M3 9h18a3 3 0 0 1 0 6H3a3 3 0 0 1 0-6z" />
          <Path d="M12 9v6" />
        </Svg>
      )
    case 'relogio':
      return (
        <Svg width={20} height={20} {...comuns}>
          <Circle cx={12} cy={12} r={8} />
          <Path d="M12 8v4l2.5 1.5" />
        </Svg>
      )
    case 'mais':
      return (
        <Svg width={20} height={20} {...comuns} strokeWidth={2.2}>
          <Path d="M12 5v14M5 12h14" />
        </Svg>
      )
    case 'gota':
      return (
        <Svg width={20} height={20} {...comuns}>
          <Path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" />
        </Svg>
      )
    case 'sino':
    default:
      return (
        <Svg width={20} height={20} {...comuns}>
          <Path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z" />
          <Path d="M10 21h4" />
        </Svg>
      )
  }
}

/**
 * Avisos (board: [APP-CLIENTE] "Tela Avisos: ligar e desligar por tipo,
 * horário e Não perturbe"). Segue Notificacoes.dc.html: cartões por tipo
 * com interruptor, horário dos avisos e Não perturbe. Toda alteração é
 * salva na hora (notification_prefs + notification_settings) e o push
 * (pg_cron) lê as mesmas preferências.
 */
export default function TelaAvisos() {
  const [estado, setEstado] = useState<EstadoAvisos | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [escolhendoHorario, setEscolhendoHorario] = useState(false)
  const [larguraHero, setLarguraHero] = useState(0)

  useEffect(() => {
    carregarAvisos().then(
      (preferencias) => setEstado(preferencias),
      (e) =>
        Alert.alert(
          'Não foi possível carregar',
          e instanceof Error ? e.message : String(e),
        ),
    )
  }, [])

  const aplicar = useCallback(async (mudanca: Partial<EstadoAvisos>) => {
    setEstado((atual) => (atual ? { ...atual, ...mudanca } : atual))
    setSalvando(true)
    try {
      await salvarAvisos({ ...(estado as EstadoAvisos), ...mudanca })
    } catch (e) {
      Alert.alert('Não foi possível salvar', e instanceof Error ? e.message : String(e))
      const recarregado = await carregarAvisos().catch(() => null)
      if (recarregado) setEstado(recarregado)
    } finally {
      setSalvando(false)
    }
  }, [estado])

  const alternarTipo = (tipo: TipoAviso, ligado: boolean) => {
    aplicar({ ativos: { ...estado!.ativos, [tipo]: ligado } })
  }

  return (
    <View style={estilos.tela}>
      <View
        style={estilos.hero}
        onLayout={(e) => setLarguraHero(Math.round(e.nativeEvent.layout.width))}
      >
        <CabecalhoTela titulo="" />

        {/* Marca d'água de sino (decorativa, como no protótipo). */}
        <Svg
          style={estilos.marcadagua}
          width={120}
          height={120}
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.white}
          strokeWidth={1.1}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <Path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z" />
          <Path d="M10 21h4" />
        </Svg>

        <View style={estilos.blocoTitulo}>
          <Text style={estilos.subtitulo}>Quando o app avisa você</Text>
          <Text style={estilos.titulo}>Avisos</Text>
        </View>

        {larguraHero > 0 ? (
          <View style={estilos.onda}>
            <Svg width={larguraHero} height={46} viewBox="0 0 390 46" preserveAspectRatio="none">
              <Path
                d="M0 46V26C28 8 56 10 80 24C104 38 132 40 154 26C180 8 214 10 238 26C262 42 300 38 322 22C346 6 372 12 390 24V46z"
                fill={colors.surface}
              />
            </Svg>
          </View>
        ) : null}
      </View>

      <ScrollView
        style={estilos.flex}
        contentContainerStyle={estilos.conteudo}
        showsVerticalScrollIndicator={false}
      >
        {estado ? (
          <>
            {CARTOES_AVISO.map((cartao) => {
              const ligado = estado.ativos[cartao.tipo]
              return (
                <View key={cartao.tipo} style={estilos.cartao}>
                  <View style={[estilos.icone, { backgroundColor: cartao.fundo }]}>
                    {desenhoIcone(cartao.icone, colors.black)}
                  </View>

                  <View style={estilos.flex}>
                    <Text style={estilos.cartaoTitulo} numberOfLines={1}>
                      {cartao.rotulo}
                    </Text>
                    <Text style={estilos.cartaoQuando}>
                      {ligado ? cartao.quando : 'Desligado'}
                    </Text>
                  </View>

                  <Interruptor
                    ligado={ligado}
                    rotulo={`Avisos de ${cartao.rotulo}`}
                    desabilitado={salvando}
                    onToggle={() => alternarTipo(cartao.tipo, !ligado)}
                  />
                </View>
              )
            })}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Horário dos avisos: ${estado.horario}`}
              disabled={salvando}
              onPress={() => setEscolhendoHorario(true)}
              style={({ pressed }) => [estilos.cartaoHorario, pressed && { opacity: 0.7 }]}
            >
              <View>
                <Text style={estilos.horarioRotulo}>Horário dos avisos</Text>
                <Text style={estilos.horarioValor}>{estado.horario}</Text>
              </View>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
                <Path
                  d="M6 9l6 6 6-6"
                  stroke={colors.black}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>

            <View style={estilos.cartao}>
              <View style={estilos.flex}>
                <Text style={estilos.cartaoTitulo}>Não perturbe</Text>
                <Text style={estilos.cartaoQuando}>
                  {estado.naoPerturbe
                    ? `Das ${horaHumana(JANELA_NAO_PERTURBE.inicio)} às ${horaHumana(JANELA_NAO_PERTURBE.fim)}`
                    : 'Desligado'}
                </Text>
              </View>
              <Interruptor
                ligado={estado.naoPerturbe}
                rotulo="Não perturbe"
                desabilitado={salvando}
                onToggle={() => aplicar({ naoPerturbe: !estado.naoPerturbe })}
              />
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Horário dos avisos */}
      <Modal
        visible={escolhendoHorario}
        animationType="slide"
        transparent
        onRequestClose={() => setEscolhendoHorario(false)}
      >
        <View style={estilos.fundoModal}>
          <View style={estilos.cartaoModal}>
            <Text style={estilos.tituloModal}>Horário dos avisos</Text>
            <Text style={estilos.subtituloModal}>
              Hora padrão de novos lembretes e do aviso no dia anterior.
            </Text>

            <ScrollView
              style={estilos.listaHorarios}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={estilos.listaHorariosConteudo}
            >
              {HORARIOS.map((horario) => {
                const escolhido = estado?.horario === horario
                return (
                  <Pressable
                    key={horario}
                    accessibilityRole="button"
                    accessibilityState={{ selected: escolhido }}
                    onPress={() => {
                      setEscolhendoHorario(false)
                      aplicar({ horario })
                    }}
                    style={({ pressed }) => [
                      estilos.linhaHorario,
                      escolhido && estilos.linhaHorarioEscolhida,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[estilos.linhaHorarioTexto, escolhido && estilos.linhaHorarioTextoEscolhida]}>
                      {horario}
                    </Text>
                    {escolhido ? <Text style={estilos.check}>✓</Text> : null}
                  </Pressable>
                )
              })}
            </ScrollView>

            <View style={estilos.acoesModal}>
              <BotaoPrimario titulo="Fechar" onPress={() => setEscolhendoHorario(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  hero: {
    backgroundColor: colors.hero,
    height: 196,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  marcadagua: { position: 'absolute', right: 16, top: 44 },
  blocoTitulo: { paddingHorizontal: 24, paddingBottom: spacing.lg },
  subtitulo: { fontSize: 14, fontFamily: fontFamily.medium, color: '#2F6F93' },
  titulo: {
    ...typography.h1,
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -1.1,
    color: colors.black,
    marginTop: 2,
  },
  onda: { position: 'absolute', left: 0, right: 0, bottom: -1 },
  conteudo: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: 48,
    gap: spacing.sm,
  },
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 24,
    padding: 10,
    paddingRight: spacing.lg,
  },
  icone: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cartaoTitulo: { fontFamily: fontFamily.semiBold, fontSize: 15, color: colors.black },
  cartaoQuando: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cartaoHorario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.premiumSurface,
    borderRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  horarioRotulo: { fontSize: 12, fontFamily: fontFamily.semiBold, color: colors.premiumText },
  horarioValor: { fontSize: 20, fontFamily: fontFamily.bold, color: colors.black, marginTop: 2 },
  fundoModal: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  cartaoModal: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xl,
    paddingBottom: 40,
    gap: spacing.sm,
  },
  tituloModal: { ...typography.h3, color: colors.text },
  subtituloModal: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.xs },
  listaHorarios: { maxHeight: 320 },
  listaHorariosConteudo: { gap: spacing.xs },
  linhaHorario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  linhaHorarioEscolhida: { backgroundColor: colors.primarySurface },
  linhaHorarioTexto: { fontSize: 16, fontFamily: fontFamily.semiBold, color: colors.text },
  linhaHorarioTextoEscolhida: { color: colors.primaryDeep },
  check: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.primaryDeep },
  acoesModal: { marginTop: spacing.sm },
})
