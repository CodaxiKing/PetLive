import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Tocavel } from '../../../src/components/Animacoes'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { Icone } from '../../../src/components/Icone'
import { reais } from '../../../src/despesas/despesas'
import { mensagemDeErro } from '../../../src/lib/cacheOffline'
import { abrirProduto, adicionarAoCarrinho, denunciarItem, esvaziarCarrinho, MOTIVOS_DENUNCIA_LOJA, type Loja, type Produto } from '../../../src/loja/loja'
import { tracarRota } from '../../../src/mapa/acoes'
import { colors } from '../../../src/theme/colors'
import { fontFamily } from '../../../src/theme/typography'

/**
 * Produto (protótipos Produto e ProdutoReceita). Produto "só no local, com
 * receita" mostra preço e o aviso da loja, sem poder solicitar pelo app.
 */
export default function ProdutoLoja() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [dados, setDados] = useState<{ produto: Produto; loja: Loja } | null | 'indisponivel'>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [qtd, setQtd] = useState(1)

  useFocusEffect(
    useCallback(() => {
      if (!id) return
      abrirProduto(id).then(
        (r) => setDados(r.disponivel ? { produto: r.produto, loja: r.loja } : 'indisponivel'),
        (e: unknown) => setErro(mensagemDeErro(e instanceof Error ? e.message : String(e))),
      )
    }, [id]),
  )

  if (!dados || dados === 'indisponivel') {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        {dados === 'indisponivel' ? <Text style={estilos.texto}>Este produto não está mais na vitrine.</Text> : erro ? <Text style={estilos.texto}>{erro}</Text> : <ActivityIndicator color={colors.primaryDeep} />}
      </View>
    )
  }

  const { produto, loja } = dados
  const receita = produto.venda === 'local_com_receita'
  const maximo = Math.min(99, produto.stock ?? 99)

  function adicionar() {
    const item = { id: produto.id, name: produto.name, price_cents: produto.price_cents, photo_url: produto.photo_url }
    if (adicionarAoCarrinho(loja.id, item, qtd) === 'outra_loja') {
      Alert.alert('Começar outra solicitação?', 'Sua solicitação tem itens de outra loja. Cada solicitação é de uma loja só.', [
        { text: 'Manter a atual', style: 'cancel' },
        { text: 'Começar nova', style: 'destructive', onPress: () => { esvaziarCarrinho(); adicionarAoCarrinho(loja.id, item, qtd); router.back() } },
      ])
      return
    }
    router.back()
  }

  return (
    <View style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        <View style={estilos.fotoCaixa}>
          {produto.photo_url ? <Image source={{ uri: produto.photo_url }} style={estilos.foto} accessibilityLabel={produto.name} /> : <Icone nome="sacola" size={64} cor={colors.primaryDeep} />}
          <Tocavel accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={estilos.botaoVoltar}>
            <Icone nome="seta" size={18} espessura={2.2} />
          </Tocavel>
        </View>
        <View style={estilos.corpo}>
          {receita ? <Text style={estilos.seloReceita}>Venda com receita</Text> : null}
          <Text style={estilos.nome}>{produto.name}</Text>
          <View style={estilos.linha}>
            <Text style={estilos.preco}>{produto.price_cents === null ? 'Preço na loja' : reais(produto.price_cents)}</Text>
            <Text style={[estilos.estado, produto.disponivel || receita ? estilos.estadoOk : estilos.estadoFora]}>
              {receita ? 'Só na loja' : produto.disponivel ? (produto.stock !== null ? `${produto.stock} em estoque` : 'Disponível') : 'Esgotado'}
            </Text>
          </View>

          {receita ? (
            <View style={estilos.aviso}>
              <Text style={estilos.avisoTitulo}>Exige receita veterinária</Text>
              <Text style={estilos.avisoTexto}>{produto.receita_msg ?? 'Venda mediante receita veterinária. A compra é feita só na loja; aqui você vê preço e disponibilidade.'}</Text>
            </View>
          ) : null}
          {produto.mensagem_tutor ? <Text style={estilos.recado}>{produto.mensagem_tutor}</Text> : null}
          {produto.description ? (
            <>
              <Text style={estilos.secao}>Sobre o produto</Text>
              <Text style={estilos.texto}>{produto.description}</Text>
            </>
          ) : null}

          <Tocavel accessibilityRole="link" onPress={() => router.push(`/loja/${loja.id}`)} style={estilos.loja}>
            <View style={estilos.flex}>
              <Text style={estilos.lojaNome}>{loja.name}</Text>
              <Text style={estilos.texto}>{[loja.aberta ? 'Aberto agora' : 'Fechado agora', loja.pickup_enabled ? 'Retirada na loja' : null, loja.delivery_enabled ? 'Entrega' : null].filter(Boolean).join(' · ')}</Text>
            </View>
            <Text style={estilos.seta}>›</Text>
          </Tocavel>
          <Tocavel
            accessibilityRole="button"
            onPress={() =>
              Alert.alert('Denunciar este anúncio', 'A equipe do PetLive revisa.', [
                ...MOTIVOS_DENUNCIA_LOJA.map((m) => ({
                  text: m,
                  onPress: () => denunciarItem('produto', produto.id, m).then(() => Alert.alert('Obrigado', 'Recebemos a denúncia.'), (e: Error) => Alert.alert('Não deu certo', e.message)),
                })),
                { text: 'Cancelar', style: 'cancel' as const },
              ])
            }
            style={estilos.denunciar}
          >
            <Text style={estilos.denunciarTexto}>Denunciar este anúncio</Text>
          </Tocavel>
        </View>
      </ScrollView>

      <View style={estilos.rodape}>
        {receita ? (
          <>
            <Text style={estilos.nota}>Não é possível solicitar nem pagar este produto pelo app.</Text>
            {loja.lat !== null && loja.lng !== null ? (
              <BotaoPrimario titulo="Como chegar" onPress={() => tracarRota({ lat: loja.lat as number, lng: loja.lng as number, nome: loja.name }).catch(() => undefined)} />
            ) : null}
          </>
        ) : produto.disponivel ? (
          <View style={estilos.compra}>
            <View style={estilos.contador}>
              <Tocavel accessibilityRole="button" accessibilityLabel="Menos um" disabled={qtd <= 1} onPress={() => setQtd((q) => Math.max(1, q - 1))} style={estilos.botaoQtd}>
                <Text style={estilos.qtdTexto}>−</Text>
              </Tocavel>
              <Text style={estilos.qtd} accessibilityLabel={`${qtd} unidades`}>{qtd}</Text>
              <Tocavel accessibilityRole="button" accessibilityLabel="Mais um" disabled={qtd >= maximo} onPress={() => setQtd((q) => Math.min(maximo, q + 1))} style={estilos.botaoQtd}>
                <Text style={estilos.qtdTexto}>+</Text>
              </Tocavel>
            </View>
            <View style={estilos.flex}>
              <BotaoPrimario titulo="Solicitar produto" desabilitado={!loja.aberta} onPress={adicionar} />
            </View>
          </View>
        ) : (
          <Text style={estilos.nota}>Produto esgotado no momento.</Text>
        )}
        {!receita && produto.disponivel && !loja.aberta ? <Text style={estilos.nota}>A loja está fechada agora. Volte no horário de atendimento.</Text> : null}
      </View>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingBottom: 24 },
  fotoCaixa: { height: 320, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  foto: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  botaoVoltar: { position: 'absolute', left: 24, top: 52, width: 46, height: 46, borderRadius: 23, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }] },
  corpo: { paddingHorizontal: 24, paddingTop: 18, gap: 10 },
  seloReceita: { alignSelf: 'flex-start', fontFamily: fontFamily.bold, fontSize: 12, color: colors.healthText, backgroundColor: colors.healthSurface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  nome: { fontFamily: fontFamily.bold, fontSize: 26, letterSpacing: -0.6, color: colors.black },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  preco: { fontFamily: fontFamily.bold, fontSize: 22, color: colors.black },
  estado: { fontFamily: fontFamily.bold, fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  estadoOk: { color: colors.successText, backgroundColor: colors.successSurface },
  estadoFora: { color: colors.textMuted, backgroundColor: colors.surface },
  aviso: { backgroundColor: colors.healthSurface, borderRadius: 22, padding: 14, gap: 4 },
  avisoTitulo: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.healthText },
  avisoTexto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.black },
  recado: { fontFamily: fontFamily.medium, fontSize: 14, color: colors.primaryDeep, backgroundColor: colors.primarySurface, borderRadius: 18, padding: 12 },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 6 },
  texto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  loja: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 22, padding: 14, marginTop: 6 },
  lojaNome: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  seta: { fontFamily: fontFamily.bold, fontSize: 22, color: colors.textMuted },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28, gap: 8 },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  compra: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contador: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 28, height: 56, paddingHorizontal: 6 },
  botaoQtd: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  qtdTexto: { fontFamily: fontFamily.bold, fontSize: 22, color: colors.black },
  qtd: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black, minWidth: 24, textAlign: 'center' },
  denunciar: { alignSelf: 'center', padding: 8 },
  denunciarTexto: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.textMuted, textDecorationLine: 'underline' },
})
