import { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { BotaoPrimario } from '../../../../src/components/BotaoPrimario'
import { CabecalhoTela } from '../../../../src/components/CabecalhoTela'
import { Campo } from '../../../../src/components/Campo'
import {
  CONSULTA_FORM_VAZIO,
  registrarConsulta,
  type ConsultaForm,
} from '../../../../src/saude/consultas'
import { dataParaIso, hojeComoCampo } from '../../../../src/saude/types'
import { colors } from '../../../../src/theme/colors'
import { spacing } from '../../../../src/theme/tokens'

/**
 * Registrar consulta (board: [APP-CLIENTE] "Saúde: Registrar consulta").
 * Data futura vale: a consulta aparece como "agendada" na tela de consultas.
 */
export default function NovaConsulta() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [form, setForm] = useState<ConsultaForm>({
    ...CONSULTA_FORM_VAZIO,
    realizada_em: hojeComoCampo(),
  })
  const [salvando, setSalvando] = useState(false)

  const alterar = (campo: keyof ConsultaForm, valor: string) =>
    setForm((atual) => ({ ...atual, [campo]: valor }))

  const salvar = async () => {
    if (!form.motivo.trim()) {
      Alert.alert('Falta o motivo', 'Descreva o motivo da consulta (ex.: check-up).')
      return
    }
    const data = dataParaIso(form.realizada_em)
    if (!data) {
      Alert.alert('Data inválida', 'Use o formato DD/MM/AAAA.')
      return
    }

    setSalvando(true)
    try {
      await registrarConsulta(id, { ...form, realizada_em: data })
      router.back()
    } catch (e) {
      Alert.alert('Não foi possível salvar', e instanceof Error ? e.message : String(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <CabecalhoTela titulo="Registrar consulta" />

      <ScrollView
        style={estilos.flex}
        contentContainerStyle={estilos.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Campo
          rotulo="Motivo"
          variante="azul"
          placeholder="Ex.: Check-up, retorno, vacinação…"
          value={form.motivo}
          onChangeText={(v) => alterar('motivo', v)}
          editable={!salvando}
        />

        <Campo
          rotulo="Data"
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          value={form.realizada_em}
          onChangeText={(v) => alterar('realizada_em', v)}
          editable={!salvando}
        />

        <Campo
          rotulo="Local"
          variante="verde"
          placeholder="Clínica ou consultório"
          value={form.local}
          onChangeText={(v) => alterar('local', v)}
          editable={!salvando}
        />

        <Campo
          rotulo="Veterinário"
          placeholder="Opcional"
          autoCapitalize="words"
          value={form.veterinario}
          onChangeText={(v) => alterar('veterinario', v)}
          editable={!salvando}
        />

        <Campo
          rotulo="Observação"
          variante="roxo"
          placeholder="Diagnóstico, orientações, valor…"
          value={form.observacao}
          onChangeText={(v) => alterar('observacao', v)}
          multiline
          editable={!salvando}
        />
      </ScrollView>

      <BotaoPrimario
        titulo="Salvar consulta"
        onPress={salvar}
        carregando={salvando}
        desabilitado={salvando}
        estilo={estilos.botao}
      />
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  conteudo: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  botao: { marginHorizontal: spacing.xl, marginBottom: 32 },
})
