import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Tocavel } from '../../../src/components/Animacoes'
import { Icone } from '../../../src/components/Icone'
import { mensagemDeErro } from '../../../src/lib/cacheOffline'
import { abrirConversa, enviarMensagem, juntarMensagens, ouvirMensagens, RESPOSTAS_RAPIDAS, type Conversa } from '../../../src/loja/chat'
import { colors } from '../../../src/theme/colors'
import { fontFamily } from '../../../src/theme/typography'
import { textoDeErro } from '../../../src/lib/erros'

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Conversa com a loja (protótipo Chat). */
export default function ConversaLoja() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [conversa, setConversa] = useState<Conversa | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const lista = useRef<FlatList>(null)

  const carregar = useCallback(() => {
    if (!id) return
    abrirConversa(id).then(setConversa, (e: unknown) => setErro(mensagemDeErro(textoDeErro(e))))
  }, [id])
  useFocusEffect(carregar)

  const conversaId = conversa?.id
  useEffect(() => {
    if (!conversaId) return
    return ouvirMensagens(conversaId, (m) => setConversa((c) => (c ? { ...c, mensagens: juntarMensagens(c.mensagens, [m]) } : c)))
  }, [conversaId])

  async function enviar(mensagem: string) {
    if (!conversa || !mensagem.trim()) return
    setEnviando(true)
    setErro(null)
    try {
      await enviarMensagem(conversa.id, mensagem)
      setTexto('')
      carregar()
    } catch (e) {
      setErro(textoDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  if (!conversa) {
    return <View style={[estilos.tela, estilos.centro]}>{erro ? <Text style={estilos.vazio}>{erro}</Text> : <ActivityIndicator color={colors.primaryDeep} />}</View>
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={estilos.barra}>
        <Tocavel accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={estilos.botaoVoltar}>
          <Icone nome="seta" size={18} espessura={2.2} />
        </Tocavel>
        <View style={estilos.flex}>
          <Text style={estilos.titulo} numberOfLines={1}>{conversa.loja}</Text>
          <Text style={estilos.sub}>Pedido nº {conversa.numero}</Text>
        </View>
      </View>
      <FlatList
        ref={lista}
        data={conversa.mensagens}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={estilos.mensagens}
        onContentSizeChange={() => lista.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<Text style={estilos.vazio}>Combine detalhes do pedido com a loja por aqui. Evite passar dados de pagamento por mensagem.</Text>}
        renderItem={({ item }) => {
          const minha = item.da_loja === conversa.sou_loja
          return (
            <View style={[estilos.balao, minha ? estilos.minha : estilos.dela]}>
              <Text style={[estilos.balaoTexto, minha && estilos.textoClaro]}>{item.body}</Text>
              <Text style={[estilos.balaoHora, minha && estilos.horaClara]}>{hora(item.at)}{minha && item.lida ? ' · lida' : ''}</Text>
            </View>
          )
        }}
      />
      {conversa.fechada ? (
        <Text style={estilos.fechada}>Esta conversa foi encerrada 7 dias depois do pedido.</Text>
      ) : (
        <View style={estilos.rodape}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.rapidas} keyboardShouldPersistTaps="handled">
            {RESPOSTAS_RAPIDAS.map((r) => (
              <Tocavel key={r} accessibilityRole="button" disabled={enviando} onPress={() => enviar(r)} style={estilos.rapida}>
                <Text style={estilos.rapidaTexto}>{r}</Text>
              </Tocavel>
            ))}
          </ScrollView>
          {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
          <View style={estilos.entrada}>
            <TextInput value={texto} onChangeText={setTexto} placeholder="Escreva uma mensagem…" placeholderTextColor={colors.textMuted} maxLength={1000} multiline style={estilos.campo} />
            <Tocavel accessibilityRole="button" accessibilityLabel="Enviar mensagem" disabled={enviando || !texto.trim()} onPress={() => enviar(texto)} style={[estilos.enviar, (!texto.trim() || enviando) && estilos.desligado]}>
              {enviando ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={estilos.enviarTexto}>Enviar</Text>}
            </Tocavel>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  flex: { flex: 1, minWidth: 0 },
  barra: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 52, paddingHorizontal: 24, paddingBottom: 12, backgroundColor: colors.primarySurface },
  botaoVoltar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }] },
  titulo: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.black },
  sub: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  mensagens: { padding: 16, gap: 8, flexGrow: 1 },
  balao: { maxWidth: '80%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  minha: { alignSelf: 'flex-end', backgroundColor: colors.black, borderBottomRightRadius: 6 },
  dela: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomLeftRadius: 6 },
  balaoTexto: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 21, color: colors.black },
  textoClaro: { color: colors.white },
  balaoHora: { fontFamily: fontFamily.regular, fontSize: 11, color: colors.textMuted, alignSelf: 'flex-end' },
  horaClara: { color: '#C9D0DB' },
  vazio: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: 'center', padding: 24 },
  fechada: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.textMuted, textAlign: 'center', padding: 20, paddingBottom: 32 },
  rodape: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 8 },
  rapidas: { gap: 6 },
  rapida: { borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 7 },
  rapidaTexto: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.black },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger },
  entrada: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  campo: { flex: 1, minHeight: 48, maxHeight: 120, borderRadius: 24, backgroundColor: colors.surface, paddingHorizontal: 18, paddingVertical: 12, fontFamily: fontFamily.regular, fontSize: 15, color: colors.black },
  enviar: { height: 48, paddingHorizontal: 18, borderRadius: 24, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  desligado: { opacity: 0.4 },
  enviarTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.white },
})
