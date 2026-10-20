import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../theme/colors'
import { typography } from '../theme/typography'
import { components, spacing } from '../theme/tokens'
import { usePets } from './PetsProvider'
import { dataParaExibicao } from './types'

interface Linha {
  id: string
  titulo: string
  subtitulo: string | null
  quando: string | null
}

interface Grupo {
  chave: string
  titulo: string
  itens: Linha[]
}

/** Aba "Saúde": vacinas, vermífugos e medicamentos do pet selecionado. */
export function AbaSaude() {
  const { petAtivo } = usePets()
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(() => {
    // Sem pet não há consulta; resolve vazio para o estado passar pela
    // fronteira assíncrona (mesmo motivo do .then() no AuthProvider).
    const consulta = petAtivo
      ? Promise.all([
          supabase
            .from('vaccinations')
            .select('id, nome, aplicada_em, proxima_dose, local')
            .eq('pet_id', petAtivo.id)
            .order('aplicada_em', { ascending: false }),
          supabase
            .from('dewormings')
            .select('id, produto, aplicado_em, proxima_dose')
            .eq('pet_id', petAtivo.id)
            .order('aplicado_em', { ascending: false }),
          supabase
            .from('medications')
            .select('id, nome, dose, frequencia, inicio, fim, ativo')
            .eq('pet_id', petAtivo.id)
            .eq('ativo', true)
            .order('inicio', { ascending: false }),
        ])
      : Promise.resolve(null)

    return consulta.then((resultado) => {
      if (!resultado) {
        setGrupos([])
        setErro(null)
        setCarregando(false)
        setAtualizando(false)
        return
      }

      const [vacinas, vermifugos, remedios] = resultado
      const falha = vacinas.error ?? vermifugos.error ?? remedios.error
      setErro(falha ? falha.message : null)

      const proximo = (iso: string | null) =>
        iso ? `próxima ${dataParaExibicao(iso)}` : null

      setGrupos([
        {
          chave: 'vacinas',
          titulo: 'Vacinas',
          itens: (vacinas.data ?? []).map((v) => ({
            id: v.id,
            titulo: v.nome,
            subtitulo: v.local ?? null,
            quando: proximo(v.proxima_dose) ?? dataParaExibicao(v.aplicada_em),
          })),
        },
        {
          chave: 'vermifugos',
          titulo: 'Vermífugos',
          itens: (vermifugos.data ?? []).map((v) => ({
            id: v.id,
            titulo: v.produto ?? 'Vermífugo',
            subtitulo: null,
            quando: proximo(v.proxima_dose) ?? dataParaExibicao(v.aplicado_em),
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

      setCarregando(false)
      setAtualizando(false)
    })
  }, [petAtivo])

  useEffect(() => {
    carregar()
  }, [carregar])

  const vazio = !carregando && grupos.every((g) => g.itens.length === 0)

  return (
    <ScrollView
      contentContainerStyle={estilos.conteudo}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={atualizando}
          onRefresh={() => {
            setAtualizando(true)
            carregar()
          }}
          tintColor={colors.primaryDeep}
        />
      }
    >
      {carregando ? (
        <View style={estilos.centro}>
          <ActivityIndicator color={colors.primaryDeep} />
        </View>
      ) : null}

      {erro ? <Text style={estilos.erro}>Não foi possível carregar: {erro}</Text> : null}

      {vazio ? (
        <View style={estilos.centro}>
          <Text style={estilos.vazioTitulo}>Nada registrado ainda</Text>
          <Text style={estilos.vazioTexto}>
            Vacinas, vermífugos e remédios em uso aparecem aqui.
          </Text>
        </View>
      ) : null}

      {grupos
        .filter((g) => g.itens.length > 0)
        .map((grupo) => (
          <View key={grupo.chave} style={components.card}>
            <Text style={estilos.tituloCartao}>{grupo.titulo}</Text>
            {grupo.itens.map((item, i) => (
              <View
                key={item.id}
                style={[estilos.linha, i === grupo.itens.length - 1 && estilos.ultima]}
              >
                <View style={estilos.flex}>
                  <Text style={estilos.nome}>{item.titulo}</Text>
                  {item.subtitulo ? (
                    <Text style={estilos.subtitulo}>{item.subtitulo}</Text>
                  ) : null}
                </View>
                {item.quando ? <Text style={estilos.data}>{item.quando}</Text> : null}
              </View>
            ))}
          </View>
        ))}
    </ScrollView>
  )
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  conteudo: { padding: spacing.xl, paddingBottom: 40, gap: spacing.lg },
  centro: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  vazioTitulo: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  vazioTexto: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  erro: { ...typography.caption, color: colors.danger, textAlign: 'center' },
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
})
