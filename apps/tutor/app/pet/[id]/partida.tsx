import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { Campo } from '../../../src/components/Campo'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { Icone } from '../../../src/components/Icone'
import { mensagemDeErro } from '../../../src/lib/cacheOffline'
import { registrarPartida } from '../../../src/pets/memorial'
import { usePets } from '../../../src/pets/PetsProvider'
import { dataParaIso, hojeComoCampo } from '../../../src/saude/types'
import { colors } from '../../../src/theme/colors'
import { fontFamily } from '../../../src/theme/typography'

/**
 * Registrar a partida (protótipos RegistrarPartida e ConfirmarPartida): data,
 * mensagem opcional e o que muda. Só a folha de confirmação grava, para
 * evitar o toque sem querer. Tom sereno, sem pressa.
 */
export default function TelaPartida() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pets, recarregar } = usePets()
  const pet = pets.find((p) => p.id === id) ?? null
  const [data, setData] = useState(hojeComoCampo())
  const [mensagem, setMensagem] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  if (!pet) return <View style={estilos.tela} />
  const nome = pet.nome
  const doPet = `${pet.sexo === 'femea' ? 'da' : 'do'} ${nome}`

  function continuar() {
    const iso = dataParaIso(data)
    if (!iso || iso > new Date().toISOString().slice(0, 10)) {
      Alert.alert('Confira a data', 'Use o formato DD/MM/AAAA, até hoje.')
      return
    }
    setConfirmando(true)
  }

  async function registrar() {
    const iso = dataParaIso(data)
    if (!iso || !pet) return
    setSalvando(true)
    try {
      await registrarPartida(pet.id, iso, mensagem)
      await recarregar()
      setConfirmando(false)
      router.replace({ pathname: '/pet/[id]/memorial', params: { id: pet.id } })
    } catch (e) {
      Alert.alert('Não deu para registrar', mensagemDeErro(e instanceof Error ? e.message : String(e)))
    } finally {
      setSalvando(false)
    }
  }

  const muda = [
    `Pausamos os lembretes e avisos ${doPet}`,
    'A linha do tempo e as fotos ficam guardadas',
    'Você pode baixar um álbum de lembranças',
    'Se foi engano, dá para reativar',
  ]

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda fundo={colors.premiumSurface} subtitulo={nome} titulo="Registrar a partida" altura={200} />
      <ScrollView style={estilos.flex} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={estilos.intro}>
          Sentimos muito pela partida {doPet}. Quando quiser, registre aqui. Nada será apagado.
        </Text>
        <Campo rotulo="Data" mascara="data" placeholder="DD/MM/AAAA" value={data} onChangeText={setData} maxLength={10} />
        <Campo
          rotulo="Uma mensagem para guardar (opcional)"
          placeholder={`Obrigado por tudo, ${nome}.`}
          value={mensagem}
          onChangeText={setMensagem}
          maxLength={300}
        />
        <Text style={estilos.secao}>O que muda no app</Text>
        {muda.map((item) => (
          <View key={item} style={estilos.item}>
            <View style={estilos.check}>
              <Icone nome="check" size={16} cor={colors.primary} espessura={2.4} />
            </View>
            <Text style={estilos.itemTexto}>{item}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Continuar" onPress={continuar} />
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={10}>
          <Text style={estilos.voltar}>Voltar</Text>
        </Pressable>
      </View>

      <Modal visible={confirmando} transparent animationType="slide" onRequestClose={() => setConfirmando(false)}>
        <Pressable style={estilos.fundoFolha} onPress={() => !salvando && setConfirmando(false)} accessibilityLabel="Fechar">
          <Pressable style={estilos.folha}>
            <View style={estilos.alca} />
            <Text style={estilos.folhaTitulo}>Registrar a partida {doPet}?</Text>
            <Text style={estilos.folhaTexto}>
              Os lembretes e avisos {doPet} serão pausados, e os links e acessos de cuidador, encerrados. Nada é apagado.
            </Text>
            <Text style={estilos.folhaNota}>
              Foi sem querer? Você pode <Text style={estilos.negrito}>desfazer a qualquer momento</Text> na tela Em memória.
            </Text>
            <BotaoPrimario titulo="Registrar com carinho" carregando={salvando} onPress={registrar} />
            <Pressable accessibilityRole="button" disabled={salvando} onPress={() => setConfirmando(false)} style={estilos.botaoVoltar}>
              <Text style={estilos.botaoVoltarTexto}>Voltar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  intro: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24, color: '#5E6878' },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  check: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  itemTexto: { flex: 1, fontFamily: fontFamily.regular, fontSize: 15, color: colors.black },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24, gap: 14 },
  voltar: { fontFamily: fontFamily.bold, fontSize: 15, color: '#6A7484', textAlign: 'center' },
  fundoFolha: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  folha: { backgroundColor: colors.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 32, gap: 14 },
  alca: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#D5DAE2' },
  folhaTitulo: { fontFamily: fontFamily.bold, fontSize: 24, letterSpacing: -0.5, color: colors.black },
  folhaTexto: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, color: '#5E6878' },
  folhaNota: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: '#2B3A4A', backgroundColor: colors.background, borderRadius: 18, overflow: 'hidden', padding: 14 },
  negrito: { fontFamily: fontFamily.bold },
  botaoVoltar: { height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: '#E1E6EE', alignItems: 'center', justifyContent: 'center' },
  botaoVoltarTexto: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
})
