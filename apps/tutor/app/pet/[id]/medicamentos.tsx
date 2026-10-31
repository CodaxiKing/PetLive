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
import { HeroiOnda } from '../../../src/components/HeroiOnda'
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
import { sincronizarDoses } from '../../../src/notificacoes/doses'
import { BarraProgresso } from '../../../src/components/Animacoes'
import { colors } from '../../../src/theme/colors'
import { fontFamily, typography } from '../../../src/theme/typography'
import { radius, spacing } from '../../../src/theme/tokens'
import { textoDeErro } from '../../../src/lib/erros'

const CARTOES = [
  { fundo: colors.warningSurface, borda: '#F3DC8E', texto: colors.warningText },
  { fundo: '#FDE0E6', borda: '#F5BFD9', texto: '#A3324F' },
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
  // Gerar as doses de hoje é escrita: sem internet segue com o que já existe.
  await garantirDosesHoje(emCurso).catch(() => undefined)
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
          Alert.alert('Não foi possível carregar', textoDeErro(e))
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
      // Dose dada antes da hora: a notificação dela não toca mais.
      sincronizarDoses().catch(() => undefined)
      setDoses((atual) =>
        atual.map((d) =>
          d.id === dose.id ? { ...d, confirmada_em: new Date().toISOString() } : d,
        ),
      )
    } catch (e) {
      const msg = textoDeErro(e)
      if (msg.includes('já marcou')) {
        // Guarda compartilhada: outra pessoa já deu esta dose.
        setDoses((atual) => atual.map((d) => (d.id === dose.id ? { ...d, confirmada_em: d.confirmada_em ?? new Date().toISOString() } : d)))
        sincronizarDoses().catch(() => undefined)
        Alert.alert('Dose já dada', msg)
      } else {
        Alert.alert('Não foi possível confirmar', msg)
      }
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
      <HeroiOnda subtitulo={pet?.nome ?? ''} titulo="Medicamentos" altura={220}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Adicionar remédio"
          hitSlop={8}
          onPress={abrirNovo}
          style={({ pressed }) => [estilos.mais, pressed && { opacity: 0.8 }]}
        >
          <Text style={estilos.maisSinal}>+</Text>
        </Pressable>
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
                    <BarraProgresso fracao={fracao} cor={colors.black} fundo={colors.white} />
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
        <BotaoPrimario titulo="Adicionar remédio" icone={<Text style={estilos.maisCta}>+</Text>} onPress={abrirNovo} />
      </View>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  mais: {
    position: 'absolute',
    right: 24,
    top: 56,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maisSinal: { fontFamily: fontFamily.regular, fontSize: 26, lineHeight: 30, color: colors.white },
  maisCta: { fontFamily: fontFamily.regular, fontSize: 28, lineHeight: 32, color: colors.black },
  conteudo: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: 130,
    gap: spacing.md,
  },
  centro: { paddingVertical: spacing.xxl, alignItems: 'center' },
  secaoTitulo: { ...typography.bodyMedium, fontFamily: fontFamily.bold, color: colors.text },
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
  cartaoNome: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.black },
  cartaoSub: { fontFamily: fontFamily.regular, fontSize: 12, marginTop: 2 },
  badge: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeTexto: { fontSize: 12, fontFamily: fontFamily.bold, color: colors.black },
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
  doseTexto: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.black },
  doseTextoDada: { color: colors.white, fontFamily: fontFamily.semiBold },
  vazioTitulo: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  vazioTexto: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  listaConcluidos: { gap: spacing.sm },
  ficha: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
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
    backgroundColor: colors.background,
  },
})
