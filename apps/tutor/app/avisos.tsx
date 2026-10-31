import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { HeroiOnda } from '../src/components/HeroiOnda'
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
import { shadow, spacing } from '../src/theme/tokens'
import { fontFamily, typography } from '../src/theme/typography'
import { ConfigurarRegiaoEventos } from '../src/notificacoes/ConfigurarRegiaoEventos'
import { ConfigurarRegiaoPerdidos } from '../src/perdido/ConfigurarRegiaoPerdidos'
import { ConfigurarWidget } from '../src/widget/ConfigurarWidget'
import { textoDeErro } from '../src/lib/erros'

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
 * horário e Não perturbe"). Cartões por tipo com interruptor e Não
 * perturbe. Não há horário para escolher: cada tipo avisa com a antecedência
 * que o cuidado pede (notificacoes/antecedencia.ts). Toda alteração é
 * salva na hora (notification_prefs + notification_settings) e o push
 * (pg_cron) lê as mesmas preferências.
 */
export default function TelaAvisos() {
  const [estado, setEstado] = useState<EstadoAvisos | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    carregarAvisos().then(
      (preferencias) => setEstado(preferencias),
      (e) =>
        Alert.alert(
          'Não foi possível carregar',
          textoDeErro(e),
        ),
    )
  }, [])

  const aplicar = useCallback(async (mudanca: Partial<EstadoAvisos>) => {
    setEstado((atual) => (atual ? { ...atual, ...mudanca } : atual))
    setSalvando(true)
    try {
      await salvarAvisos({ ...(estado as EstadoAvisos), ...mudanca })
    } catch (e) {
      Alert.alert('Não foi possível salvar', textoDeErro(e))
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
      <HeroiOnda subtitulo="Quando o app avisa você" titulo="Avisos" />

      <ScrollView
        style={estilos.flex}
        contentContainerStyle={estilos.conteudo}
        showsVerticalScrollIndicator={false}
      >
        {estado ? (
          <>
            <View style={estilos.lista}>
            {CARTOES_AVISO.map((cartao, i) => {
              const ligado = estado.ativos[cartao.tipo]
              return (
                <View key={cartao.tipo} style={[estilos.itemLista, i > 0 && estilos.divisor]}>
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
            </View>

            <ConfigurarRegiaoEventos eventosLigados={estado.ativos.eventos} />
            <ConfigurarRegiaoPerdidos />
            <ConfigurarWidget />

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

    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  hero: {
    backgroundColor: colors.primarySurface,
    height: 196,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  marcadagua: { position: 'absolute', right: 16, top: 44 },
  blocoTitulo: { paddingHorizontal: 24, paddingBottom: spacing.lg },
  subtitulo: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.primaryDark },
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
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 10,
    paddingRight: spacing.lg,
  },
  // Versão 2: os tipos de aviso numa lista branca só, com divisórias.
  lista: { backgroundColor: colors.surface, borderRadius: 26, ...shadow.card },
  itemLista: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 12, paddingHorizontal: 14 },
  divisor: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  icone: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cartaoTitulo: { fontFamily: fontFamily.semiBold, fontSize: 15, color: colors.black },
  cartaoQuando: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
})
