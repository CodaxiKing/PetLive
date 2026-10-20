import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { CabecalhoTela } from '../../src/components/CabecalhoTela'
import { FormularioPet } from '../../src/pets/FormularioPet'
import { usePets } from '../../src/pets/PetsProvider'
import type { PetForm } from '../../src/pets/types'
import { FORM_VAZIO } from '../../src/pets/types'
import { colors } from '../../src/theme/colors'

export default function NovoPet() {
  const { criarPet, salvando } = usePets()
  const [form, setForm] = useState<PetForm>(FORM_VAZIO)

  const alterar = (campo: keyof PetForm, valor: string | boolean) =>
    setForm((atual) => ({ ...atual, [campo]: valor }))

  const salvar = async () => {
    if (!form.nome.trim()) {
      Alert.alert('Falta o nome', 'Informe o nome do pet para continuar.')
      return
    }
    const pet = await criarPet(form)
    if (pet) router.back()
  }

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <CabecalhoTela titulo="Novo pet" />

      <View style={estilos.flex}>
        <FormularioPet form={form} onChange={alterar} />
      </View>

      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Salvar pet" onPress={salvar} carregando={salvando} />
      </View>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  rodape: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    backgroundColor: colors.background,
  },
})
