import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { FormularioPet } from '../../../src/pets/FormularioPet'
import type { AtivoFoto } from '../../../src/pets/CampoFoto'
import { usePets } from '../../../src/pets/PetsProvider'
import { somenteParaEditavel } from '../../../src/pets/SomenteLeitura'
import type { Pet, PetForm } from '../../../src/pets/types'
import { registroParaForm } from '../../../src/pets/types'
import { colors } from '../../../src/theme/colors'

function EditarPet() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pets } = usePets()

  const pet = pets.find((p) => p.id === id) ?? null

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >

      <View style={estilos.flex}>
        {/* `key` remonta o form quando o pet chega do banco, já preenchido. */}
        {pet ? <Editor key={pet.id} pet={pet} /> : null}
      </View>
    </KeyboardAvoidingView>
  )
}

function Editor({ pet }: { pet: Pet }) {
  const { atualizarPet, salvarFoto, removerFoto, salvando } = usePets()
  const [form, setForm] = useState<PetForm>(() => registroParaForm(pet))
  // undefined = não mexeu; null = removeu; objeto = foto nova (local).
  const [foto, setFoto] = useState<AtivoFoto | null | undefined>(undefined)

  const alterar = (campo: keyof PetForm, valor: string | boolean) =>
    setForm((atual) => ({ ...atual, [campo]: valor }))

  const fotoExibida = foto === undefined ? pet.foto_url : (foto?.uri ?? null)

  const salvar = async () => {
    if (!form.nome.trim()) {
      Alert.alert('Falta o nome', 'Informe o nome do pet para continuar.')
      return
    }
    const salvo = await atualizarPet(pet.id, form)
    if (!salvo) return

    if (foto === null) {
      await removerFoto(pet.id)
    } else if (foto) {
      const url = await salvarFoto(pet.id, foto)
      if (!url) {
        Alert.alert(
          'Foto não enviada',
          'As alterações foram salvas, mas a foto não subiu. Tente de novo em Editar pet.',
        )
      }
    }
    router.back()
  }

  return (
    <>
      <FormularioPet
        form={form}
        onChange={alterar}
        titulo={`Editar ${pet.nome}`}
        foto={fotoExibida}
        onFoto={(ativo) => setFoto(ativo)}
      />

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
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  rodape: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    backgroundColor: colors.surface,
  },
})

export default somenteParaEditavel(EditarPet)
