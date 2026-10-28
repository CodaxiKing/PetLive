import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Tocavel } from '../../../src/components/Animacoes'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { reais } from '../../../src/despesas/despesas'
import { mensagemDeErro } from '../../../src/lib/cacheOffline'
import { abrirSolicitacao, cancelarSolicitacao, podeCancelar, STATUS_FINAIS, TEXTO_STATUS, type Solicitacao, type StatusSolicitacao } from '../../../src/loja/loja'
import { ligarPara, tracarRota } from '../../../src/mapa/acoes'
import { colors } from '../../../src/theme/colors'
import { fontFamily } from '../../../src/theme/typography'

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Passos que o tutor espera ver, conforme retirada ou entrega. */
function passos(s: Solicitacao): StatusSolicitacao[] {
  return s.fulfillment === 'entrega' ? ['enviada', 'confirmada', 'pronta', 'em_entrega', 'concluida'] : ['enviada', 'confirmada', 'pronta', 'concluida']
}

/** Acompanhar solicitação (protótipo Pedido): status, itens, código de entrega e contato com a loja. */
export default function AcompanharPedido() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [s, setS] = useState<Solicitacao | null | 'indisponivel'>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState(false)

  const carregar = useCallback(() => {
    if (!id) return
    abrirSolicitacao(id).then((r) => setS(r.disponivel ? r.solicitacao : 'indisponivel'), (e: unknown) => setErro(mensagemDeErro(e instanceof Error ? e.message : String(e))))
  }, [id])
  useFocusEffect(carregar)

  // Enquanto a solicitação está em andamento, confere o status a cada 20 s (a loja muda do lado dela).
  const emAndamento = s !== null && s !== 'indisponivel' && !STATUS_FINAIS.includes(s.status)
  useEffect(() => {
    if (!emAndamento) return
    const t = setInterval(carregar, 20_000)
    return () => clearInterval(t)
  }, [emAndamento, carregar])

  if (!s || s === 'indisponivel') {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        {s === 'indisponivel' ? <Text style={estilos.sub}>Solicitação não encontrada.</Text> : erro ? <Text style={estilos.sub}>{erro}</Text> : <ActivityIndicator color={colors.primaryDeep} />}
      </View>
    )
  }

  const final = STATUS_FINAIS.includes(s.status)
  const feitos = new Map(s.eventos.map((e) => [e.status, e.at]))
  const fora = ['recusada', 'expirada', 'cancelada', 'nao_compareceu'].includes(s.status)

  function cancelar() {
    if (!s || s === 'indisponivel') return
    Alert.alert('Cancelar a solicitação?', 'A loja recebe o aviso.', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Cancelar solicitação',
        style: 'destructive',
        onPress: () => {
          setCancelando(true)
          cancelarSolicitacao(s.id).then(carregar, (e: Error) => Alert.alert('Não deu para cancelar', e.message)).finally(() => setCancelando(false))
        },
      },
    ])
  }

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo={`Nº ${s.numero} · ${s.loja.name}`} titulo={TEXTO_STATUS[s.status]} altura={190} />
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        {s.codigo_entrega ? (
          <View style={estilos.codigo}>
            <Text style={estilos.codigoRotulo}>Código de entrega</Text>
            <Text style={estilos.codigoValor}>{s.codigo_entrega}</Text>
            <Text style={estilos.sub}>Passe ao entregador só quando receber o pedido.</Text>
          </View>
        ) : null}

        {fora ? (
          <View style={estilos.aviso}>
            <Text style={estilos.avisoTitulo}>{TEXTO_STATUS[s.status]}</Text>
            {s.motivo ? <Text style={estilos.avisoTexto}>{s.motivo}</Text> : null}
          </View>
        ) : (
          <View style={estilos.cartao}>
            <Text style={estilos.secao}>Status</Text>
            {passos(s).map((p, i) => {
              const em = feitos.get(p)
              return (
                <View key={p} style={estilos.passo}>
                  <View style={[estilos.bolinha, em ? estilos.bolinhaFeita : null]} />
                  {i < passos(s).length - 1 ? <View style={[estilos.traco, em ? estilos.tracoFeito : null]} /> : null}
                  <View style={estilos.flex}>
                    <Text style={[estilos.passoTexto, !em && estilos.passoPendente]}>{p === 'enviada' ? 'Solicitação enviada' : TEXTO_STATUS[p]}</Text>
                    {em ? <Text style={estilos.sub}>{quando(em)}</Text> : p === 'confirmada' && s.status === 'enviada' && s.expira_em ? <Text style={estilos.sub}>A loja responde até {quando(s.expira_em)}</Text> : null}
                  </View>
                </View>
              )
            })}
          </View>
        )}

        <View style={estilos.cartao}>
          <Text style={estilos.secao}>Itens</Text>
          {s.itens.map((i, n) => (
            <View key={n} style={estilos.linha}>
              <Text style={[estilos.sub, estilos.flex]}>{i.nome} × {i.qty}</Text>
              <Text style={estilos.sub}>{reais(i.unit_cents * i.qty)}</Text>
            </View>
          ))}
          {s.delivery_fee_cents ? <View style={estilos.linha}><Text style={[estilos.sub, estilos.flex]}>Entrega</Text><Text style={estilos.sub}>{reais(s.delivery_fee_cents)}</Text></View> : null}
          <View style={estilos.linha}><Text style={[estilos.total, estilos.flex]}>Total</Text><Text style={estilos.total}>{reais(s.total_cents)}</Text></View>
          <Text style={estilos.sub}>{s.fulfillment === 'entrega' ? `Entrega em ${s.endereco ?? 'seu endereço'}` : `Retirar em ${s.loja.name}`} · pagar na loja</Text>
          {s.message ? <Text style={estilos.recado}>“{s.message}”</Text> : null}
        </View>

        <Tocavel accessibilityRole="button" onPress={() => router.push(`/pedidos/${s.id}/conversa`)} style={estilos.conversa}>
          <Text style={estilos.conversaTexto}>Falar com a loja</Text>
          <Text style={estilos.conversaSeta}>›</Text>
        </Tocavel>

        <View style={estilos.acoes}>
          {s.loja.phone ? (
            <Tocavel accessibilityRole="button" onPress={() => ligarPara(s.loja.phone as string).catch(() => undefined)} style={estilos.acao}>
              <Text style={estilos.acaoTexto}>Ligar para a loja</Text>
            </Tocavel>
          ) : null}
          {s.fulfillment === 'retirada' && s.loja.lat !== null && s.loja.lng !== null ? (
            <Tocavel accessibilityRole="button" onPress={() => tracarRota({ lat: s.loja.lat as number, lng: s.loja.lng as number, nome: s.loja.name }).catch(() => undefined)} style={estilos.acao}>
              <Text style={estilos.acaoTexto}>Como chegar</Text>
            </Tocavel>
          ) : null}
        </View>
      </ScrollView>
      {!final && podeCancelar(s) ? (
        <View style={estilos.rodape}>
          <BotaoPrimario titulo="Cancelar solicitação" carregando={cancelando} onPress={cancelar} />
        </View>
      ) : final ? (
        <View style={estilos.rodape}>
          <BotaoPrimario titulo="Ver a loja" onPress={() => router.push(`/loja/${s.loja.id}`)} />
        </View>
      ) : null}
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  codigo: { backgroundColor: colors.successSurface, borderRadius: 24, padding: 16, alignItems: 'center', gap: 2 },
  codigoRotulo: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.successText },
  codigoValor: { fontFamily: fontFamily.extraBold, fontSize: 36, letterSpacing: 8, color: colors.black },
  aviso: { backgroundColor: colors.background, borderRadius: 22, padding: 16, gap: 4 },
  avisoTitulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  avisoTexto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  cartao: { backgroundColor: colors.background, borderRadius: 22, padding: 16, gap: 8 },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  passo: { flexDirection: 'row', gap: 12, minHeight: 44 },
  bolinha: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surface, marginTop: 2 },
  bolinhaFeita: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
  traco: { position: 'absolute', left: 7, top: 20, bottom: -4, width: 2, backgroundColor: colors.border },
  tracoFeito: { backgroundColor: colors.primaryDeep },
  passoTexto: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.black },
  passoPendente: { color: colors.textMuted },
  linha: { flexDirection: 'row', gap: 8 },
  sub: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textMuted },
  total: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  recado: { fontFamily: fontFamily.regular, fontSize: 14, color: colors.black },
  acoes: { flexDirection: 'row', gap: 10 },
  acao: { flex: 1, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  acaoTexto: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.black },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
  conversa: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primarySurface, borderRadius: 22, paddingHorizontal: 16, height: 54 },
  conversaTexto: { flex: 1, fontFamily: fontFamily.bold, fontSize: 15, color: colors.primaryDeep },
  conversaSeta: { fontFamily: fontFamily.bold, fontSize: 22, color: colors.primaryDeep },
})
