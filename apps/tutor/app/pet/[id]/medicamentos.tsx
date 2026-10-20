import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import Svg, { Path } from 'react-native-svg'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { CabecalhoTela } from '../../../src/components/CabecalhoTela'
import { supabase } from '../../../src/lib/supabase'
import { usePets } from '../../../src/pets/PetsProvider'
import {
  carregarDosesHoje,
  confirmarDose,
  concluido,
  emTratamentoHoje,
  garantirDosesHoje,
  horaDaDose,
  hojeIso,
  progressoDias,
  type DoseHoje,
} from '../../../src/remedios/doses'
import type { Remedio } from '../../../src/remedios/types'
import { dataParaExibicao, normalizarHorarios } from '../../../src/remedios/types'
import { colors } from '../../../src/theme/colors'
import { typography } from '../../../src/theme/typography'
import { radius, spacing } from '../../../src/theme/tokens'

const CARTOES = [
  { fundo: colors.warningSurface, borda: '#F3DC8E', texto: colors.warningText },
  { fundo: '#FCE1EF', borda: '#F5BFD9', texto: '#8A2E5C' },
  { fundo: colors.primarySurface, borda: '#BFE3F7', texto: colors.primaryDeep },
]

type Dados = { lista: Remedio[]; doses: DoseHoje[] }

/** Carrega remédios (ativos e concluídos) e as doses de hoje do pet. */
async function carregarTudo(petId: string): Promise<Dados> {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('pet_id', petId)
    .order('inicio', { ascending: false })

  if (error) throw new Error(error.message)

  const lista = (
    (data ?? []) as (Omit<Remedio, 'horarios'> & { horarios: (string | number)[] | null })[]
  ).map((linha) => ({
    ...linha,
    horarios: normalizarHorarios(linha.horarios),
  }))

  const emCurso = lista.filter((r) => r.ativo && emTratamentoHoje(r))
  await garantirDosesHoje(emCurso)
  const doses = await carregarDosesHoje(emCurso.map((r) => r.id))
  return { lista, doses }
}

/**
 * Medicamentos (board: [APP-CLIENTE] "Tela Medicamentos: progresso e
 * confirmar dose"). Segue o protótipo Medicamentos.dc.html: cartões de
 * andamento com barra e doses do dia, concluídos e botão de adicionar.
 */
export default function TelaMedicamentos() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pets } = usePets()
  const pet = pets.find((p) => p.id === id) ?? null

  const [lista, setLista] = useState<Remedio[]>([])
  const [doses, setDoses] = useState<DoseHoje[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvandoDose, setSalvandoDose] = useState<string | null>(null)
  const [larguraHero, setLarguraHero] = useState(0)

  useFocusEffect(
    useCallback(() => {
      if (!id) return
      carregarTudo(id).then(
        (dados) => {
          setLista(dados.lista)
          setDoses(dados.doses)
          setCarregando(false)
        },
        (e) => {
          Alert.alert('Não foi possível carregar', e instanceof Error ? e.message : String(e))
          setCarregando(false)
        },
      )
    }, [id]),
  )

  const abrirNovo = () => {
    if (!id) return
    router.push({ pathname: '/pet/[id]/remedio/novo', params: { id } })
  }

  const confirmar = async (dose: DoseHoje) => {
    setSalvandoDose(dose.id)
    try {
      await confirmarDose(dose.id)
      setDoses((atual) =>
        atual.map((d) =>
          d.id === dose.id ? { ...d, confirmada_em: new Date().toISOString() } : d,
        ),
      )
    } catch (e) {
      Alert.alert('Não foi possível confirmar', e instanceof Error ? e.message : String(e))
    } finally {
      setSalvandoDose(null)
    }
  }

  const hoje = hojeIso()
  const emAndamento = lista.filter((r) => r.ativo && !concluido(r))
  const concluidos = lista.filter(concluido)
  const dosesPorRemedio = new Map<string, DoseHoje[]>()
  for (const d of doses) {
    const grupo = dosesPorRemedio.get(d.medication_id) ?? []
    grupo.push(d)
    dosesPorRemedio.set(d.medication_id, grupo)
  }

  return (
    <View style={estilos.tela}>
      <View
        style={estilos.hero}
        onLayout={(e) => setLarguraHero(Math.round(e.nativeEvent.layout.width))}
      >
        <CabecalhoTela
          titulo={pet?.nome ?? ''}
          acao="＋"
          onAcao={abrirNovo}
        />

        <Text style={estilos.titulo}>Medicamentos</Text>

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
        {carregando ? (
          <View style={estilos.centro}>
            <ActivityIndicator color={colors.primaryDeep} />
          </View>
        ) : (
          <>
            {emAndamento.length > 0 ? (
              <Text style={estilos.secaoTitulo}>Em andamento</Text>
            ) : null}

            {emAndamento.map((m, i) => {
              const tema = CARTOES[i % CARTOES.length]
              const { dia, total } = progressoDias(m)
              const comecou = m.inicio <= hoje
              const doDia = dosesPorRemedio.get(m.id) ?? []
              const confirmadas = doDia.filter((d) => d.confirmada_em != null).length

              let fracao: number | null = null
              if (comecou) {
                if (total != null) fracao = Math.min(1, dia / total)
                else if (doDia.length > 0) fracao = confirmadas / doDia.length
              }

              const badge = comecou
                ? total != null
                  ? `Dia ${dia} de ${total}`
                  : `Dia ${dia}`
                : `Começa em ${dataParaExibicao(m.inicio)}`

              return (
                <View
                  key={m.id}
                  style={[
                    estilos.cartao,
                    { backgroundColor: tema.fundo, borderColor: tema.borda },
                  ]}
                >
                  <View style={estilos.cartaoTopo}>
                    <View style={estilos.icone}>
                      <Svg
                        width={22}
                        height={22}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={colors.black}
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <Path d="M3 9h18a3 3 0 0 1 0 6H3a3 3 0 0 1 0-6z" />
                        <Path d="M12 9v6" />
                      </Svg>
                    </View>

                    <View style={estilos.flex}>
                      <Text style={estilos.cartaoNome} numberOfLines={1}>
                        {m.nome}
                      </Text>
                      <Text style={[estilos.cartaoSub, { color: tema.texto }]} numberOfLines={1}>
                        {[m.dose, m.frequencia].filter(Boolean).join(' · ')}
                      </Text>
                    </View>

                    <View style={estilos.badge}>
                      <Text style={estilos.badgeTexto}>{badge}</Text>
                    </View>
                  </View>

                  {fracao != null ? (
                    <View style={estilos.barra}>
                      <View style={[estilos.barraPreenchida, { width: `${Math.round(fracao * 100)}%` }]} />
                    </View>
                  ) : null}

                  {doDia.length > 0 ? (
                    <View style={estilos.doses}>
                      {doDia.map((d, j) => {
                        const confirmada = d.confirmada_em != null
                        const proximaPendente =
                          !confirmada && doDia.slice(0, j).every((anterior) => anterior.confirmada_em != null)
                        const rotulo = confirmada
                          ? `${horaDaDose(d.prevista_para)} dado`
                          : `${horaDaDose(d.prevista_para)}${proximaPendente ? ' · próxima' : ''}`

                        return (
                          <Pressable
                            key={d.id}
                            accessibilityRole="button"
                            accessibilityLabel={
                              confirmada
                                ? `Dose das ${horaDaDose(d.prevista_para)} confirmada`
                                : `Confirmar dose das ${horaDaDose(d.prevista_para)}`
                            }
                            disabled={confirmada || salvandoDose != null}
                            onPress={() => confirmar(d)}
                            style={({ pressed }) => [
                              estilos.dose,
                              confirmada && estilos.doseDada,
                              pressed && !confirmada && { opacity: 0.7 },
                            ]}
                          >
                            {confirmada ? (
                              <Svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
                                <Path
                                  d="M5 12l5 5 9-10"
                                  fill="none"
                                  stroke={colors.primary}
                                  strokeWidth={3}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </Svg>
                            ) : null}
                            <Text
                              style={[estilos.doseTexto, confirmada && estilos.doseTextoDada]}
                            >
                              {rotulo}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  ) : null}
                </View>
              )
            })}

            {emAndamento.length === 0 && concluidos.length === 0 ? (
              <View style={estilos.centro}>
                <Text style={estilos.vazioTitulo}>Nenhum remédio ainda</Text>
                <Text style={estilos.vazioTexto}>
                  Adicione o tratamento para acompanhar as doses do dia.
                </Text>
              </View>
            ) : null}

            {concluidos.length > 0 ? (
              <>
                <Text style={[estilos.secaoTitulo, estilos.secaoMargem]}>Concluídos</Text>
                <View style={estilos.listaConcluidos}>
                  {concluidos.map((m) => {
                    const { total } = progressoDias(m)
                    const fim = m.fim ? dataParaExibicao(m.fim) : 'hoje'
                    return (
                      <View key={m.id} style={estilos.ficha}>
                        <View style={estilos.flex}>
                          <Text style={estilos.fichaTitulo} numberOfLines={1}>
                            {m.nome}
                          </Text>
                          <Text style={estilos.fichaSub}>
                            {total != null ? `${total} dias · ` : ''}
                            {m.fim ? `terminou em ${fim}` : 'encerrado'}
                          </Text>
                        </View>
                        <View style={estilos.etiqueta}>
                          <Text style={estilos.etiquetaTexto}>Concluído</Text>
                        </View>
                      </View>
                    )
                  })}
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Adicionar remédio" onPress={abrirNovo} />
      </View>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  hero: {
    backgroundColor: colors.hero,
    paddingBottom: 44,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  titulo: {
    ...typography.h1,
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -1.1,
    color: colors.black,
    paddingHorizontal: 24,
    paddingBottom: spacing.lg,
  },
  onda: { position: 'absolute', left: 0, right: 0, bottom: -1 },
  conteudo: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: 130,
    gap: spacing.md,
  },
  centro: { paddingVertical: spacing.xxl, alignItems: 'center' },
  secaoTitulo: { ...typography.bodyMedium, fontWeight: '700', color: colors.text },
  secaoMargem: { marginTop: spacing.sm },
  cartao: {
    borderRadius: 30,
    borderWidth: 1.5,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cartaoTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icone: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartaoNome: { fontWeight: '700', fontSize: 17, color: colors.black },
  cartaoSub: { fontSize: 12, marginTop: 2 },
  badge: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeTexto: { fontSize: 12, fontWeight: '700', color: colors.black },
  barra: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  barraPreenchida: { height: '100%', borderRadius: 4, backgroundColor: colors.black },
  doses: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dose: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  doseDada: { backgroundColor: colors.black },
  doseTexto: { fontSize: 14, fontWeight: '700', color: colors.black },
  doseTextoDada: { color: colors.white, fontWeight: '600' },
  vazioTitulo: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  vazioTexto: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  listaConcluidos: { gap: spacing.sm },
  ficha: {
    backgroundColor: colors.background,
    borderRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  fichaTitulo: { fontWeight: '600', fontSize: 15, color: colors.text },
  fichaSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  etiqueta: {
    backgroundColor: colors.successSurface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  etiquetaTexto: { fontSize: 12, fontWeight: '700', color: colors.successText },
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
