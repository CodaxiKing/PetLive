import { useState } from 'react'
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../../../src/auth/AuthProvider'
import { Tocavel } from '../../../src/components/Animacoes'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { Icone } from '../../../src/components/Icone'
import { enviarAvaliacao, TAGS, TEXTO_NOTA, type Tag } from '../../../src/loja/avaliacoes'
import { escolherFoto, type AtivoFoto } from '../../../src/pets/CampoFoto'
import { colors } from '../../../src/theme/colors'
import { fontFamily } from '../../../src/theme/typography'

/** Avaliar loja e serviço (protótipo Avaliar). */
export default function AvaliarPedido() {
  const { id, loja } = useLocalSearchParams<{ id: string; loja?: string }>()
  const { user } = useAuth()
  const [nota, setNota] = useState(0)
  const [tags, setTags] = useState<Tag[]>([])
  const [texto, setTexto] = useState('')
  const [foto, setFoto] = useState<AtivoFoto | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar() {
    if (!user || !id) return
    setEnviando(true)
    setErro(null)
    try {
      await enviarAvaliacao(user.id, id, nota, tags, texto, foto)
      Alert.alert('Obrigado!', 'Sua avaliação ajuda outros tutores.')
      router.back()
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo={loja ?? 'Loja'} titulo="Avaliar loja e serviço" altura={180} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={estilos.secao}>Como foi o atendimento?</Text>
        <View style={estilos.estrelas} accessibilityRole="adjustable" accessibilityValue={{ min: 0, max: 5, now: nota }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Tocavel key={n} accessibilityRole="button" accessibilityLabel={`${n} estrela${n > 1 ? 's' : ''}`} onPress={() => setNota(n)} hitSlop={6}>
              <Text style={[estilos.estrela, n <= nota && estilos.estrelaCheia]}>★</Text>
            </Tocavel>
          ))}
        </View>
        <Text style={estilos.notaTexto}>{TEXTO_NOTA[nota] || 'Toque nas estrelas'}</Text>

        <Text style={estilos.secao}>O que foi bom?</Text>
        <View style={estilos.chips}>
          {TAGS.map((t) => {
            const ativo = tags.includes(t.valor)
            return (
              <Tocavel key={t.valor} accessibilityRole="checkbox" accessibilityState={{ checked: ativo }} onPress={() => setTags((l) => (ativo ? l.filter((x) => x !== t.valor) : [...l, t.valor]))} style={[estilos.chip, ativo && estilos.chipAtivo]}>
                <Text style={[estilos.chipTexto, ativo && estilos.textoClaro]}>{t.rotulo}</Text>
              </Tocavel>
            )
          })}
        </View>

        <View style={estilos.campo}>
          <TextInput value={texto} onChangeText={setTexto} placeholder="Conte como foi (opcional)" placeholderTextColor={colors.textMuted} multiline maxLength={600} style={estilos.texto} />
        </View>
        <Tocavel accessibilityRole="button" onPress={() => escolherFoto('galeria', true).then((f) => f && setFoto(f))} style={estilos.foto}>
          {foto ? <Image source={{ uri: foto.uri }} style={estilos.previa} /> : <Icone nome="camera" size={20} espessura={2} />}
          <Text style={estilos.fotoTexto}>{foto ? 'Trocar a foto' : 'Adicionar foto (opcional)'}</Text>
        </Tocavel>
        <Text style={estilos.nota}>A avaliação fica pública com seu primeiro nome. A loja pode responder uma vez.</Text>
        {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
      </ScrollView>
      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Enviar avaliação" carregando={enviando} desabilitado={nota === 0} onPress={enviar} />
      </View>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 4 },
  estrelas: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  estrela: { fontSize: 42, color: colors.border },
  estrelaCheia: { color: '#E5A823' },
  notaTexto: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center' },
  chipAtivo: { backgroundColor: colors.black, borderColor: colors.black },
  chipTexto: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.black },
  textoClaro: { color: colors.white },
  campo: { backgroundColor: colors.surface, borderRadius: 22, padding: 14 },
  texto: { fontFamily: fontFamily.regular, fontSize: 15, color: colors.black, minHeight: 70, textAlignVertical: 'top' },
  foto: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong, borderRadius: 22, padding: 12 },
  previa: { width: 48, height: 48, borderRadius: 14 },
  fotoTexto: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.black },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
})
