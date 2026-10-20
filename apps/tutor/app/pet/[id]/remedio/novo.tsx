import { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { BotaoPrimario } from '../../../../src/components/BotaoPrimario'
import { CabecalhoTela } from '../../../../src/components/CabecalhoTela'
import { Campo } from '../../../../src/components/Campo'
import { useRemedios } from '../../../../src/remedios/RemediosProvider'
import type { RemedioForm } from '../../../../src/remedios/types'
import {
  FREQUENCIAS_SUGERIDAS,
  REMEDIO_FORM_VAZIO,
  hojeComoCampo,
} from '../../../../src/remedios/types'
import { colors } from '../../../../src/theme/colors'
import { typography } from '../../../../src/theme/typography'
import { radius, spacing } from '../../../../src/theme/tokens'

export default function NovoRemedio() {
  const { criarRemedio, salvando } = useRemedios()
  const [form, setForm] = useState<RemedioForm>({ ...REMEDIO_FORM_VAZIO, inicio: hojeComoCampo() })

  const alterar = (campo: keyof RemedioForm, valor: string) =>
    setForm((atual) => ({ ...atual, [campo]: valor }))

  const salvar = async () => {
    if (!form.nome.trim()) {
      Alert.alert('Falta o nome', 'Informe o nome do remédio.')
      return
    }
    if (!form.dose.trim()) {
      Alert.alert('Falta a dose', 'Ex.: "1/4 de comprimido" ou "2 ml".')
      return
    }
    if (!form.frequencia.trim()) {
      Alert.alert('Falta a frequência', 'Ex.: "2x ao dia" ou "a cada 8 horas".')
      return
    }
    if (!form.inicio.trim()) {
      Alert.alert('Falta a data', 'Informe quando o tratamento começa.')
      return
    }

    const remediaSalva = await criarRemedio(form)
    if (remediaSalva) router.back()
  }

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <CabecalhoTela titulo="Novo remédio" />

      <ScrollView
        style={estilos.flex}
        contentContainerStyle={estilos.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Campo
          rotulo="Nome do remédio"
          placeholder="Ex.: Amoxicilina"
          value={form.nome}
          onChangeText={(v) => alterar('nome', v)}
        />

        <Campo
          rotulo="Dose"
          variante="verde"
          placeholder='Ex.: "1/4 de comprimido", "2 ml"'
          value={form.dose}
          onChangeText={(v) => alterar('dose', v)}
        />

        <View style={estilos.bloco}>
          <Text style={estilos.rotulo}>Frequência</Text>
          <View style={estilos.pills}>
            {FREQUENCIAS_SUGERIDAS.map((frequencia) => {
              const ativa = form.frequencia === frequencia
              return (
                <Pressable
                  key={frequencia}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativa }}
                  onPress={() => alterar('frequencia', frequencia)}
                  style={[estilos.pill, ativa && estilos.pillAtiva]}
                >
                  <Text style={[estilos.pillTexto, ativa && estilos.pillTextoAtivo]}>
                    {frequencia}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <Campo
            rotulo="Ou digite"
            placeholder='Ex.: "a cada 6 horas"'
            value={form.frequencia}
            onChangeText={(v) => alterar('frequencia', v)}
          />
        </View>

        <Campo
          rotulo="Horários"
          variante="azul"
          placeholder="Ex.: 08:00, 14:00, 20:00"
          keyboardType="numbers-and-punctuation"
          value={form.horarios}
          onChangeText={(v) => alterar('horarios', v)}
        />

        <View style={estilos.linhaDupla}>
          <View style={estilos.metade}>
            <Campo
              rotulo="Começa em"
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              value={form.inicio}
              onChangeText={(v) => alterar('inicio', v)}
            />
          </View>
          <View style={estilos.metade}>
            <Campo
              rotulo="Termina em"
              placeholder="Opcional"
              keyboardType="number-pad"
              value={form.fim}
              onChangeText={(v) => alterar('fim', v)}
            />
          </View>
        </View>

        <Campo
          rotulo="Observação"
          variante="roxo"
          placeholder="Com ou sem alimento, suspender se…"
          value={form.observacao}
          onChangeText={(v) => alterar('observacao', v)}
          multiline
        />
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Iniciar tratamento" onPress={salvar} carregando={salvando} />
      </View>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  conteudo: { padding: spacing.xl, paddingBottom: 130, gap: spacing.lg },
  bloco: { gap: spacing.sm },
  rotulo: { ...typography.label, color: colors.text },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  pillAtiva: { backgroundColor: colors.black, borderColor: colors.black },
  pillTexto: { ...typography.captionMedium, color: colors.textMuted },
  pillTextoAtivo: { color: colors.white },
  linhaDupla: { flexDirection: 'row', gap: spacing.md },
  metade: { flex: 1 },
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
