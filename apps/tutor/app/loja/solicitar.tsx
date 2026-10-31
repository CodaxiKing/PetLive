import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight'
import { PixLogo } from 'phosphor-react-native/src/icons/PixLogo'
import { Storefront } from 'phosphor-react-native/src/icons/Storefront'
import { Ticket } from 'phosphor-react-native/src/icons/Ticket'
import { Tocavel } from '../../src/components/Animacoes'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { EstadoTela } from '../../src/components/EstadoTela'
import { HeroiOnda } from '../../src/components/HeroiOnda'
import { reais } from '../../src/despesas/despesas'
import { textoDeErro } from '../../src/lib/erros'
import { carregarEnderecos, salvarEndereco, type Endereco } from '../../src/loja/enderecos'
import { abrirVitrine, enviarSolicitacao, esvaziarCarrinho, mudarQuantidade, subtotalCarrinho, taxaEntrega, useCarrinho, type Loja } from '../../src/loja/loja'
import { cpfValido, escolherCupom, guardarDadosPix, mascararCpf, precisaCpf, textoCupom, useCupom } from '../../src/pagamentos/pagamentos'
import { posicaoAtual } from '../../src/perdido/perdido'
import { colors } from '../../src/theme/colors'
import { shadow } from '../../src/theme/tokens'
import { fontFamily } from '../../src/theme/typography'

type Forma = 'pix_app' | 'na_loja'

/**
 * Sua solicitação (protótipos Solicitar e Pagamento numa tela só): itens,
 * retirada ou entrega, mensagem, Pix ou pagar na loja, cupom e total. No
 * primeiro Pix da conta, nome e CPF ficam aqui mesmo, antes de pagar.
 */
export default function Solicitar() {
  const carrinho = useCarrinho()
  const cupom = useCupom(carrinho.lojaId)
  const [loja, setLoja] = useState<Loja | null>(null)
  const [erroLoja, setErroLoja] = useState<string | null>(null)
  const [modo, setModo] = useState<'retirada' | 'entrega'>('retirada')
  const [mensagem, setMensagem] = useState('')
  const [enderecos, setEnderecos] = useState<Endereco[]>([])
  const [enderecoId, setEnderecoId] = useState<string | null>(null)
  const [novo, setNovo] = useState<{ street: string; number: string; complement: string } | null>(null)
  const [forma, setForma] = useState<Forma>('pix_app')
  const [pedeCpf, setPedeCpf] = useState(false)
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)

  useFocusEffect(
    useCallback(() => {
      if (!carrinho.lojaId) return
      abrirVitrine(carrinho.lojaId).then((v) => {
        setErroLoja(null)
        if (!v.disponivel) return setErroLoja('Esta loja não está disponível agora.')
        setLoja(v.loja)
        if (!v.loja.pickup_enabled && v.loja.delivery_enabled) setModo('entrega')
      }, (e) => setErroLoja(textoDeErro(e)))
      // A tentativa refaz a busca quando o tutor toca em Tentar de novo.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [carrinho.lojaId, tentativa]),
  )
  useEffect(() => {
    carregarEnderecos().then((l) => {
      setEnderecos(l)
      setEnderecoId((atual) => atual ?? l[0]?.id ?? null)
    }, () => undefined)
    precisaCpf().then(setPedeCpf, () => setPedeCpf(false))
  }, [])

  const subtotal = subtotalCarrinho(carrinho)
  const entrega = loja ? taxaEntrega(loja, subtotal) : { ok: false, taxa: 0, falta: 0 }
  const taxa = modo === 'entrega' && entrega.ok ? entrega.taxa : 0
  const desconto = cupom ? Math.min(cupom.desconto_cents, subtotal) : 0
  const total = subtotal + taxa - desconto
  const pix = forma === 'pix_app' && total > 0
  const faltaCpf = pix && pedeCpf && (nome.trim().length < 3 || !cpfValido(cpf))

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
      setErro(textoDeErro(e))
    }
  }

  async function confirmar() {
    if (!loja || !carrinho.itens.length) return
    setEnviando(true)
    setErro(null)
    try {
      const itens = carrinho.itens.map((i) => ({ product_id: i.produto.id, qty: i.qty }))
      const r = await enviarSolicitacao(loja.id, itens, modo, mensagem, enderecoId, pix ? 'pix_app' : 'na_loja', cupom?.code ?? null)
      esvaziarCarrinho()
      escolherCupom(loja.id, null)
      if (r.pay_method === 'pix_app') {
        // Nome e CPF só na memória, até a tela do Pix gerar a cobrança.
        if (pedeCpf) guardarDadosPix({ nome: nome.trim(), cpf })
        router.replace({ pathname: '/pagamento/pix', params: { pedido: r.id } })
      } else {
        router.replace(`/pedidos/${r.id}`)
      }
    } catch (e) {
      // Cupom que deixou de valer (esgotou, venceu): o tutor escolhe de novo.
      if (e instanceof Error && /cupom/i.test(e.message)) escolherCupom(loja.id, null)
      setErro(textoDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  if (!carrinho.itens.length) {
    return (
      <View style={estilos.tela}>
        <EstadoTela tipo="vazio" titulo="Sua solicitação está vazia" texto="Escolha os produtos na vitrine da loja." acao={{ titulo: 'Voltar', onPress: () => router.back() }} />
      </View>
    )
  }
  if (!loja) {
    return (
      <View style={estilos.tela}>
        {erroLoja ? <EstadoTela tipo="erro" texto={erroLoja} onTentar={() => setTentativa((n) => n + 1)} /> : <EstadoTela tipo="carregando" />}
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo={loja.name} titulo="Sua solicitação" />
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
            <Tocavel accessibilityRole="radio" accessibilityState={{ selected: modo === 'retirada' }} onPress={() => setModo('retirada')} estiloExterno={estilos.flex} style={[estilos.modo, modo === 'retirada' && estilos.modoAtivo]}>
              <Text style={[estilos.modoTitulo, modo === 'retirada' && estilos.textoClaro]}>Retirar na loja</Text>
              <Text style={[estilos.modoSub, modo === 'retirada' && estilos.textoClaro]}>Fica pronto em até {loja.pickup_prepare_min} min</Text>
            </Tocavel>
          ) : null}
          {loja.delivery_enabled ? (
            <Tocavel accessibilityRole="radio" accessibilityState={{ selected: modo === 'entrega' }} onPress={() => setModo('entrega')} estiloExterno={estilos.flex} style={[estilos.modo, modo === 'entrega' && estilos.modoAtivo]}>
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
                <BotaoPrimario titulo="Salvar endereço" claro onPress={guardarEndereco} />
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

        <Text style={estilos.secaoGrande}>Como você quer pagar?</Text>
        <View style={estilos.lista}>
          <Opcao
            icone={<PixLogo size={22} color="#1F8A70" weight="fill" />}
            fundoIcone="#DDF5EC"
            titulo="Pix"
            texto="Aprovação na hora, dentro do app"
            ativa={forma === 'pix_app'}
            onPress={() => setForma('pix_app')}
          />
          <Opcao
            icone={<Storefront size={22} color={colors.primaryDeep} />}
            fundoIcone={colors.primarySurface}
            titulo="Pagar na loja"
            texto={modo === 'entrega' ? 'Na entrega: dinheiro, Pix ou cartão' : 'Na retirada: dinheiro, Pix ou cartão'}
            ativa={forma === 'na_loja'}
            onPress={() => setForma('na_loja')}
            ultima
          />
        </View>

        {pix && pedeCpf ? (
          <View style={estilos.cartao}>
            <Text style={estilos.secao}>Para o primeiro Pix</Text>
            <Text style={estilos.sub}>O banco pede o nome e o CPF de quem paga. O CPF vai só para o emissor da cobrança; o PetLive não guarda.</Text>
            <TextInput value={nome} onChangeText={setNome} placeholder="Nome completo" placeholderTextColor={colors.textMuted} autoComplete="name" style={estilos.campoClaro} accessibilityLabel="Nome completo" />
            <TextInput value={cpf} onChangeText={(t) => setCpf(mascararCpf(t))} placeholder="CPF" placeholderTextColor={colors.textMuted} keyboardType="number-pad" maxLength={14} style={estilos.campoClaro} accessibilityLabel="CPF" />
            {cpf.length === 14 && !cpfValido(cpf) ? <Text style={estilos.erro}>Confira o CPF.</Text> : null}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cupom ? `Cupom ${cupom.code} aplicado. Trocar` : 'Adicionar cupom de desconto'}
          onPress={() => router.push({ pathname: '/loja/cupom', params: { subtotal: String(subtotal) } })}
          style={({ pressed }) => [estilos.cupom, cupom && estilos.cupomAtivo, pressed && { opacity: 0.7 }]}
        >
          <Ticket size={22} color={cupom ? '#1F8A70' : colors.text} weight={cupom ? 'fill' : 'regular'} />
          <View style={estilos.flex}>
            <Text style={estilos.cupomTitulo}>{cupom ? `${cupom.code} aplicado` : 'Adicionar cupom'}</Text>
            {cupom ? <Text style={estilos.sub}>{textoCupom(cupom)}</Text> : null}
          </View>
          <CaretRight size={18} color={colors.textMuted} />
        </Pressable>

        <View style={estilos.totais}>
          <Linha rotulo="Produtos" valor={reais(subtotal)} />
          {modo === 'entrega' ? <Linha rotulo="Entrega" valor={entrega.ok ? (entrega.taxa ? reais(entrega.taxa) : 'Grátis') : '—'} /> : null}
          {desconto ? <Linha rotulo="Desconto" valor={`− ${reais(desconto)}`} destaque /> : null}
          <View style={estilos.linhaTotal}>
            <Text style={estilos.totalRotulo}>Total</Text>
            <Text style={estilos.total}>{reais(total)}</Text>
          </View>
        </View>
        <Text style={estilos.nota}>
          {pix
            ? 'O pedido vai para a loja assim que o Pix for confirmado. Se a loja não puder atender, o valor volta para você.'
            : `A loja confirma a disponibilidade em até ${loja.response_deadline_min} min e avisa você aqui.`}
        </Text>
        {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
      </ScrollView>
      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo={pix ? `Pagar ${reais(total)} com Pix` : 'Enviar solicitação'}
          icone={pix ? <PixLogo size={20} weight="fill" /> : undefined}
          carregando={enviando}
          desabilitado={!loja.aberta || (modo === 'entrega' && (!entrega.ok || !enderecoId)) || faltaCpf}
          onPress={confirmar}
        />
        {!loja.aberta ? <Text style={estilos.notaRodape}>A loja está fechada agora.</Text> : faltaCpf ? <Text style={estilos.notaRodape}>Preencha nome e CPF para gerar o Pix.</Text> : null}
      </View>
    </KeyboardAvoidingView>
  )
}

function Opcao(p: { icone: ReactNode; fundoIcone: string; titulo: string; texto: string; ativa: boolean; onPress: () => void; ultima?: boolean }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected: p.ativa }} onPress={p.onPress} style={({ pressed }) => [estilos.opcao, !p.ultima && estilos.divisor, pressed && { opacity: 0.7 }]}>
      <View style={[estilos.icone, { backgroundColor: p.fundoIcone }]}>{p.icone}</View>
      <View style={estilos.flex}>
        <Text style={estilos.opcaoTitulo}>{p.titulo}</Text>
        <Text style={estilos.sub}>{p.texto}</Text>
      </View>
      <View style={[estilos.radio, p.ativa && estilos.radioAtivo]}>{p.ativa ? <View style={estilos.radioMiolo} /> : null}</View>
    </Pressable>
  )
}

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <View style={estilos.linhaTotal}>
      <Text style={estilos.sub}>{rotulo}</Text>
      <Text style={[estilos.sub, destaque && estilos.desconto]}>{valor}</Text>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 22, padding: 12, ...shadow.card },
  itemNome: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.black },
  sub: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  contador: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 22, height: 44 },
  botaoQtd: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  qtdTexto: { fontFamily: fontFamily.bold, fontSize: 20, color: colors.black },
  qtd: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, minWidth: 20, textAlign: 'center' },
  modos: { flexDirection: 'row', gap: 10 },
  modo: { borderRadius: 22, backgroundColor: colors.surface, padding: 14, gap: 2, ...shadow.card },
  modoAtivo: { backgroundColor: colors.black },
  modoTitulo: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  modoSub: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  textoClaro: { color: colors.white },
  cartao: { backgroundColor: colors.surface, borderRadius: 22, padding: 14, gap: 8, ...shadow.card },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  secaoGrande: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.text, marginTop: 4 },
  alerta: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.warningText },
  endereco: { borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, padding: 12 },
  enderecoAtivo: { borderColor: colors.primaryDeep, backgroundColor: colors.primarySurface },
  novo: { gap: 8 },
  linha: { flexDirection: 'row', gap: 8 },
  campo: { height: 46, borderRadius: 16, backgroundColor: colors.background, paddingHorizontal: 14, fontFamily: fontFamily.regular, fontSize: 15, color: colors.black },
  campoClaro: { height: 48, borderRadius: 16, backgroundColor: colors.background, paddingHorizontal: 14, fontFamily: fontFamily.regular, fontSize: 15, color: colors.black },
  adicionar: { paddingVertical: 6 },
  adicionarTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.primaryDeep },
  mensagem: { fontFamily: fontFamily.regular, fontSize: 15, color: colors.black, minHeight: 56, textAlignVertical: 'top' },
  lista: { backgroundColor: colors.surface, borderRadius: 26, ...shadow.card },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  divisor: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  icone: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  opcaoTitulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.text },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioAtivo: { borderColor: colors.black },
  radioMiolo: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.black },
  cupom: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 14, ...shadow.card },
  cupomAtivo: { backgroundColor: '#DDF5EC' },
  cupomTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.text },
  totais: { gap: 6, paddingHorizontal: 4, marginTop: 4 },
  linhaTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  desconto: { color: '#1F8A70', fontFamily: fontFamily.semiBold },
  totalRotulo: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.text },
  total: { fontFamily: fontFamily.bold, fontSize: 22, letterSpacing: -0.5, color: colors.text },
  nota: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted, paddingHorizontal: 4 },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger },
  rodape: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, gap: 6 },
  notaRodape: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
})
