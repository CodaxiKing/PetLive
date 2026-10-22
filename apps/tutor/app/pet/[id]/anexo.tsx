import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../../../src/auth/AuthProvider'
import { Tocavel } from '../../../src/components/Animacoes'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { Campo } from '../../../src/components/Campo'
import { ControleSegmentado } from '../../../src/components/ControleSegmentado'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { Icone } from '../../../src/components/Icone'
import { escolherFoto, type AtivoFoto } from '../../../src/pets/CampoFoto'
import { usePets } from '../../../src/pets/PetsProvider'
import { somenteParaEditavel } from '../../../src/pets/SomenteLeitura'
import { atualizarAnexo, carregarAnexo, enviarAnexo, ErroAnexo, urlsAnexos } from '../../../src/saude/anexos'
import { mimeAceito, TIPOS_ANEXO, validarArquivo, type Anexo } from '../../../src/saude/anexosRegras'
import { dataParaExibicao, dataParaIso, hojeComoCampo } from '../../../src/saude/types'
import { colors } from '../../../src/theme/colors'
import { fontFamily } from '../../../src/theme/typography'

/**
 * Anexar foto do cartão de vacina ou de exame (P-B7CbI), ou editar um anexo
 * (?anexo=): tipo, título e data. Na edição a foto não muda; para trocar,
 * exclua e anexe de novo.
 */
function TelaAnexo() {
  const { id, anexo: anexoId } = useLocalSearchParams<{ id: string; anexo?: string }>()
  const { user } = useAuth()
  const { pets } = usePets()
  const pet = pets.find((p) => p.id === id) ?? null
  const [tipoIndice, setTipoIndice] = useState(0)
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState(hojeComoCampo())
  const [foto, setFoto] = useState<AtivoFoto | null>(null)
  const [original, setOriginal] = useState<Anexo | null>(null)
  const [urlOriginal, setUrlOriginal] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(Boolean(anexoId))
  const [salvando, setSalvando] = useState(false)
  const [falha, setFalha] = useState<ErroAnexo | null>(null)

  useEffect(() => {
    if (!anexoId) return
    carregarAnexo(anexoId)
      .then(async (a) => {
        if (!a) return
        setOriginal(a)
        setTipoIndice(Math.max(0, TIPOS_ANEXO.findIndex((t) => t.valor === a.tipo)))
        setTitulo(a.titulo ?? '')
        setData(dataParaExibicao(a.data))
        setUrlOriginal((await urlsAnexos([a.arquivo_path]))[a.arquivo_path] ?? null)
      })
      .catch(() => undefined)
      .finally(() => setCarregando(false))
  }, [anexoId])

  async function escolher(origem: 'galeria' | 'camera') {
    // Sem recorte e com qualidade reduzida: o seletor já devolve a foto comprimida.
    const ativo = await escolherFoto(origem, false)
    if (!ativo) return
    const recusa = validarArquivo(mimeAceito(ativo.mimeType, ativo.uri), ativo.tamanho)
    if (recusa) {
      Alert.alert('Não dá para usar esta foto', recusa)
      return
    }
    setFalha(null)
    setFoto(ativo)
  }

  async function salvar() {
    if (!user || !id || salvando) return
    const dataIso = dataParaIso(data)
    if (!dataIso) {
      Alert.alert('Confira a data', 'Use o formato DD/MM/AAAA.')
      return
    }
    const dados = { tipo: TIPOS_ANEXO[tipoIndice].valor, titulo: titulo.trim() || null, data: dataIso }
    setSalvando(true)
    setFalha(null)
    try {
      if (original) await atualizarAnexo(original.id, dados)
      else if (foto) await enviarAnexo(user.id, id, foto, dados)
      else return
      router.back()
    } catch (e) {
      setFalha(e instanceof ErroAnexo ? e : new ErroAnexo(e instanceof Error ? e.message : String(e), true))
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        <ActivityIndicator color={colors.primaryDeep} />
      </View>
    )
  }

  const editando = Boolean(original)
  const previa = foto?.uri ?? urlOriginal

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo={pet ? `Saúde de ${pet.nome}` : 'Saúde'} titulo={editando ? 'Editar anexo' : 'Anexar'} altura={200} />
      <ScrollView style={estilos.flex} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {previa ? (
          <View style={estilos.previa}>
            <Image source={{ uri: previa }} style={estilos.previaImagem} resizeMode="contain" accessibilityLabel="Prévia da foto" />
          </View>
        ) : (
          <View style={estilos.origens}>
            {(
              [
                { origem: 'camera', rotulo: 'Tirar foto', icone: 'camera' },
                { origem: 'galeria', rotulo: 'Escolher da galeria', icone: 'grade' },
              ] as const
            ).map((o) => (
              <Tocavel key={o.origem} accessibilityRole="button" onPress={() => escolher(o.origem)} estiloExterno={estilos.flex} style={estilos.origem}>
                <Icone nome={o.icone} size={26} />
                <Text style={estilos.origemTexto}>{o.rotulo}</Text>
              </Tocavel>
            ))}
          </View>
        )}
        {foto && !salvando ? (
          <View style={estilos.trocar}>
            <Tocavel accessibilityRole="button" onPress={() => escolher('camera')} style={estilos.trocarBotao}>
              <Text style={estilos.trocarTexto}>Tirar outra</Text>
            </Tocavel>
            <Tocavel accessibilityRole="button" onPress={() => escolher('galeria')} style={estilos.trocarBotao}>
              <Text style={estilos.trocarTexto}>Escolher outra</Text>
            </Tocavel>
          </View>
        ) : null}

        <Text style={estilos.rotulo}>Tipo</Text>
        <ControleSegmentado opcoes={TIPOS_ANEXO.map((t) => t.rotulo)} ativo={tipoIndice} onSelecionar={setTipoIndice} />
        <Campo rotulo="Título (opcional)" placeholder="Ex.: Hemograma, V10 2026" value={titulo} onChangeText={setTitulo} maxLength={80} />
        <Campo rotulo="Data" mascara="data" placeholder="DD/MM/AAAA" value={data} onChangeText={setData} maxLength={10} />
        <Text style={estilos.nota}>Só você vê os anexos. Eles não aparecem na carteirinha compartilhada. JPG, PNG ou HEIC, até 10 MB.</Text>

        {falha ? (
          <View style={estilos.erro} accessibilityRole="alert">
            <Text style={estilos.erroTexto}>{falha.message}</Text>
            {falha.tentarDeNovo ? (
              <Tocavel accessibilityRole="button" onPress={salvar} style={estilos.erroBotao}>
                <Text style={estilos.erroBotaoTexto}>Tentar novamente</Text>
              </Tocavel>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <View style={estilos.rodape}>
        {salvando ? <Text style={estilos.enviando}>{editando ? 'Salvando…' : 'Enviando a foto…'}</Text> : null}
        <BotaoPrimario
          titulo={editando ? 'Salvar alterações' : 'Salvar anexo'}
          carregando={salvando}
          desabilitado={!editando && !foto}
          onPress={salvar}
        />
      </View>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  centro: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  previa: { height: 260, borderRadius: 28, overflow: 'hidden', backgroundColor: '#0F1115' },
  previaImagem: { width: '100%', height: '100%' },
  origens: { flexDirection: 'row', gap: 10 },
  origem: { height: 130, borderRadius: 28, backgroundColor: '#FFF0C9', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8 },
  origemTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black, textAlign: 'center' },
  trocar: { flexDirection: 'row', gap: 8 },
  trocarBotao: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: '#E1E6EE' },
  trocarTexto: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.black },
  rotulo: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black, marginTop: 4 },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: '#6A7484' },
  erro: { backgroundColor: '#FDE0E6', borderRadius: 20, padding: 14, gap: 10 },
  erroTexto: { fontFamily: fontFamily.semiBold, fontSize: 14, color: '#7A1A33' },
  erroBotao: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: colors.black },
  erroBotaoTexto: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.white },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28, gap: 8 },
  enviando: { fontFamily: fontFamily.semiBold, fontSize: 13, color: '#6A7484', textAlign: 'center' },
})

export default somenteParaEditavel(TelaAnexo)
