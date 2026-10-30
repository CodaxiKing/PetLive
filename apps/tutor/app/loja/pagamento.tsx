import { useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight'
import { PixLogo } from 'phosphor-react-native/src/icons/PixLogo'
import { Storefront } from 'phosphor-react-native/src/icons/Storefront'
import { Ticket } from 'phosphor-react-native/src/icons/Ticket'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../src/components/HeroiOnda'
import { reais } from '../../src/despesas/despesas'
import { abrirVitrine, enviarSolicitacao, esvaziarCarrinho, subtotalCarrinho, taxaEntrega, useCarrinho, type Loja } from '../../src/loja/loja'
import { escolherCupom, textoCupom, useCupom } from '../../src/pagamentos/pagamentos'
import { colors } from '../../src/theme/colors'
import { shadow } from '../../src/theme/tokens'
import { fontFamily } from '../../src/theme/typography'

type Forma = 'pix_app' | 'na_loja'

/** Pagamento (protótipo Pagamento): Pix no app ou pagar na loja, cupom e total. */
export default function Pagamento() {
  const { modo, endereco, mensagem } = useLocalSearchParams<{ modo: 'retirada' | 'entrega'; endereco?: string; mensagem?: string }>()
  const carrinho = useCarrinho()
  const cupom = useCupom(carrinho.lojaId)
  const [loja, setLoja] = useState<Loja | null>(null)
  const [forma, setForma] = useState<Forma>('pix_app')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!carrinho.lojaId) return
    abrirVitrine(carrinho.lojaId).then((v) => v.disponivel && setLoja(v.loja), (e: Error) => setErro(e.message))
  }, [carrinho.lojaId])

  const subtotal = subtotalCarrinho(carrinho)
  const entrega = loja && modo === 'entrega' ? taxaEntrega(loja, subtotal) : null
  const taxa = entrega?.ok ? entrega.taxa : 0
  const desconto = cupom ? Math.min(cupom.desconto_cents, subtotal) : 0
  const total = subtotal + taxa - desconto
  const pix = forma === 'pix_app' && total > 0

  async function confirmar() {
    if (!loja) return
    setEnviando(true)
    setErro(null)
    try {
      const itens = carrinho.itens.map((i) => ({ product_id: i.produto.id, qty: i.qty }))
      const r = await enviarSolicitacao(loja.id, itens, modo ?? 'retirada', mensagem ?? '', endereco ?? null, pix ? 'pix_app' : 'na_loja', cupom?.code ?? null)
      esvaziarCarrinho()
      escolherCupom(loja.id, null)
      // Sai do pagamento e troca a solicitação (agora vazia) pelo Pix ou pelo pedido.
      router.back()
      router.replace(r.pay_method === 'pix_app' ? { pathname: '/pagamento/pix', params: { pedido: r.id } } : `/pedidos/${r.id}`)
    } catch (e) {
      // Cupom que deixou de valer (esgotou, venceu): o tutor escolhe de novo.
      if (e instanceof Error && /cupom/i.test(e.message)) escolherCupom(loja.id, null)
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setEnviando(false)
    }
  }

  if (!loja) {
    return (
      <View style={[s.tela, s.centro]}>
        {erro ? <Text style={s.texto}>{erro}</Text> : <ActivityIndicator color={colors.primaryDeep} />}
      </View>
    )
  }

  const resumoItens = carrinho.itens.map((i) => `${i.produto.name} × ${i.qty}`).join(', ')
  const comoRecebe = modo === 'entrega' ? `Entrega · ${loja.name}` : `Retirar em até ${loja.pickup_prepare_min} min · ${loja.name}`

  return (
    <View style={s.tela}>
      <HeroiOnda titulo="Pagamento" />
      <ScrollView contentContainerStyle={s.conteudo} showsVerticalScrollIndicator={false}>
        <View style={s.cartao}>
          <Text style={s.itens} numberOfLines={2}>{resumoItens}</Text>
          <Text style={s.texto}>{comoRecebe}</Text>
        </View>

        <Text style={s.secao}>Como você quer pagar?</Text>
        <View style={s.lista}>
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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cupom ? `Cupom ${cupom.code} aplicado. Trocar` : 'Adicionar cupom de desconto'}
          onPress={() => router.push({ pathname: '/loja/cupom', params: { subtotal: String(subtotal) } })}
          style={({ pressed }) => [s.cupom, cupom && s.cupomAtivo, pressed && { opacity: 0.7 }]}
        >
          <Ticket size={22} color={cupom ? '#1F8A70' : colors.text} weight={cupom ? 'fill' : 'regular'} />
          <View style={s.flex}>
            <Text style={s.cupomTitulo}>{cupom ? `${cupom.code} aplicado` : 'Adicionar cupom'}</Text>
            {cupom ? <Text style={s.texto}>{textoCupom(cupom)}</Text> : null}
          </View>
          <CaretRight size={18} color={colors.textMuted} />
        </Pressable>

        <View style={s.totais}>
          <Linha rotulo="Subtotal" valor={reais(subtotal)} />
          {modo === 'entrega' ? <Linha rotulo="Entrega" valor={taxa ? reais(taxa) : 'Grátis'} /> : null}
          {desconto ? <Linha rotulo="Desconto" valor={`− ${reais(desconto)}`} destaque /> : null}
          <View style={s.divisorTotal} />
          <View style={s.linhaTotal}>
            <Text style={s.totalRotulo}>Total</Text>
            <Text style={s.total}>{reais(total)}</Text>
          </View>
        </View>
        {!pix ? (
          <Text style={s.nota}>A loja confirma a disponibilidade em até {loja.response_deadline_min} min e avisa você aqui.</Text>
        ) : (
          <Text style={s.nota}>O pedido vai para a loja assim que o Pix for confirmado. Se a loja não puder atender, o valor volta para você.</Text>
        )}
        {erro ? <Text style={s.erro} accessibilityRole="alert">{erro}</Text> : null}
      </ScrollView>
      <View style={s.rodape}>
        <BotaoPrimario
          titulo={pix ? 'Pagar com Pix' : 'Enviar solicitação'}
          icone={pix ? <PixLogo size={20} weight="fill" /> : undefined}
          carregando={enviando}
          desabilitado={!loja.aberta || !carrinho.itens.length}
          onPress={confirmar}
        />
        {!loja.aberta ? <Text style={s.notaRodape}>A loja está fechada agora.</Text> : null}
      </View>
    </View>
  )
}

function Opcao(p: { icone: ReactNode; fundoIcone: string; titulo: string; texto: string; ativa: boolean; onPress: () => void; ultima?: boolean }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: p.ativa }}
      onPress={p.onPress}
      style={({ pressed }) => [s.opcao, !p.ultima && s.divisor, pressed && { opacity: 0.7 }]}
    >
      <View style={[s.icone, { backgroundColor: p.fundoIcone }]}>{p.icone}</View>
      <View style={s.flex}>
        <Text style={s.opcaoTitulo}>{p.titulo}</Text>
        <Text style={s.texto}>{p.texto}</Text>
      </View>
      <View style={[s.radio, p.ativa && s.radioAtivo]}>{p.ativa ? <View style={s.radioMiolo} /> : null}</View>
    </Pressable>
  )
}

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <View style={s.linhaTotal}>
      <Text style={s.texto}>{rotulo}</Text>
      <Text style={[s.texto, destaque && s.desconto]}>{valor}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  conteudo: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
  cartao: { backgroundColor: colors.surface, borderRadius: 24, padding: 16, gap: 4, ...shadow.card },
  itens: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.text },
  texto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  secao: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.text, marginTop: 4 },
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
  divisorTotal: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 4 },
  totalRotulo: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.text },
  total: { fontFamily: fontFamily.bold, fontSize: 22, letterSpacing: -0.5, color: colors.text },
  nota: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted, paddingHorizontal: 4 },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger, paddingHorizontal: 4 },
  rodape: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, gap: 6 },
  notaRodape: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
})
