import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { CabecalhoTela } from '../../../src/components/CabecalhoTela'
import { FormularioPet } from '../../../src/pets/FormularioPet'
import { usePets } from '../../../src/pets/PetsProvider'
import type { Pet, PetForm } from '../../../src/pets/types'
import { registroParaForm } from '../../../src/pets/types'
import { colors } from '../../../src/theme/colors'

export default function EditarPet() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pets } = usePets()

  const pet = pets.find((p) => p.id === id) ?? null

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <CabecalhoTela titulo="Editar pet" />

      <View style={estilos.flex}>
        {/* `key` remonta o form quando o pet chega do banco, já preenchido. */}
        {pet ? <Editor key={pet.id} pet={pet} /> : null}
      </View>
    </KeyboardAvoidingView>
  )
}

function Editor({ pet }: { pet: Pet }) {
  const { atualizarPet, salvando } = usePets()
  const [form, setForm] = useState<PetForm>(() => registroParaForm(pet))

  const alterar = (campo: keyof PetForm, valor: string | boolean) =>
    setForm((atual) => ({ ...atual, [campo]: valor }))

  const salvar = async () => {
    if (!form.nome.trim()) {
      Alert.alert('Falta o nome', 'Informe o nome do pet para continuar.')
      return
    }
    const salvo = await atualizarPet(pet.id, form)
    if (salvo) router.back()
  }

  return (
    <>
      <FormularioPet form={form} onChange={alterar} />

      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo="Salvar alterações"
          onPress={salvar}
          carregando={salvando}
        />
      </View>
    </>
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
