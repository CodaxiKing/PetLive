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
import { router, useLocalSearchParams } from 'expo-router'
import { BotaoPrimario } from '../../../../src/components/BotaoPrimario'
import { CabecalhoTela } from '../../../../src/components/CabecalhoTela'
import { Campo } from '../../../../src/components/Campo'
import { usePets } from '../../../../src/pets/PetsProvider'
import { useVacinas } from '../../../../src/saude/VacinasProvider'
import type { VacinaForm } from '../../../../src/saude/types'
import { VACINA_FORM_VAZIO, hojeComoCampo } from '../../../../src/saude/types'
import { colors } from '../../../../src/theme/colors'
import { typography } from '../../../../src/theme/typography'
import { components, spacing } from '../../../../src/theme/tokens'

export default function NovaVacina() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pets } = usePets()
  const { sugeridas, registrarVacina, salvando, sugerirProximaDose } = useVacinas()

  const pet = pets.find((p) => p.id === id) ?? null
  const [form, setForm] = useState<VacinaForm>({ ...VACINA_FORM_VAZIO, aplicada_em: hojeComoCampo() })
  const [nomeCustomizado, setNomeCustomizado] = useState(false)

  const alterar = (campo: keyof VacinaForm, valor: string) =>
    setForm((atual) => ({ ...atual, [campo]: valor }))

  const escolherSugestao = (nome: string) => {
    setNomeCustomizado(false)
    setForm((atual) => {
      const proxima = sugerirProximaDose(nome, hojeComoCampo())
      return { ...atual, nome, proxima_dose: proxima ?? atual.proxima_dose }
    })
  }

  const salvar = async () => {
    if (!form.nome.trim()) {
      Alert.alert('Falta o nome', 'Escolha uma vacina ou digite o nome dela.')
      return
    }
    if (!form.aplicada_em.trim()) {
      Alert.alert('Falta a data', 'Informe quando a vacina foi aplicada.')
      return
    }
    const vacina = await registrarVacina(form)
    if (vacina) router.back()
  }

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <CabecalhoTela titulo="Registrar vacina" />

      <ScrollView
        style={estilos.flex}
        contentContainerStyle={estilos.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!nomeCustomizado && sugeridas.length > 0 ? (
          <View style={estilos.bloco}>
            <Text style={estilos.rotulo}>Sugeridas para {pet?.nome ?? 'seu pet'}</Text>
            <View style={estilos.pills}>
              {sugeridas.map((sugestao) => {
                const ativa = form.nome === sugestao.nome
                return (
                  <Pressable
                    key={sugestao.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: ativa }}
                    onPress={() => escolherSugestao(sugestao.nome)}
                    style={[components.pill, ativa && estilos.pillAtiva]}
                  >
                    <Text style={[estilos.pillTexto, ativa && estilos.pillTextoAtivo]}>
                      {sugestao.nome}
                    </Text>
                  </Pressable>
                )
              })}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setNomeCustomizado(true)
                  alterar('nome', '')
                }}
                style={components.pill}
              >
                <Text style={estilos.pillTexto}>＋ Outra</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {nomeCustomizado ? (
          <Campo
            rotulo="Nome da vacina"
            placeholder="Ex.: V10, Antirrábica…"
            value={form.nome}
            onChangeText={(v) => alterar('nome', v)}
          />
        ) : null}

        <Campo
          rotulo="Aplicada em"
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          value={form.aplicada_em}
          onChangeText={(v) => alterar('aplicada_em', v)}
        />

        <Campo
          rotulo="Próxima dose"
          variante="azul"
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          value={form.proxima_dose}
          onChangeText={(v) => alterar('proxima_dose', v)}
        />

        <View style={estilos.linhaDupla}>
          <View style={estilos.metade}>
            <Campo
              rotulo="Lote"
              placeholder="Opcional"
              autoCapitalize="characters"
              value={form.lote}
              onChangeText={(v) => alterar('lote', v)}
            />
          </View>
          <View style={estilos.metade}>
            <Campo
              rotulo="Local"
              variante="verde"
              placeholder="Clínica"
              value={form.local}
              onChangeText={(v) => alterar('local', v)}
            />
          </View>
        </View>

        <Campo
          rotulo="Observação"
          variante="roxo"
          placeholder="Reação, veterinário, orientações…"
          value={form.observacao}
          onChangeText={(v) => alterar('observacao', v)}
          multiline
        />
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Salvar vacina" onPress={salvar} carregando={salvando} />
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
