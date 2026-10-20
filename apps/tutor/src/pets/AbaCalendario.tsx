import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { usePets } from './PetsProvider'
import { useVacinas } from '../saude/VacinasProvider'
import { dataParaExibicao, rotuloDose, somarDias } from '../saude/types'
import { colors } from '../theme/colors'
import { typography } from '../theme/typography'
import { components, radius, spacing } from '../theme/tokens'

/**
 * Aba "Calendário": o que o pet já tomou e o que ainda falta, a partir do
 * calendário sugerido (vaccine_schedule) cruzado com as vacinas registradas.
 */
export function AbaCalendario() {
  const { petAtivo } = usePets()
  const { sugeridas, vacinas } = useVacinas()

  const nascimento = petAtivo?.nascimento ?? null

  /** Nome (em minúsculas) das vacinas já aplicadas. */
  const aplicadas = useMemo(() => {
    const mapa = new Map<string, string | null>()
    for (const v of vacinas) mapa.set(v.nome.trim().toLowerCase(), v.proxima_dose)
    return mapa
  }, [vacinas])

  const linhas = useMemo(() => {
    return sugeridas.map((sugestao) => {
      const chave = sugestao.nome.trim().toLowerCase()
      const proximaJaAgendada = aplicadas.get(chave) ?? null

      // Sem nascimento não dá pra calcular a idade; mostra só o que falta.
      const previstaPrimeira = nascimento
        ? somarDias(nascimento, sugestao.primeira_dose_dias)
        : null

      const status = proximaJaAgendada
        ? { tipo: 'agendada' as const, data: proximaJaAgendada }
        : previstaPrimeira
          ? { tipo: 'pendente' as const, data: previstaPrimeira }
          : { tipo: 'semdata' as const, data: null }

      return { sugestao, status }
    })
  }, [sugeridas, aplicadas, nascimento])

  if (linhas.length === 0) {
    return (
      <View style={estilos.centro}>
        <Text style={estilos.vazioTitulo}>Calendário indisponível</Text>
        <Text style={estilos.vazioTexto}>
          Sem o calendário da espécie não dá pra sugerir doses.
        </Text>
      </View>
    )
  }

  const pendentes = linhas.filter((l) => l.status.tipo === 'pendente').length

  return (
    <ScrollView
      contentContainerStyle={estilos.conteudo}
      showsVerticalScrollIndicator={false}
    >
      <View style={estilos.resumo}>
        <Text style={estilos.resumoNumero}>{linhas.length}</Text>
        <Text style={estilos.resumoTexto}>
          {linhas.length === 1 ? 'vacina sugerida' : 'vacinas sugeridas'}
          {pendentes > 0 ? ` · ${pendentes} pendente${pendentes === 1 ? '' : 's'}` : ''}
        </Text>
      </View>

      <View style={components.card}>
        {linhas.map((linha, i) => {
          const rotulo = linha.status.data ? rotuloDose(linha.status.data) : null
          const vencida = rotulo?.urgencia === 'vencida'
          return (
            <View
              key={linha.sugestao.id}
              style={[estilos.linha, i === linhas.length - 1 && estilos.ultima]}
            >
              <View style={[estilos.ponto, { backgroundColor: corPonto(linha.status.tipo, vencida) }]} />

              <View style={estilos.flex}>
                <Text style={estilos.nome}>{linha.sugestao.nome}</Text>
                {linha.sugestao.descricao ? (
                  <Text style={estilos.descricao} numberOfLines={2}>
                    {linha.sugestao.descricao}
                  </Text>
                ) : null}
                {linha.status.data ? (
                  <Text style={[estilos.data, vencida && estilos.dataVencida]}>
                    {linha.status.tipo === 'agendada' ? 'próxima ' : 'prevista '}
                    {dataParaExibicao(linha.status.data)}
                    {rotulo ? ` · ${rotulo.texto}` : ''}
                  </Text>
                ) : (
                  <Text style={estilos.data}>Informe a nascimento para calcular</Text>
                )}
              </View>
            </View>
          )
        })}
      </View>

      <Text style={estilos.rodapeNota}>
        Sugestão baseada no calendário padrão. Confirme com o veterinário do seu pet.
      </Text>
    </ScrollView>
  )
}

function corPonto(tipo: string, vencida: boolean): string {
  if (vencida) return colors.danger
  if (tipo === 'agendada') return colors.successText
  return colors.borderStrong
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  conteudo: { padding: spacing.xl, paddingBottom: 40, gap: spacing.lg },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  vazioTitulo: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  vazioTexto: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  resumo: {
    backgroundColor: colors.successSurface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  resumoNumero: { ...typography.h1, fontSize: 34, lineHeight: 38, color: colors.successText },
  resumoTexto: { ...typography.caption, color: colors.successText, marginTop: 2 },
  linha: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ultima: { borderBottomWidth: 0 },
  ponto: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  nome: { ...typography.bodyMedium, color: colors.text },
  descricao: { ...typography.caption, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  data: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  dataVencida: { color: colors.danger, fontWeight: '700' },
  rodapeNota: { ...typography.small, color: colors.textMuted, textAlign: 'center' },
})
