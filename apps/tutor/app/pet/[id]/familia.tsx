import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Tocavel } from '../../../src/components/Animacoes'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { usePlano } from '../../../src/lib/plano'
import { mensagemDeErro } from '../../../src/lib/cacheOffline'
import { usePets } from '../../../src/pets/PetsProvider'
import { adicionarFamiliar, listarFamilia, removerFamiliar, type FamiliarPet } from '../../../src/pets/familia'
import { colors } from '../../../src/theme/colors'
import { fontFamily } from '../../../src/theme/typography'

export default function FamiliaPet() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pets } = usePets()
  const plano = usePlano()
  const pet = pets.find((p) => p.id === id)
  const [email, setEmail] = useState('')
  const [familia, setFamilia] = useState<FamiliarPet[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(() => {
    if (!id) return
    setCarregando(true)
    listarFamilia(id).then(
      (lista) => { setFamilia(lista); setErro(null) },
      (e: unknown) => setErro(mensagemDeErro(e instanceof Error ? e.message : String(e))),
    ).finally(() => setCarregando(false))
  }, [id])
  useFocusEffect(carregar)

  async function adicionar() {
    const emailLimpo = email.trim().toLowerCase()
    if (!id || !emailLimpo.includes('@')) {
      setErro('Digite o e-mail de uma conta PetLive.')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      await adicionarFamiliar(id, emailLimpo)
      setEmail('')
      carregar()
      Alert.alert('Acesso compartilhado', `${emailLimpo} agora pode ver e atualizar ${pet?.nome ?? 'este pet'} no PetLive.`)
    } catch (e) {
      setErro(mensagemDeErro(e instanceof Error ? e.message : String(e)))
    } finally {
      setSalvando(false)
    }
  }

  function confirmarRemocao(familiar: FamiliarPet) {
    Alert.alert(`Remover ${familiar.nome}?`, `Essa pessoa perderá o acesso a ${pet?.nome ?? 'este pet'} imediatamente.`, [
      { text: 'Manter acesso', style: 'cancel' },
      {
        text: 'Remover acesso',
        style: 'destructive',
        onPress: () => removerFamiliar(id, familiar.user_id).then(carregar, (e) => setErro(mensagemDeErro(e instanceof Error ? e.message : String(e)))),
      },
    ])
  }

  if (!pet) return <View style={[estilos.tela, estilos.centro]}><ActivityIndicator color={colors.primaryDeep} /></View>

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda titulo="Acesso da família" subtitulo={pet.nome} altura={190} />
      <ScrollView style={estilos.flex} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={estilos.intro}>Compartilhe o perfil de {pet.nome} com alguém que já tem uma conta PetLive. A pessoa poderá ver e atualizar os dados deste pet; pagamentos e sua conta continuam privados.</Text>

        {plano !== 'premium' ? (
          <View style={estilos.aviso}><Text style={estilos.avisoTitulo}>Disponível no Premium</Text><Text style={estilos.avisoTexto}>O tutor responsável por {pet.nome} precisa ter o Premium para liberar o acesso familiar.</Text></View>
        ) : (
          <View style={estilos.formulario}>
            <Text style={estilos.rotulo}>E-mail da conta PetLive</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="familia@email.com"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="E-mail da conta PetLive"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={254}
              style={estilos.campo}
            />
            <Text style={estilos.ajuda}>O acesso é liberado na hora. A pessoa precisa ter uma conta criada com esse e-mail.</Text>
            <BotaoPrimario titulo="Compartilhar acesso" onPress={adicionar} carregando={salvando} desabilitado={!email.trim()} />
          </View>
        )}

        {erro ? <Text accessibilityRole="alert" style={estilos.erro}>{erro}</Text> : null}

        <View style={estilos.listaCabecalho}><Text style={estilos.listaTitulo}>Quem tem acesso</Text><Text style={estilos.contagem}>{familia.length}</Text></View>
        {carregando ? <ActivityIndicator color={colors.primaryDeep} style={estilos.carregando} /> : null}
        {!carregando && familia.length === 0 ? <Text style={estilos.vazio}>Ninguém mais tem acesso a {pet.nome} ainda.</Text> : null}
        {familia.map((familiar) => (
          <View key={familiar.user_id} style={estilos.pessoa}>
            <View style={estilos.flex}><Text style={estilos.nome}>{familiar.nome}</Text><Text style={estilos.email}>{familiar.email}</Text></View>
            <Tocavel accessibilityRole="button" accessibilityLabel={`Remover acesso de ${familiar.nome}`} onPress={() => confirmarRemocao(familiar)} style={estilos.remover}>
              <Text style={estilos.removerTexto}>Remover</Text>
            </Tocavel>
          </View>
        ))}
        <Text style={estilos.privacidade}>Somente o tutor responsável pode adicionar ou remover pessoas. Remover alguém encerra o acesso imediatamente.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  centro: { alignItems: 'center', justifyContent: 'center' },
  conteudo: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 44, gap: 14 },
  intro: { color: colors.text, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 21 },
  formulario: { backgroundColor: colors.white, borderRadius: 24, padding: 18, gap: 10 },
  rotulo: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 14 },
  campo: { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: colors.text, fontFamily: fontFamily.regular, fontSize: 15 },
  ajuda: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 18 },
  aviso: { backgroundColor: colors.premiumSurface, borderRadius: 22, padding: 18, gap: 6 },
  avisoTitulo: { color: colors.premiumText, fontFamily: fontFamily.bold, fontSize: 15 },
  avisoTexto: { color: colors.premiumText, fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19 },
  erro: { color: colors.danger, fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 19 },
  listaCabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  listaTitulo: { color: colors.text, fontFamily: fontFamily.bold, fontSize: 17 },
  contagem: { color: colors.textMuted, fontFamily: fontFamily.medium, fontSize: 13 },
  carregando: { padding: 18 },
  vazio: { backgroundColor: colors.white, borderRadius: 20, padding: 18, color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19 },
  pessoa: { backgroundColor: colors.white, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  nome: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 14 },
  email: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 12, marginTop: 3 },
  remover: { backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  removerTexto: { color: colors.danger, fontFamily: fontFamily.semiBold, fontSize: 12 },
  privacidade: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 18, marginTop: 2 },
})
