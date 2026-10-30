import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { Campo } from '../../../src/components/Campo'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { escolherFoto } from '../../../src/pets/CampoFoto'
import { usePets } from '../../../src/pets/PetsProvider'
import { useAuth } from '../../../src/auth/AuthProvider'
import { supabase } from '../../../src/lib/supabase'
import {
  apagarDocumentoSaude,
  carregarDocumentosSaude,
  enviarDocumentoSaude,
  salvarDocumentoSaude,
  urlDocumentoSaude,
  type DocumentoSaude,
  type TipoDocumentoSaude,
} from '../../../src/saude/documentos'
import { hojeComoCampo, dataParaIso, dataParaExibicao } from '../../../src/saude/types'
import { colors } from '../../../src/theme/colors'
import { fontFamily } from '../../../src/theme/typography'
import { FotografarCartao } from '../../../src/saude/FotografarCartao'

const ROTULOS: Record<TipoDocumentoSaude, string> = {
  cartao_vacina: 'Cartão de vacina',
  exame: 'Exame',
}

export default function DocumentosSaude() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const { pets } = usePets()
  const pet = pets.find((p) => p.id === id) ?? null
  const [documentos, setDocumentos] = useState<DocumentoSaude[]>([])
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [tipo, setTipo] = useState<TipoDocumentoSaude>('cartao_vacina')
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState(hojeComoCampo())

  const recarregar = useCallback(() => {
    if (!id) return
    let ativo = true
    setCarregando(true)
    carregarDocumentosSaude(id).then(
      (lista) => ativo && setDocumentos(lista),
      () => ativo && Alert.alert('Não foi possível carregar', 'Confira sua conexão e tente novamente.'),
    ).finally(() => ativo && setCarregando(false))
    return () => { ativo = false }
  }, [id])

  useFocusEffect(recarregar)

  const adicionar = async (origem: 'galeria' | 'camera') => {
    if (!id || !user?.id) return
    const iso = dataParaIso(data)
    if (!iso) {
      Alert.alert('Confira a data', 'Informe uma data válida no formato DD/MM/AAAA.')
      return
    }
    const imagem = await escolherFoto(origem, false)
    if (!imagem) return
    const nome = titulo.trim() || ROTULOS[tipo]
    setEnviando(true)
    let caminho: string | null = null
    try {
      caminho = await enviarDocumentoSaude(user.id, id, imagem.uri, imagem.mimeType)
      await salvarDocumentoSaude({
        pet_id: id,
        tutor_id: user.id,
        tipo,
        titulo: nome,
        realizado_em: iso,
        arquivo_path: caminho,
      })
      setTitulo('')
      setData(hojeComoCampo())
      recarregar()
    } catch (erro) {
      if (caminho) await supabase.storage.from('anexos').remove([caminho])
      Alert.alert('Não foi possível salvar', erro instanceof Error ? erro.message : 'Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  const perguntarImagem = () => Alert.alert('Adicionar imagem', 'Escolha de onde vem a imagem.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Galeria', onPress: () => { void adicionar('galeria') } },
    { text: 'Câmera', onPress: () => { void adicionar('camera') } },
  ])

  const abrir = async (doc: DocumentoSaude) => {
    try {
      const url = await urlDocumentoSaude(doc.arquivo_path)
      await Linking.openURL(url)
    } catch (erro) {
      Alert.alert('Não foi possível abrir', erro instanceof Error ? erro.message : 'Tente novamente.')
    }
  }

  const remover = (doc: DocumentoSaude) => Alert.alert('Remover documento?', `“${doc.titulo}” será apagado.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Remover', style: 'destructive', onPress: async () => {
      try {
        await apagarDocumentoSaude(doc)
        setDocumentos((lista) => lista.filter((item) => item.id !== doc.id))
      } catch (erro) {
        Alert.alert('Não foi possível remover', erro instanceof Error ? erro.message : 'Tente novamente.')
      }
    } },
  ])

  return (
    <View style={estilos.tela}>
      <HeroiOnda titulo="Documentos de saúde" subtitulo={pet?.nome ?? 'Pet'} altura={210} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <Text style={estilos.ajuda}>Guarde fotos do cartão de vacina e de exames. Os arquivos ficam privados e só você pode acessá-los.</Text>
        <Text style={estilos.rotulo}>Tipo de documento</Text>
        <View style={estilos.tipos}>
          {(Object.keys(ROTULOS) as TipoDocumentoSaude[]).map((opcao) => (
            <Pressable key={opcao} accessibilityRole="radio" accessibilityState={{ selected: tipo === opcao }} onPress={() => setTipo(opcao)} style={[estilos.tipo, tipo === opcao && estilos.tipoAtivo]}>
              <Text style={[estilos.tipoTexto, tipo === opcao && estilos.tipoTextoAtivo]}>{ROTULOS[opcao]}</Text>
            </Pressable>
          ))}
        </View>
        <Campo rotulo="Nome (opcional)" placeholder={tipo === 'exame' ? 'Ex.: Hemograma' : 'Ex.: Carteira atualizada'} value={titulo} onChangeText={setTitulo} />
        <Campo rotulo="Data do documento" mascara="data" placeholder="dd/mm/aaaa" value={data} onChangeText={setData} />
        <BotaoPrimario titulo="Adicionar foto" icone={<Text style={estilos.mais}>＋</Text>} onPress={perguntarImagem} carregando={enviando} />
        {tipo === 'cartao_vacina' && user && pet?.tutor_id === user.id ? <FotografarCartao key={`${user.id}:${id}`} tutorId={user.id} petId={id} titulo={titulo} data={data} onSalvo={() => { setTitulo(''); setData(hojeComoCampo()); recarregar(); }} /> : null}

        <Text style={estilos.secao}>Salvos</Text>
        {carregando ? <ActivityIndicator color={colors.primaryDeep} /> : documentos.length === 0 ? (
          <Text style={estilos.vazio}>Nenhum documento salvo para {pet?.nome ?? 'este pet'}.</Text>
        ) : documentos.map((doc) => (
          <View key={doc.id} style={estilos.documento}>
            <Pressable accessibilityRole="button" onPress={() => { void abrir(doc) }} style={estilos.detalhe}>
              <Text style={estilos.categoria}>{ROTULOS[doc.tipo]}</Text>
              <Text style={estilos.titulo}>{doc.titulo}</Text>
              <Text style={estilos.data}>{dataParaExibicao(doc.realizado_em)} · Toque para abrir</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${doc.titulo}`} onPress={() => remover(doc)} hitSlop={10}>
              <Text style={estilos.remover}>Remover</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Voltar ao pet" onPress={() => router.back()} />
      </View>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  conteudo: { padding: 24, paddingBottom: 120, gap: 12 },
  ajuda: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 21, color: colors.textMuted },
  rotulo: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.black, marginTop: 4 },
  tipos: { flexDirection: 'row', gap: 8 },
  tipo: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  tipoAtivo: { borderColor: colors.black, backgroundColor: colors.black },
  tipoTexto: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.black },
  tipoTextoAtivo: { color: colors.white },
  mais: { fontSize: 20, color: colors.black },
  secao: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.black, marginTop: 12 },
  vazio: { fontFamily: fontFamily.regular, fontSize: 14, color: colors.textMuted },
  documento: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 22, padding: 16 },
  detalhe: { flex: 1, gap: 3 },
  categoria: { fontFamily: fontFamily.bold, fontSize: 11, color: colors.premiumText, textTransform: 'uppercase' },
  titulo: { fontFamily: fontFamily.semiBold, fontSize: 15, color: colors.black },
  data: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  remover: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.danger },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28, backgroundColor: colors.background },
})
