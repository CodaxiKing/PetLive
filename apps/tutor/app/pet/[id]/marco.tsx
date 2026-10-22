import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../../../src/auth/AuthProvider'
import { Tocavel } from '../../../src/components/Animacoes'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { Campo } from '../../../src/components/Campo'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { Icone } from '../../../src/components/Icone'
import { mensagemDeErro } from '../../../src/lib/cacheOffline'
import { escolherFoto, type AtivoFoto } from '../../../src/pets/CampoFoto'
import { apagarMarco, carregarMarco, enviarFotoMarco, removerFotoMarco, salvarMarco, urlsFotos, type Marco } from '../../../src/pets/linhaDoTempo'
import { usePets } from '../../../src/pets/PetsProvider'
import { somenteParaEditavel } from '../../../src/pets/SomenteLeitura'
import { dataParaExibicao, dataParaIso, hojeComoCampo } from '../../../src/saude/types'
import { colors } from '../../../src/theme/colors'
import { fontFamily } from '../../../src/theme/typography'

const SUGESTOES = ['Chegou em casa', 'Primeiro passeio', 'Primeiro banho', 'Aprendeu um truque', 'Viagem', 'Castração']

/** Novo marco da linha do tempo (ou edição, com ?marco=): data, título, texto e foto. */
function TelaMarco() {
  const { id, marco: marcoId } = useLocalSearchParams<{ id: string; marco?: string }>()
  const { user } = useAuth()
  const { pets, petsMemoria } = usePets()
  const pet = [...pets, ...petsMemoria].find((p) => p.id === id) ?? null
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(hojeComoCampo())
  const [foto, setFoto] = useState<AtivoFoto | null>(null)
  const [fotoSalva, setFotoSalva] = useState<{ path: string; url: string | null } | null>(null)
  const [original, setOriginal] = useState<Marco | null>(null)
  const [carregando, setCarregando] = useState(Boolean(marcoId))
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!marcoId) return
    carregarMarco(marcoId)
      .then(async (m) => {
        if (!m) return
        setOriginal(m)
        setTitulo(m.titulo)
        setDescricao(m.descricao ?? '')
        setData(dataParaExibicao(m.data))
        if (m.foto_path) setFotoSalva({ path: m.foto_path, url: (await urlsFotos([m.foto_path]))[m.foto_path] ?? null })
      })
      .catch(() => undefined)
      .finally(() => setCarregando(false))
  }, [marcoId])

  function pedirFoto() {
    const escolher = (origem: 'galeria' | 'camera') => () => {
      escolherFoto(origem, false).then((f) => f && setFoto(f))
    }
    Alert.alert('Foto do marco', 'Fica guardada só na sua conta.', [
      fotoSalva || foto
        ? { text: 'Remover', style: 'destructive', onPress: () => (setFoto(null), setFotoSalva(null)) }
        : { text: 'Cancelar', style: 'cancel' },
      { text: 'Galeria', onPress: escolher('galeria') },
      { text: 'Câmera', onPress: escolher('camera') },
    ])
  }

  async function salvar() {
    if (!user || !id) return
    const dataIso = dataParaIso(data)
    if (!dataIso) {
      Alert.alert('Falta a data', 'Quando foi? (DD/MM/AAAA)')
      return
    }
    if (titulo.trim().length < 2) {
      Alert.alert('Falta o título', 'Dê um nome para o marco.')
      return
    }
    setSalvando(true)
    try {
      let caminho = fotoSalva?.path ?? null
      if (foto) caminho = await enviarFotoMarco(user.id, foto.uri, foto.mimeType)
      await salvarMarco(marcoId ?? null, { pet_id: id, data: dataIso, titulo: titulo.trim(), descricao: descricao.trim() || null, foto_path: caminho })
      // Trocou ou tirou a foto: a antiga sai do armazenamento.
      if (original?.foto_path && original.foto_path !== caminho) await removerFotoMarco(original.foto_path)
      router.back()
    } catch (e) {
      Alert.alert('Não deu para salvar', mensagemDeErro(e instanceof Error ? e.message : String(e)))
    } finally {
      setSalvando(false)
    }
  }

  function apagar() {
    if (!original) return
    Alert.alert('Apagar este marco?', original.titulo, [
      { text: 'Manter', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => apagarMarco(original).then(() => router.back(), (e) => Alert.alert('Não deu para apagar', String(e))) },
    ])
  }

  if (carregando) {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        <ActivityIndicator color={colors.primaryDeep} />
      </View>
    )
  }
  const fotoMostrada = foto?.uri ?? fotoSalva?.url ?? null

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo={pet ? `Linha do tempo de ${pet.nome}` : 'Linha do tempo'} titulo={marcoId ? 'Editar marco' : 'Novo marco'} altura={200} />
      <ScrollView style={estilos.flex} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!marcoId ? (
          <View style={estilos.chips}>
            {SUGESTOES.map((s) => (
              <Tocavel key={s} accessibilityRole="button" onPress={() => setTitulo(s)} style={[estilos.chip, titulo === s && estilos.chipAtivo]}>
                <Text style={[estilos.chipTexto, titulo === s && estilos.chipTextoAtivo]}>{s}</Text>
              </Tocavel>
            ))}
          </View>
        ) : null}
        <Campo rotulo="Título" placeholder="Ex.: Primeiro passeio na praia" value={titulo} onChangeText={setTitulo} maxLength={80} />
        <Campo rotulo="Quando" mascara="data" placeholder="DD/MM/AAAA" value={data} onChangeText={setData} maxLength={10} />
        <Campo rotulo="Detalhe (opcional)" placeholder="Ex.: Praia de Botafogo, com a família" value={descricao} onChangeText={setDescricao} maxLength={200} />

        <Tocavel accessibilityRole="button" onPress={pedirFoto} style={[estilos.foto, !fotoMostrada && estilos.fotoVazia]}>
          {fotoMostrada ? (
            <Image source={{ uri: fotoMostrada }} style={estilos.fotoImagem} />
          ) : (
            <>
              <Icone nome="documento" size={26} />
              <Text style={estilos.fotoTexto}>Adicionar foto (opcional)</Text>
            </>
          )}
        </Tocavel>
        <Text style={estilos.nota}>No plano grátis a linha do tempo guarda até 10 fotos.</Text>

        {original ? (
          <Tocavel accessibilityRole="button" onPress={apagar} style={estilos.apagar}>
            <Text style={estilos.apagarTexto}>Apagar marco</Text>
          </Tocavel>
        ) : null}
      </ScrollView>
      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Salvar marco" carregando={salvando} onPress={salvar} />
      </View>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  centro: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: '#E1E6EE' },
  chipAtivo: { backgroundColor: colors.black, borderColor: colors.black },
  chipTexto: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.black },
  chipTextoAtivo: { color: colors.white },
  foto: { height: 190, borderRadius: 28, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 8 },
  fotoVazia: { backgroundColor: '#FFF0C9' },
  fotoImagem: { width: '100%', height: '100%' },
  fotoTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, color: '#6A7484' },
  apagar: { alignSelf: 'flex-start', paddingVertical: 8 },
  apagarTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: '#B3173A' },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
})

export default somenteParaEditavel(TelaMarco)
