import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Tocavel } from '../../src/components/Animacoes'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../src/components/HeroiOnda'
import { reais } from '../../src/despesas/despesas'
import { abrirVitrine, enviarSolicitacao, esvaziarCarrinho, mudarQuantidade, subtotalCarrinho, taxaEntrega, useCarrinho, type Loja } from '../../src/loja/loja'
import { carregarEnderecos, salvarEndereco, type Endereco } from '../../src/loja/enderecos'
import { posicaoAtual } from '../../src/perdido/perdido'
import { colors } from '../../src/theme/colors'
import { fontFamily } from '../../src/theme/typography'

/** Sua solicitação (protótipo Solicitar): itens, retirada ou entrega, mensagem e pagamento na loja. */
export default function Solicitar() {
  const carrinho = useCarrinho()
  const [loja, setLoja] = useState<Loja | null>(null)
  const [modo, setModo] = useState<'retirada' | 'entrega'>('retirada')
  const [mensagem, setMensagem] = useState('')
  const [enderecos, setEnderecos] = useState<Endereco[]>([])
  const [enderecoId, setEnderecoId] = useState<string | null>(null)
  const [novo, setNovo] = useState<{ street: string; number: string; complement: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (!carrinho.lojaId) return
      abrirVitrine(carrinho.lojaId).then((v) => {
        if (!v.disponivel) return
        setLoja(v.loja)
        if (!v.loja.pickup_enabled && v.loja.delivery_enabled) setModo('entrega')
      }, () => undefined)
    }, [carrinho.lojaId]),
  )
  useEffect(() => {
    carregarEnderecos().then((l) => {
      setEnderecos(l)
      setEnderecoId((atual) => atual ?? l[0]?.id ?? null)
    }, () => undefined)
  }, [])

  const subtotal = subtotalCarrinho(carrinho)
  const entrega = loja ? taxaEntrega(loja, subtotal) : { ok: false, taxa: 0, falta: 0 }
  const total = subtotal + (modo === 'entrega' && entrega.ok ? entrega.taxa : 0)

  async function guardarEndereco() {
    if (!novo || novo.street.trim().length < 2) {
      setErro('Escreva a rua.')
      return
    }
    setErro(null)
    try {
      // A posição de agora confere se o endereço está na área de entrega da loja.
      const { lat, lng } = await posicaoAtual()
      const e = await salvarEndereco({ ...novo, lat, lng })
      setEnderecos((l) => [e, ...l])
      setEnderecoId(e.id)
      setNovo(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    }
  }

  async function enviar() {
    if (!loja || !carrinho.itens.length) return
    setEnviando(true)
    setErro(null)
    try {
      const r = await enviarSolicitacao(loja.id, carrinho.itens.map((i) => ({ product_id: i.produto.id, qty: i.qty })), modo, mensagem, enderecoId)
      esvaziarCarrinho()
      router.replace(`/pedidos/${r.id}`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setEnviando(false)
    }
  }

  if (!carrinho.itens.length) {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        <Text style={estilos.vazio}>Sua solicitação está vazia.</Text>
        <View style={estilos.voltar}>
          <BotaoPrimario titulo="Voltar" onPress={() => router.back()} />
        </View>
      </View>
    )
  }
  if (!loja) return <View style={[estilos.tela, estilos.centro]}><ActivityIndicator color={colors.primaryDeep} /></View>

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo={loja.name} titulo="Sua solicitação" altura={176} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {carrinho.itens.map((i) => (
          <View key={i.produto.id} style={estilos.item}>
            <View style={estilos.flex}>
              <Text style={estilos.itemNome} numberOfLines={2}>{i.produto.name}</Text>
              <Text style={estilos.sub}>{i.produto.price_cents === null ? 'Preço na loja' : `${reais(i.produto.price_cents)} cada`}</Text>
            </View>
            <View style={estilos.contador}>
              <Tocavel accessibilityRole="button" accessibilityLabel={i.qty === 1 ? `Tirar ${i.produto.name}` : 'Menos um'} onPress={() => mudarQuantidade(i.produto.id, i.qty - 1)} style={estilos.botaoQtd}>
                <Text style={estilos.qtdTexto}>−</Text>
              </Tocavel>
              <Text style={estilos.qtd}>{i.qty}</Text>
              <Tocavel accessibilityRole="button" accessibilityLabel="Mais um" onPress={() => mudarQuantidade(i.produto.id, i.qty + 1)} style={estilos.botaoQtd}>
                <Text style={estilos.qtdTexto}>+</Text>
              </Tocavel>
            </View>
          </View>
        ))}

        <View style={estilos.modos}>
          {loja.pickup_enabled ? (
            <Tocavel accessibilityRole="radio" accessibilityState={{ selected: modo === 'retirada' }} onPress={() => setModo('retirada')} style={[estilos.modo, modo === 'retirada' && estilos.modoAtivo]}>
              <Text style={[estilos.modoTitulo, modo === 'retirada' && estilos.textoClaro]}>Retirar na loja</Text>
              <Text style={[estilos.modoSub, modo === 'retirada' && estilos.textoClaro]}>Fica pronto em até {loja.pickup_prepare_min} min</Text>
            </Tocavel>
          ) : null}
          {loja.delivery_enabled ? (
            <Tocavel accessibilityRole="radio" accessibilityState={{ selected: modo === 'entrega' }} onPress={() => setModo('entrega')} style={[estilos.modo, modo === 'entrega' && estilos.modoAtivo]}>
              <Text style={[estilos.modoTitulo, modo === 'entrega' && estilos.textoClaro]}>Entrega</Text>
              <Text style={[estilos.modoSub, modo === 'entrega' && estilos.textoClaro]}>
                {entrega.ok ? (entrega.taxa ? reais(entrega.taxa) : 'Grátis') : `Mínimo ${reais(loja.delivery_min_order_cents)}`} · {loja.delivery_eta_min}–{loja.delivery_eta_max} min
              </Text>
            </Tocavel>
          ) : null}
        </View>

        {modo === 'entrega' ? (
          <View style={estilos.cartao}>
            <Text style={estilos.secao}>Entregar em</Text>
            {!entrega.ok ? <Text style={estilos.alerta}>Faltam {reais(entrega.falta)} para o pedido mínimo de entrega.</Text> : null}
            {enderecos.map((e) => (
              <Tocavel key={e.id} accessibilityRole="radio" accessibilityState={{ selected: enderecoId === e.id }} onPress={() => setEnderecoId(e.id)} style={[estilos.endereco, enderecoId === e.id && estilos.enderecoAtivo]}>
                <Text style={estilos.itemNome}>{[e.street, e.number].filter(Boolean).join(', ')}</Text>
                {e.complement ? <Text style={estilos.sub}>{e.complement}</Text> : null}
              </Tocavel>
            ))}
            {novo ? (
              <View style={estilos.novo}>
                <TextInput value={novo.street} onChangeText={(street) => setNovo({ ...novo, street })} placeholder="Rua" placeholderTextColor={colors.textMuted} style={estilos.campo} />
                <View style={estilos.linha}>
                  <TextInput value={novo.number} onChangeText={(number) => setNovo({ ...novo, number })} placeholder="Número" placeholderTextColor={colors.textMuted} style={[estilos.campo, estilos.flex]} />
                  <TextInput value={novo.complement} onChangeText={(complement) => setNovo({ ...novo, complement })} placeholder="Complemento" placeholderTextColor={colors.textMuted} style={[estilos.campo, estilos.flex]} />
                </View>
                <Text style={estilos.sub}>Salve estando no endereço: usamos a localização de agora para conferir a área de entrega.</Text>
                <BotaoPrimario titulo="Salvar endereço" onPress={guardarEndereco} />
              </View>
            ) : (
              <Tocavel accessibilityRole="button" onPress={() => setNovo({ street: '', number: '', complement: '' })} style={estilos.adicionar}>
                <Text style={estilos.adicionarTexto}>+ Novo endereço</Text>
              </Tocavel>
            )}
          </View>
        ) : null}

        <View style={estilos.cartao}>
          <Text style={estilos.secao}>Mensagem para a loja</Text>
          <TextInput value={mensagem} onChangeText={setMensagem} placeholder="Ex.: pode separar até as 17h?" placeholderTextColor={colors.textMuted} multiline maxLength={500} style={estilos.mensagem} />
        </View>

        <View style={estilos.info}>
          <Text style={estilos.infoTexto}>O pagamento é feito na loja, na retirada ou na entrega. A loja confirma a disponibilidade em até {loja.response_deadline_min} min e avisa você aqui.</Text>
        </View>

        <View style={estilos.totais}>
          <View style={estilos.linhaTotal}><Text style={estilos.sub}>Produtos</Text><Text style={estilos.sub}>{reais(subtotal)}</Text></View>
          {modo === 'entrega' ? <View style={estilos.linhaTotal}><Text style={estilos.sub}>Entrega</Text><Text style={estilos.sub}>{entrega.ok ? (entrega.taxa ? reais(entrega.taxa) : 'Grátis') : '—'}</Text></View> : null}
          <View style={estilos.linhaTotal}><Text style={estilos.totalRotulo}>Total estimado</Text><Text style={estilos.total}>{reais(total)}</Text></View>
        </View>
        {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
      </ScrollView>
      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo="Enviar solicitação"
          carregando={enviando}
          desabilitado={!loja.aberta || (modo === 'entrega' && (!entrega.ok || !enderecoId))}
          onPress={() =>
            Alert.alert('Enviar a solicitação?', `${reais(total)} para pagar na loja. Você pode cancelar enquanto a loja não confirmar.`, [
              { text: 'Voltar', style: 'cancel' },
              { text: 'Enviar', onPress: enviar },
            ])
          }
        />
        {!loja.aberta ? <Text style={estilos.notaRodape}>A loja está fechada agora.</Text> : null}
      </View>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 22, padding: 12 },
  itemNome: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.black },
  sub: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textMuted },
  contador: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 22, height: 44 },
  botaoQtd: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  qtdTexto: { fontFamily: fontFamily.bold, fontSize: 20, color: colors.black },
  qtd: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, minWidth: 20, textAlign: 'center' },
  modos: { flexDirection: 'row', gap: 10 },
  modo: { flex: 1, borderRadius: 22, borderWidth: 1.5, borderColor: colors.border, padding: 14, gap: 2 },
  modoAtivo: { backgroundColor: colors.black, borderColor: colors.black },
  modoTitulo: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  modoSub: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  textoClaro: { color: colors.white },
  cartao: { backgroundColor: colors.surface, borderRadius: 22, padding: 14, gap: 8 },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  alerta: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.warningText },
  endereco: { borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, padding: 12 },
  enderecoAtivo: { borderColor: colors.primaryDeep, backgroundColor: colors.primarySurface },
  novo: { gap: 8 },
  linha: { flexDirection: 'row', gap: 8 },
  campo: { height: 46, borderRadius: 16, backgroundColor: colors.surface, paddingHorizontal: 14, fontFamily: fontFamily.regular, fontSize: 15, color: colors.black },
  adicionar: { paddingVertical: 6 },
  adicionarTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.primaryDeep },
  mensagem: { fontFamily: fontFamily.regular, fontSize: 15, color: colors.black, minHeight: 56, textAlignVertical: 'top' },
  info: { backgroundColor: colors.primarySurface, borderRadius: 20, padding: 14 },
  infoTexto: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: colors.primaryDeep },
  totais: { gap: 4, paddingHorizontal: 4 },
  linhaTotal: { flexDirection: 'row', justifyContent: 'space-between' },
  totalRotulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  total: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.black },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger },
  vazio: { fontFamily: fontFamily.regular, fontSize: 14, color: colors.textMuted },
  voltar: { alignSelf: 'stretch', marginTop: 16 },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28, gap: 6 },
  notaRodape: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
})
