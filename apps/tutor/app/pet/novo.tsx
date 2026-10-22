import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { MarcaPata } from '../../src/components/MarcaPata'
import { FormularioPet } from '../../src/pets/FormularioPet'
import type { AtivoFoto } from '../../src/pets/CampoFoto'
import { usePets } from '../../src/pets/PetsProvider'
import type { PetForm } from '../../src/pets/types'
import { FORM_VAZIO } from '../../src/pets/types'
import { colors } from '../../src/theme/colors'
import { fontFamily } from '../../src/theme/typography'

/**
 * Cadastro do pet (protótipo PerfilPet; board P0 "Cadastro do pet com foto
 * (Conheça seu pet)"): passo 1 com nome, espécie, raça e nascimento; passo 2
 * com sexo, peso e castração. A foto sobe depois que o pet existe.
 */
export default function NovoPet() {
  // Primeiro acesso: veio de Permissões e segue para o Início (BUSINESS.md 5.43).
  const { primeiroAcesso } = useLocalSearchParams<{ primeiroAcesso?: string }>()
  const { criarPet, salvarFoto, salvando, podeCadastrar } = usePets()
  // Só na abertura: depois de salvar, o limite cheio não tira o tutor daqui.
  const [semVaga] = useState(!podeCadastrar)
  const [form, setForm] = useState<PetForm>(FORM_VAZIO)
  const [passo, setPasso] = useState<1 | 2>(1)
  // A foto só vai para o Storage depois que o pet existe (precisa do id).
  const [foto, setFoto] = useState<AtivoFoto | null>(null)

  const alterar = (campo: keyof PetForm, valor: string | boolean) =>
    setForm((atual) => ({ ...atual, [campo]: valor }))

  const continuar = () => {
    if (!form.nome.trim()) {
      Alert.alert('Falta o nome', 'Informe o nome do pet para continuar.')
      return
    }
    setPasso(2)
  }

  const salvar = async () => {
    const pet = await criarPet(form)
    if (!pet) return

    if (foto) {
      const url = await salvarFoto(pet.id, foto)
      if (!url) {
        Alert.alert(
          'Foto não enviada',
          'O pet foi salvo, mas a foto não subiu. Você pode adicionar depois em Editar pet.',
        )
      }
    }
    if (primeiroAcesso === '1') router.replace('/inicio')
    else router.back()
  }

  // Chegou por um link com o limite já cheio: o convite Premium no lugar do cadastro.
  if (semVaga) return <Redirect href={{ pathname: '/premium', params: { motivo: 'limite_pets' } }} />

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FormularioPet
        form={form}
        onChange={alterar}
        titulo={passo === 1 ? 'Conheça seu pet' : `Mais sobre ${form.sexo === 'femea' ? 'a' : 'o'} ${form.nome.trim()}`}
        passo={passo}
        foto={foto?.uri ?? null}
        onFoto={setFoto}
        onVoltar={passo === 2 ? () => setPasso(1) : undefined}
      />

      <View style={estilos.rodape}>
        {passo === 1 ? (
          <BotaoPrimario titulo="Continuar" icone={<MarcaPata size={24} cor={colors.black} />} onPress={continuar} />
        ) : (
          <BotaoPrimario
            titulo="Salvar pet"
            icone={<Text style={estilos.check}>✓</Text>}
            onPress={salvar}
            carregando={salvando}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  check: { fontSize: 20, fontFamily: fontFamily.bold, color: colors.black },
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
