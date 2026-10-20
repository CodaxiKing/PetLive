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
import { useVacinas } from '../saude/VacinasProvider'
import { dataParaExibicao, rotuloDose } from '../saude/types'
import { colors } from '../theme/colors'
import { typography } from '../theme/typography'
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
  const [outros, setOutros] = useState<GrupoOutros[]>([])
  const [atualizando, setAtualizando] = useState(false)

  const petId = petAtivo?.id ?? null

  const carregarOutros = useCallback(() => {
    const consulta = petId
      ? Promise.all([
          supabase
            .from('dewormings')
            .select('id, produto, aplicado_em, proxima_dose')
            .eq('pet_id', petId)
            .order('aplicado_em', { ascending: false }),
          supabase
            .from('medications')
            .select('id, nome, dose, frequencia, inicio')
            .eq('pet_id', petId)
            .eq('ativo', true)
            .order('inicio', { ascending: false }),
        ])
      : Promise.resolve(null)

    return consulta.then((resultado) => {
      if (!resultado) {
        setOutros([])
        return
      }
      const [vermifugos, remedios] = resultado
      setOutros([
        {
          chave: 'vermifugos',
          titulo: 'Vermífugos',
          itens: (vermifugos.data ?? []).map((v) => ({
            id: v.id,
            titulo: v.produto ?? 'Vermífugo',
            subtitulo: v.proxima_dose ? `próxima ${dataParaExibicao(v.proxima_dose)}` : null,
            quando: dataParaExibicao(v.aplicado_em),
          })),
        },
        {
          chave: 'remedios',
          titulo: 'Remédios em uso',
          itens: (remedios.data ?? []).map((m) => ({
            id: m.id,
            titulo: m.nome,
            subtitulo: `${m.dose} · ${m.frequencia}`,
            quando: dataParaExibicao(m.inicio),
          })),
        },
      ])
    })
  }, [petId])

  useEffect(() => {
    carregarOutros()
  }, [carregarOutros])

  const atualizar = useCallback(async () => {
    setAtualizando(true)
    await Promise.all([recarregar(), carregarOutros()])
    setAtualizando(false)
  }, [recarregar, carregarOutros])

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
      proxima: v.proxima_dose,
    })),
  }

  const grupos = [grupoVacinas, ...outros].filter((g) => g.itens.length > 0)

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
              onLongPress={
                grupo.chave === 'vacinas'
                  ? () => confirmarRemocao(item.id, item.titulo)
                  : undefined
              }
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

      <Pressable
        accessibilityRole="button"
        onPress={registrar}
        disabled={!petAtivo || salvando}
        style={({ pressed }) => [estilos.botaoRegistrar, pressed && estilos.pressionado]}
      >
        <Text style={estilos.botaoRegistrarTexto}>＋ Registrar vacina</Text>
      </Pressable>
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
  etiquetaTexto: { ...typography.small, fontWeight: '700' },
  tituloCartao: { ...typography.bodyMedium, color: colors.text, marginBottom: spacing.xs },
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
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoRegistrarTexto: { ...typography.button, color: colors.white },
  pressionado: { opacity: 0.7 },
})
