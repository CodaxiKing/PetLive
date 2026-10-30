import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { usePets } from '../../../src/pets/PetsProvider'
import {
  carregarConsultas,
  ehAgendada,
  type Consulta,
} from '../../../src/saude/consultas'
import { dataParaExibicao } from '../../../src/saude/types'
import { colors } from '../../../src/theme/colors'
import { fontFamily, typography } from '../../../src/theme/typography'
import { radius, spacing } from '../../../src/theme/tokens'

const MESES_CURTOS = [
  'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
  'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ',
]
const FUNDO_LINHA = [colors.hero, colors.premiumSurface, colors.warningSurface]

/**
 * Consultas do pet (board: [APP-CLIENTE] "Consultas: histórico"). Segue o
 * protótipo Consultas.dc.html: herói com o nome do pet, cartão da próxima
 * consulta, histórico em fichas e botão para registrar.
 */
export default function TelaConsultas() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pets } = usePets()
  const pet = pets.find((p) => p.id === id) ?? null

  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [carregando, setCarregando] = useState(true)

  // Recarrega a cada foco: volta da tela de registro já com o novo item.
  useFocusEffect(
    useCallback(() => {
      if (!id) return
      carregarConsultas(id).then(
        (lista) => {
          setConsultas(lista)
          setCarregando(false)
        },
        () => {
          setCarregando(false)
        },
      )
    }, [id]),
  )

  const agendadas = consultas
    .filter(ehAgendada)
    .sort((a, b) => a.realizada_em.localeCompare(b.realizada_em))
  const proxima = agendadas.length > 0 ? agendadas[0] : null
  const historico = consultas.filter((c) => !ehAgendada(c))

  const abrirNova = () => {
    if (!id) return
    router.push({ pathname: '/pet/[id]/consultas/nova', params: { id } })
  }

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo={pet?.nome ?? ''} titulo="Consultas" altura={220}>
      </HeroiOnda>

      <ScrollView
        style={estilos.flex}
        contentContainerStyle={estilos.conteudo}
        showsVerticalScrollIndicator={false}
      >
        {carregando ? (
          <View style={estilos.centro}>
            <ActivityIndicator color={colors.primaryDeep} />
          </View>
        ) : (
          <>
            {/* Próxima consulta (ou estado vazio) */}
            <View style={estilos.proxima}>
              <View style={estilos.flex}>
                <Text style={estilos.proximaTitulo}>
                  {proxima ? proxima.motivo : 'Nenhuma consulta agendada'}
                </Text>
                <Text style={estilos.proximaSub}>
                  {proxima
                    ? [dataParaExibicao(proxima.realizada_em), proxima.local]
                        .filter(Boolean)
                        .join(' · ')
                    : 'Ligue para a clínica e registre aqui.'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={abrirNova}
                style={({ pressed }) => [estilos.botaoAgendar, pressed && { opacity: 0.7 }]}
              >
                <Text style={estilos.botaoAgendarTexto}>Agendar</Text>
              </Pressable>
            </View>

            <Text style={estilos.secaoTitulo}>Histórico</Text>

            {historico.length === 0 ? (
              <Text style={estilos.vazio}>
                Nenhuma consulta concluída ainda. Registre a primeira abaixo.
              </Text>
            ) : (
              <View style={estilos.lista}>
                {historico.map((c, i) => {
                  const [, m, d] = c.realizada_em.split('-')
                  return (
                    <View key={c.id} style={estilos.ficha}>
                      <View
                        style={[
                          estilos.data,
                          { backgroundColor: FUNDO_LINHA[i % FUNDO_LINHA.length] },
                        ]}
                      >
                        <Text style={estilos.dataDia}>{d}</Text>
                        <Text style={estilos.dataMes}>{MESES_CURTOS[Number(m) - 1] ?? ''}</Text>
                      </View>

                      <View style={estilos.flex}>
                        <Text style={estilos.fichaTitulo} numberOfLines={1}>
                          {c.motivo}
                        </Text>
                        <Text style={estilos.fichaSub} numberOfLines={1}>
                          {c.local ?? c.veterinario ?? 'Clínica veterinária'}
                        </Text>
                      </View>

                      <View style={estilos.etiqueta}>
                        <Text style={estilos.etiquetaTexto}>Concluída</Text>
                      </View>
                    </View>
                  )
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Registrar consulta" icone={<Text style={estilos.maisCta}>+</Text>} onPress={abrirNova} />
      </View>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  pata: { position: 'absolute', right: 30, top: 56 },
  maisCta: { fontFamily: fontFamily.regular, fontSize: 28, lineHeight: 32, color: colors.black },
  conteudo: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: 130,
    gap: spacing.md,
  },
  centro: { paddingVertical: spacing.xxl, alignItems: 'center' },
  proxima: {
    backgroundColor: colors.premiumSurface,
    borderWidth: 1.5,
    borderColor: '#D7BDF5',
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  proximaTitulo: { ...typography.bodyMedium, fontFamily: fontFamily.bold, color: colors.text },
  proximaSub: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.premiumText, marginTop: 2 },
  botaoAgendar: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: 18,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoAgendarTexto: { fontSize: 13, fontFamily: fontFamily.semiBold, color: colors.white },
  secaoTitulo: {
    ...typography.bodyMedium,
    fontFamily: fontFamily.bold,
    color: colors.text,
    marginTop: spacing.xs,
  },
  vazio: { ...typography.body, color: colors.textMuted, lineHeight: 22 },
  lista: { gap: spacing.sm },
  ficha: {
    backgroundColor: colors.background,
    borderRadius: 24,
    padding: 10,
    paddingRight: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  data: {
    width: 56,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataDia: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 22, color: colors.black },
  dataMes: { fontSize: 11, fontFamily: fontFamily.semiBold, color: colors.black },
  fichaTitulo: { fontFamily: fontFamily.semiBold, fontSize: 15, color: colors.text },
  fichaSub: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  etiqueta: {
    backgroundColor: colors.successSurface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  etiquetaTexto: { fontSize: 12, fontFamily: fontFamily.bold, color: colors.successText },
  rodape: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: 32,
    backgroundColor: colors.surface,
  },
})
