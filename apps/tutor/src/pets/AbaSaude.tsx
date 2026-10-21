import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { usePets } from './PetsProvider'
import { useRemedios } from '../remedios/RemediosProvider'
import { diasRestantes } from '../remedios/types'
import { useVacinas } from '../saude/VacinasProvider'
import { carregarConsultas as carregarConsultasDoPet, type Consulta } from '../saude/consultas'
import { dataParaExibicao, rotuloDose } from '../saude/types'
import { colors } from '../theme/colors'
import { fontFamily, typography } from '../theme/typography'
import { components, radius, spacing } from '../theme/tokens'

interface OutroRegistro {
  id: string
  titulo: string
  subtitulo: string | null
  quando: string | null
}

interface GrupoOutros {
  chave: string
  titulo: string
  itens: OutroRegistro[]
}

/** Aba "Saúde": histórico de vacinas + vermífugos e remédios em uso. */
export function AbaSaude() {
  const { petAtivo } = usePets()
  const { vacinas, carregando, salvando, removerVacina, recarregar } = useVacinas()
  const { remedios, encerrarRemedio } = useRemedios()
  const [vermifugos, setVermifugos] = useState<OutroRegistro[]>([])
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [atualizando, setAtualizando] = useState(false)

  const petId = petAtivo?.id ?? null

  const carregarVermifugos = useCallback(() => {
    const consulta = petId
      ? supabase
          .from('dewormings')
          .select('id, produto, aplicado_em, proxima_dose')
          .eq('pet_id', petId)
          .order('aplicado_em', { ascending: false })
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null })

    return Promise.resolve(consulta).then(({ data }) => {
      setVermifugos(
        ((data ?? []) as { id: string; produto: string | null; aplicado_em: string; proxima_dose: string | null }[]).map(
          (v) => ({
            id: v.id,
            titulo: v.produto ?? 'Vermífugo',
            subtitulo: v.proxima_dose ? `próxima ${dataParaExibicao(v.proxima_dose)}` : null,
            quando: dataParaExibicao(v.aplicado_em),
          }),
        ),
      )
    })
  }, [petId])

  useEffect(() => {
    carregarVermifugos()
  }, [carregarVermifugos])

  const carregarConsultas = useCallback(() => {
    if (!petId) return Promise.resolve()
    return carregarConsultasDoPet(petId).then((lista) => setConsultas(lista))
  }, [petId])

  useEffect(() => {
    carregarConsultas()
  }, [carregarConsultas])

  const atualizar = useCallback(async () => {
    setAtualizando(true)
    await Promise.all([recarregar(), carregarVermifugos(), carregarConsultas()])
    setAtualizando(false)
  }, [recarregar, carregarVermifugos, carregarConsultas])

  const confirmarRemocao = (id: string, nome: string) => {
    Alert.alert(`Remover ${nome}?`, 'O registro de vacina será apagado.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => removerVacina(id) },
    ])
  }

  const registrar = () => {
    if (!petAtivo) return
    router.push({
      pathname: '/pet/[id]/vacina/nova',
      params: { id: petAtivo.id },
    })
  }

  const novoRemedio = () => {
    if (!petAtivo) return
    router.push({
      pathname: '/pet/[id]/remedio/novo',
      params: { id: petAtivo.id },
    })
  }

  const novoPeso = () => {
    if (!petAtivo) return
    router.push({
      pathname: '/pet/[id]/peso',
      params: { id: petAtivo.id },
    })
  }

  const abrirConsultas = () => {
    if (!petAtivo) return
    router.push({
      pathname: '/pet/[id]/consultas',
      params: { id: petAtivo.id },
    })
  }

  const abrirMedicamentos = () => {
    if (!petAtivo) return
    router.push({
      pathname: '/pet/[id]/medicamentos',
      params: { id: petAtivo.id },
    })
  }

  /** Toque longo: remover vacina, ou encerrar tratamento de remédio. */
  const aoSegurar = (chave: string, item: OutroRegistro) => {
    if (chave === 'vacinas') {
      confirmarRemocao(item.id, item.titulo)
      return
    }
    if (chave === 'remedios') {
      Alert.alert(
        `Encerrar ${item.titulo}?`,
        'O tratamento sai da lista de ativos. O histórico continua salvo.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Encerrar', style: 'destructive', onPress: () => encerrarRemedio(item.id) },
        ],
      )
    }
  }

  const proximas = vacinas
    .filter((v) => v.proxima_dose)
    .sort((a, b) => String(a.proxima_dose).localeCompare(String(b.proxima_dose)))

  const grupoVacinas: GrupoOutros = {
    chave: 'vacinas',
    titulo: 'Histórico de vacinas',
    itens: vacinas.map((v) => ({
      id: v.id,
      titulo: v.nome,
      subtitulo: [v.local, v.lote ? `lote ${v.lote}` : null].filter(Boolean).join(' · ') || null,
      quando: dataParaExibicao(v.aplicada_em),
    })),
  }

  const grupoRemedios: GrupoOutros = {
    chave: 'remedios',
    titulo: 'Remédios em uso',
    itens: remedios.map((m) => {
      const restantes = diasRestantes(m.fim)
      const partes = [m.dose, m.frequencia, m.horarios.join(', ')].filter(Boolean)
      if (restantes != null) {
        partes.push(restantes < 0 ? 'tratamento encerrado' : `faltam ${restantes}d`)
      }
      return {
        id: m.id,
        titulo: m.nome,
        subtitulo: partes.join(' · ') || null,
        quando: dataParaExibicao(m.inicio),
      }
    }),
  }

  const grupos = [grupoVacinas, grupoRemedios, { chave: 'vermifugos', titulo: 'Vermífugos', itens: vermifugos }].filter(
    (g) => g.itens.length > 0,
  )

  return (
    <ScrollView
      contentContainerStyle={estilos.conteudo}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={atualizando} onRefresh={atualizar} tintColor={colors.primaryDeep} />
      }
    >
      {carregando && !atualizando ? (
        <View style={estilos.centro}>
          <ActivityIndicator color={colors.primaryDeep} />
        </View>
      ) : null}

      {proximas.length > 0 ? (
        <View style={estilos.faixaProximas}>
          <Text style={estilos.faixaTitulo}>Próximas doses</Text>
          {proximas.slice(0, 3).map((v) => {
            const rotulo = rotuloDose(v.proxima_dose)
            return (
              <View key={v.id} style={estilos.linhaProxima}>
                <View style={estilos.flex}>
                  <Text style={estilos.proximaNome}>{v.nome}</Text>
                  <Text style={estilos.proximaData}>{dataParaExibicao(v.proxima_dose)}</Text>
                </View>
                <View
                  style={[
                    estilos.etiqueta,
                    { backgroundColor: urgenciaFundo(rotulo.urgencia) },
                  ]}
                >
                  <Text style={[estilos.etiquetaTexto, { color: urgenciaTexto(rotulo.urgencia) }]}>
                    {rotulo.texto}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>
      ) : null}

      {grupos.length === 0 && !carregando ? (
        <View style={estilos.centro}>
          <Text style={estilos.vazioTitulo}>Nenhuma vacina ainda</Text>
          <Text style={estilos.vazioTexto}>
            Registre a primeira vacina para acompanhar as próximas doses.
          </Text>
        </View>
      ) : null}

      {grupos.map((grupo) => (
        <View key={grupo.chave} style={components.card}>
          <Text style={estilos.tituloCartao}>{grupo.titulo}</Text>
          {grupo.itens.map((item, i) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityHint="Segure para editar ou apagar"
              onPress={grupo.chave === 'remedios' ? abrirMedicamentos : undefined}
              onLongPress={() => aoSegurar(grupo.chave, item)}
              delayLongPress={350}
              style={[estilos.linha, i === grupo.itens.length - 1 && estilos.ultima]}
            >
              <View style={estilos.flex}>
                <Text style={estilos.nome}>{item.titulo}</Text>
                {item.subtitulo ? <Text style={estilos.subtitulo}>{item.subtitulo}</Text> : null}
              </View>
              <Text style={estilos.data}>{item.quando}</Text>
            </Pressable>
          ))}
        </View>
      ))}

      <View style={components.card}>
        <View style={estilos.cabecalhoSecao}>
          <Text style={estilos.tituloSecao}>Consultas</Text>
          <Pressable accessibilityRole="link" onPress={abrirConsultas} hitSlop={8}>
            <Text style={estilos.linkSecao}>Ver todas ›</Text>
          </Pressable>
        </View>

        {consultas.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={abrirConsultas}
            style={({ pressed }) => [estilos.linha, pressed && { opacity: 0.6 }]}
          >
            <View style={estilos.flex}>
              <Text style={estilos.nome}>Nenhuma consulta registrada</Text>
              <Text style={estilos.subtitulo}>Toque para registrar a primeira.</Text>
            </View>
            <Text style={estilos.data}>›</Text>
          </Pressable>
        ) : (
          consultas.slice(0, 3).map((c, i) => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              onPress={abrirConsultas}
              style={[
                estilos.linha,
                (i === consultas.slice(0, 3).length - 1 || i === consultas.length - 1) &&
                  estilos.ultima,
              ]}
            >
              <View style={estilos.flex}>
                <Text style={estilos.nome}>{c.motivo}</Text>
                <Text style={estilos.subtitulo}>
                  {[c.local, c.veterinario].filter(Boolean).join(' · ') || null}
                </Text>
              </View>
              <Text style={estilos.data}>{dataParaExibicao(c.realizada_em)}</Text>
            </Pressable>
          ))
        )}
      </View>

      <View style={estilos.acoes}>
        <Pressable
          accessibilityRole="button"
          onPress={registrar}
          disabled={!petAtivo || salvando}
          style={({ pressed }) => [estilos.botaoRegistrar, pressed && estilos.pressionado]}
        >
          <Text style={estilos.botaoRegistrarTexto}>＋ Vacina</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={novoRemedio}
          disabled={!petAtivo || salvando}
          style={({ pressed }) => [estilos.botaoRegistrar, pressed && estilos.pressionado]}
        >
          <Text style={estilos.botaoRegistrarTexto}>＋ Remédio</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={novoPeso}
          disabled={!petAtivo || salvando}
          style={({ pressed }) => [estilos.botaoRegistrar, pressed && estilos.pressionado]}
        >
          <Text style={estilos.botaoRegistrarTexto}>＋ Peso</Text>
        </Pressable>
      </View>

      <Text style={estilos.dica}>Toque e segure um registro para remover.</Text>
    </ScrollView>
  )
}

function urgenciaFundo(u: string): string {
  if (u === 'vencida') return colors.dangerSurface
  if (u === 'hoje' || u === 'perto') return colors.warningSurface
  return colors.successSurface
}

function urgenciaTexto(u: string): string {
  if (u === 'vencida') return colors.danger
  if (u === 'hoje' || u === 'perto') return colors.warningText
  return colors.successText
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  conteudo: { padding: spacing.xl, paddingBottom: 40, gap: spacing.lg },
  centro: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  vazioTitulo: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  vazioTexto: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  faixaProximas: {
    backgroundColor: colors.primarySurface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  faixaTitulo: { ...typography.label, color: colors.primaryDeep },
  linhaProxima: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  proximaNome: { ...typography.bodyMedium, color: colors.text },
  proximaData: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  etiqueta: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
  etiquetaTexto: { ...typography.small, fontFamily: fontFamily.bold },
  tituloCartao: { ...typography.bodyMedium, color: colors.text, marginBottom: spacing.xs },
  tituloSecao: { ...typography.bodyMedium, fontFamily: fontFamily.bold, color: colors.text },
  cabecalhoSecao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  linkSecao: { fontSize: 13, fontFamily: fontFamily.semiBold, color: colors.primaryDeep },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ultima: { borderBottomWidth: 0 },
  nome: { ...typography.bodyMedium, color: colors.text },
  subtitulo: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  data: { ...typography.caption, color: colors.textMuted },
  botaoRegistrar: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoRegistrarTexto: { ...typography.button, color: colors.white },
  acoes: { flexDirection: 'row', gap: spacing.md },
  dica: { ...typography.small, color: colors.textMuted, textAlign: 'center' },
  pressionado: { opacity: 0.7 },
})
