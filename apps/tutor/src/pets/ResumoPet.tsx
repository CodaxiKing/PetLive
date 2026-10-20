import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useVacinas } from '../saude/VacinasProvider'
import { diasAte, rotuloDose } from '../saude/types'
import { colors } from '../theme/colors'
import { radius, spacing } from '../theme/tokens'
import { typography } from '../theme/typography'
import { dataParaExibicao, idadeEmAnos, type Pet } from './types'

type Etiqueta = {
  valor: string
  rotulo: string
  fundo: string
  texto: string
}

/**
 * Resumo do pet no topo da ficha: aviso de vacina vencendo + as três
 * etiquetas Sexo / Idade / Peso (referência: tela "Pet, vacinas" do protótipo).
 */
export function ResumoPet({ pet }: { pet: Pet }) {
  const { vacinas } = useVacinas()

  // Vacina com a próxima dose mais urgente (menor contagem de dias).
  const proxima = useMemo(() => {
    let escolhida: (typeof vacinas)[number] | null = null
    let menor = Number.POSITIVE_INFINITY
    for (const vacina of vacinas) {
      const dias = diasAte(vacina.proxima_dose)
      if (dias != null && dias < menor) {
        menor = dias
        escolhida = vacina
      }
    }
    return escolhida
  }, [vacinas])

  const etiquetas: Etiqueta[] = [
    {
      valor: pet.sexo === 'femea' ? 'Fêmea' : 'Macho',
      rotulo: 'Sexo',
      fundo: colors.premiumSurface,
      texto: colors.premiumText,
    },
    {
      valor: idadeEmAnos(pet.nascimento) ?? '—',
      rotulo: 'Idade',
      fundo: colors.warningSurface,
      texto: colors.warningText,
    },
    {
      valor: pet.peso_atual != null ? `${pet.peso_atual} kg` : '—',
      rotulo: 'Peso',
      fundo: colors.successSurface,
      texto: colors.successText,
    },
  ]

  const rotulo = proxima ? rotuloDose(proxima.proxima_dose) : null

  return (
    <View style={estilos.bloco}>
      {rotulo && rotulo.urgencia !== 'ok' && rotulo.urgencia !== 'nenhuma' ? (
        <View style={[estilos.aviso, { backgroundColor: fundoUrgencia(rotulo.urgencia) }]}>
          <Text style={[estilos.avisoTexto, { color: textoUrgencia(rotulo.urgencia) }]}>
            {proxima?.nome} {rotulo.texto}
          </Text>
        </View>
      ) : null}

      <View style={estilos.linha}>
        {etiquetas.map((etiqueta) => (
          <View key={etiqueta.rotulo} style={[estilos.etiqueta, { backgroundColor: etiqueta.fundo }]}>
            <Text style={[estilos.etiquetaValor, { color: etiqueta.texto }]} numberOfLines={1}>
              {etiqueta.valor}
            </Text>
            <Text style={[estilos.etiquetaRotulo, { color: etiqueta.texto }]}>{etiqueta.rotulo}</Text>
          </View>
        ))}
      </View>

      {pet.nascimento ? (
        <Text style={estilos.nascimento}>Nascido em {dataParaExibicao(pet.nascimento)}</Text>
      ) : null}
    </View>
  )
}

function fundoUrgencia(urgencia: string): string {
  if (urgencia === 'vencida' || urgencia === 'hoje') return colors.dangerSurface
  if (urgencia === 'perto') return colors.warningSurface
  return colors.primarySurface
}

function textoUrgencia(urgencia: string): string {
  if (urgencia === 'vencida' || urgencia === 'hoje') return colors.danger
  if (urgencia === 'perto') return colors.warningText
  return colors.primaryDeep
}

const estilos = StyleSheet.create({
  bloco: { gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  aviso: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  avisoTexto: { ...typography.captionMedium, fontWeight: '700' },
  linha: { flexDirection: 'row', gap: spacing.sm },
  etiqueta: {
    flex: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  etiquetaValor: { ...typography.h3, fontWeight: '800' },
  etiquetaRotulo: { ...typography.caption, opacity: 0.85 },
  nascimento: { ...typography.small, color: colors.textMuted },
})
