import { useRef, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { FormularioPet } from '../../src/pets/FormularioPet'
import type { AtivoFoto } from '../../src/pets/CampoFoto'
import { usePets } from '../../src/pets/PetsProvider'
import type { PetForm } from '../../src/pets/types'
import { FORM_VAZIO, validarFormularioPet } from '../../src/pets/types'
import { colors } from '../../src/theme/colors'
import { fontFamily } from '../../src/theme/typography'
import { useLimitesPlano } from '../../src/premium/useLimitesPlano'
import { limiteCadastroAtingido } from '../../src/premium/limites'

/**
 * Cadastro do pet (protótipo PerfilPet; board P0 "Cadastro do pet com foto
 * (Conheça seu pet)"): passo 1 com nome, espécie, raça e nascimento; passo 2
 * com sexo, peso e castração. A foto sobe depois que o pet existe.
 */
export default function NovoPet() {
  // Primeiro acesso: veio de Permissões e segue para o Início (BUSINESS.md 5.43).
  const { primeiroAcesso } = useLocalSearchParams<{ primeiroAcesso?: string }>()
  const { criarPet, salvarFoto, salvando, erro } = usePets()
  const limites = useLimitesPlano()
  const cadastroBloqueado = limiteCadastroAtingido(limites?.dados)
  const trava = useRef(false)
  const [enviando, setEnviando] = useState(false)
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
    if (trava.current) return
    if (cadastroBloqueado) return
    const erroFormulario = validarFormularioPet(form)
    if (erroFormulario) { Alert.alert('Confira os dados', erroFormulario); return }
    trava.current = true
    setEnviando(true)
    try {
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
    } catch {
      Alert.alert('Não foi possível concluir', 'Confira sua conexão. Se o pet já aparecer na lista, adicione a foto em Editar pet.')
    } finally { trava.current = false; setEnviando(false) }
  }

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
        {cadastroBloqueado ? <Text accessibilityRole="alert" style={estilos.erro}>O limite de cadastro do seu plano foi atingido. Seus pets e históricos continuam disponíveis.</Text> : null}
        {erro ? <Text accessibilityRole="alert" style={estilos.erro}>{erro}</Text> : null}
        {passo === 1 ? (
          <BotaoPrimario titulo="Continuar" desabilitado={cadastroBloqueado} onPress={continuar} />
        ) : (
          <BotaoPrimario
            titulo="Salvar pet"
            onPress={salvar}
            desabilitado={cadastroBloqueado}
            carregando={salvando || enviando}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  erro: { color: colors.danger, fontFamily: fontFamily.medium, fontSize: 13, marginBottom: 10 },
  check: { fontSize: 20, fontFamily: fontFamily.bold, color: colors.black },
  rodape: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    backgroundColor: colors.background,
  },
})
