import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Tocavel } from '../../src/components/Animacoes'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { Icone } from '../../src/components/Icone'
import { reais } from '../../src/despesas/despesas'
import { mensagemDeErro } from '../../src/lib/cacheOffline'
import { avaliacoesDaLoja, type AvaliacoesLoja } from '../../src/loja/avaliacoes'
import { haQuanto } from '../../src/perdido/perdido'
import { abrirVitrine, CATEGORIAS_PRODUTO, horarioDeHoje, subtotalCarrinho, useCarrinho, type CategoriaProduto, type Vitrine } from '../../src/loja/loja'
import { colors } from '../../src/theme/colors'
import { fontFamily } from '../../src/theme/typography'

/** Vitrine da loja (protótipo Loja): produtos por categoria, serviços e a solicitação em andamento. */
export default function LojaVitrine() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [vitrine, setVitrine] = useState<Vitrine | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aba, setAba] = useState<'produtos' | 'servicos'>('produtos')
  const [categoria, setCategoria] = useState<CategoriaProduto | null>(null)
  const carrinho = useCarrinho()
  const [avaliacoes, setAvaliacoes] = useState<AvaliacoesLoja | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (!id) return
      avaliacoesDaLoja(id).then(setAvaliacoes, () => undefined)
      abrirVitrine(id).then(setVitrine, (e: unknown) => setErro(mensagemDeErro(e instanceof Error ? e.message : String(e))))
    }, [id]),
  )

  const categorias = useMemo(() => {
    if (!vitrine?.disponivel) return []
    const usadas = new Set(vitrine.produtos.map((p) => p.categoria))
    return CATEGORIAS_PRODUTO.filter((c) => usadas.has(c.valor))
  }, [vitrine])

  if (!vitrine) {
    return <View style={[estilos.tela, estilos.centro]}>{erro ? <Text style={estilos.vazio}>{erro}</Text> : <ActivityIndicator color={colors.primaryDeep} />}</View>
  }
  if (!vitrine.disponivel) {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        <Text style={estilos.titulo}>Loja indisponível</Text>
        <Text style={estilos.vazio}>Esta loja não está no PetLive agora.</Text>
        <View style={estilos.voltar}>
          <BotaoPrimario titulo="Voltar" onPress={() => router.back()} />
        </View>
      </View>
    )
  }

  const { loja, produtos, servicos } = vitrine
  const lista = categoria ? produtos.filter((p) => p.categoria === categoria) : produtos
  const temProdutos = loja.oferece !== 'servicos'
  const temServicos = loja.oferece !== 'produtos'
  const abaAtual = temProdutos ? aba : 'servicos'
  const noCarrinho = carrinho.lojaId === loja.id ? carrinho.itens.reduce((s, i) => s + i.qty, 0) : 0
  const horario = horarioDeHoje(loja)

  return (
    <View style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        <View style={estilos.heroi}>
          <Tocavel accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={estilos.botaoVoltar}>
            <Icone nome="seta" size={18} espessura={2.2} />
          </Tocavel>
          <View style={estilos.selos}>
            <Text style={[estilos.selo, loja.aberta ? estilos.seloAberto : estilos.seloFechado]}>{loja.aberta ? 'Aberto agora' : 'Fechado agora'}</Text>
            {loja.rating_count ? <Text style={estilos.selo}>★ {String(loja.rating_avg).replace('.', ',')}</Text> : null}
          </View>
          <Text style={estilos.nome}>{loja.name}</Text>
          <Text style={estilos.sub}>{[loja.neighborhood, loja.city].filter(Boolean).join(', ') || loja.address}</Text>
          <Text style={estilos.sub}>
            {[horario, loja.pickup_enabled ? 'Retirada' : null, loja.delivery_enabled ? `Entrega ${loja.delivery_eta_min}–${loja.delivery_eta_max} min` : null].filter(Boolean).join(' · ')}
          </Text>
        </View>

        {temProdutos && temServicos ? (
          <View style={estilos.abas}>
            {(['produtos', 'servicos'] as const).map((a) => (
              <Tocavel key={a} accessibilityRole="tab" accessibilityState={{ selected: abaAtual === a }} onPress={() => setAba(a)} style={[estilos.aba, abaAtual === a && estilos.abaAtiva]}>
                <Text style={[estilos.abaTexto, abaAtual === a && estilos.textoClaro]}>{a === 'produtos' ? 'Produtos' : 'Serviços'}</Text>
              </Tocavel>
            ))}
          </View>
        ) : null}

        {abaAtual === 'produtos' ? (
          <>
            {categorias.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.chips}>
                <Tocavel accessibilityRole="radio" accessibilityState={{ selected: categoria === null }} onPress={() => setCategoria(null)} style={[estilos.chip, categoria === null && estilos.chipAtivo]}>
                  <Text style={[estilos.chipTexto, categoria === null && estilos.textoClaro]}>Tudo</Text>
                </Tocavel>
                {categorias.map((c) => (
                  <Tocavel key={c.valor} accessibilityRole="radio" accessibilityState={{ selected: categoria === c.valor }} onPress={() => setCategoria(c.valor)} style={[estilos.chip, categoria === c.valor && estilos.chipAtivo]}>
                    <Text style={[estilos.chipTexto, categoria === c.valor && estilos.textoClaro]}>{c.rotulo}</Text>
                  </Tocavel>
                ))}
              </ScrollView>
            ) : null}
            {lista.length === 0 ? <Text style={estilos.vazio}>Nenhum produto na vitrine ainda.</Text> : null}
            <View style={estilos.grade}>
              {lista.map((p) => (
                <Tocavel key={p.id} accessibilityRole="button" accessibilityLabel={p.name} onPress={() => router.push(`/loja/produto/${p.id}`)} style={estilos.cartao}>
                  {p.photo_url ? <Image source={{ uri: p.photo_url }} style={estilos.foto} /> : <View style={[estilos.foto, estilos.semFoto]}><Icone nome="sacola" size={26} cor={colors.primaryDeep} /></View>}
                  {p.venda === 'local_com_receita' ? <Text style={estilos.receita}>Receita</Text> : !p.disponivel ? <Text style={estilos.esgotado}>Esgotado</Text> : null}
                  <Text style={estilos.produtoNome} numberOfLines={2}>{p.name}</Text>
                  <Text style={estilos.preco}>{p.price_cents === null ? 'Preço na loja' : reais(p.price_cents)}</Text>
                </Tocavel>
              ))}
            </View>
          </>
        ) : (
          <View style={estilos.servicos}>
            {servicos.length === 0 ? <Text style={estilos.vazio}>Nenhum serviço cadastrado ainda.</Text> : null}
            {servicos.map((s) => (
              <View key={s.id} style={estilos.servico}>
                <View style={estilos.flex}>
                  <Text style={estilos.produtoNome}>{s.name}</Text>
                  <Text style={estilos.sub}>{[s.duration_min ? `${s.duration_min} min` : null, s.description].filter(Boolean).join(' · ')}</Text>
                </View>
                <Text style={estilos.preco}>{s.price_cents === null ? 'Sob consulta' : reais(s.price_cents)}</Text>
              </View>
            ))}
            {servicos.length ? <Text style={estilos.nota}>Agendar pelo app chega em breve. Por enquanto, combine com a loja por telefone.</Text> : null}
          </View>
        )}
        {avaliacoes && avaliacoes.itens.length ? (
          <View style={estilos.avaliacoes}>
            <Text style={estilos.secao}>Avaliações · ★ {String(avaliacoes.media ?? '').replace('.', ',')} ({avaliacoes.total})</Text>
            {avaliacoes.itens.slice(0, 5).map((a) => (
              <View key={a.id} style={estilos.avaliacao}>
                <Text style={estilos.produtoNome}>{'★'.repeat(a.rating)}{'☆'.repeat(5 - a.rating)} · {a.autor}</Text>
                {a.text ? <Text style={estilos.sub}>{a.text}</Text> : null}
                <Text style={estilos.sub}>{haQuanto(a.criado_em)}</Text>
                {a.reply_text ? <Text style={estilos.resposta}>Resposta da loja: {a.reply_text}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      {noCarrinho ? (
        <View style={estilos.rodape}>
          <BotaoPrimario titulo={`Ver solicitação · ${noCarrinho} ${noCarrinho === 1 ? 'item' : 'itens'} · ${reais(subtotalCarrinho(carrinho))}`} onPress={() => router.push('/loja/solicitar')} />
        </View>
      ) : null}
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingBottom: 32 },
  heroi: { backgroundColor: colors.hero, paddingTop: 52, paddingHorizontal: 24, paddingBottom: 22, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, gap: 4 },
  botaoVoltar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }], marginBottom: 12 },
  selos: { flexDirection: 'row', gap: 6 },
  selo: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.black, backgroundColor: colors.white, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  seloAberto: { backgroundColor: colors.successSurface, color: colors.successText },
  seloFechado: { backgroundColor: colors.background, color: colors.textMuted },
  nome: { fontFamily: fontFamily.medium, fontSize: 30, letterSpacing: -0.8, color: colors.black, marginTop: 6 },
  sub: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textMuted },
  titulo: { fontFamily: fontFamily.bold, fontSize: 20, color: colors.black },
  abas: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginTop: 16 },
  aba: { flex: 1, height: 42, borderRadius: 21, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  abaAtiva: { backgroundColor: colors.black },
  abaTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  textoClaro: { color: colors.white },
  chips: { gap: 6, paddingHorizontal: 24, paddingTop: 14 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center' },
  chipAtivo: { backgroundColor: colors.black, borderColor: colors.black },
  chipTexto: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.black },
  grade: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 18, paddingTop: 12 },
  cartao: { width: '50%', padding: 6, gap: 4 },
  foto: { width: '100%', aspectRatio: 1, borderRadius: 22 },
  semFoto: { backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  receita: { position: 'absolute', top: 14, left: 14, fontFamily: fontFamily.bold, fontSize: 11, color: colors.healthText, backgroundColor: colors.healthSurface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  esgotado: { position: 'absolute', top: 14, left: 14, fontFamily: fontFamily.bold, fontSize: 11, color: colors.textMuted, backgroundColor: colors.white, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  produtoNome: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.black },
  preco: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.primaryDeep },
  servicos: { paddingHorizontal: 24, paddingTop: 14, gap: 10 },
  servico: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.background, borderRadius: 22, padding: 14 },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  vazio: { fontFamily: fontFamily.regular, fontSize: 14, color: colors.textMuted, paddingHorizontal: 24, paddingTop: 16, textAlign: 'center' },
  voltar: { alignSelf: 'stretch', marginTop: 16 },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
  avaliacoes: { paddingHorizontal: 24, paddingTop: 20, gap: 8 },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  avaliacao: { backgroundColor: colors.background, borderRadius: 20, padding: 12, gap: 2 },
  resposta: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.primaryDeep, marginTop: 4 },
})
