import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../src/components/HeroiOnda'
import { reais } from '../../src/despesas/despesas'
import { pagamentoDetalhe, type Pagamento } from '../../src/pagamentos/pagamentos'
import { colors } from '../../src/theme/colors'
import { shadow } from '../../src/theme/tokens'
import { fontFamily } from '../../src/theme/typography'

const STATUS: Record<Pagamento['status'], string> = {
  criando: 'Gerando o Pix',
  pendente: 'Aguardando o pagamento',
  pago: 'Pagamento confirmado',
  expirado: 'Pix vencido',
  cancelado: 'Pagamento cancelado',
  estorno_pendente: 'Estorno a caminho',
  estornado: 'Valor devolvido',
}

const dataHora = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

/** Pagamento confirmado e comprovante (protótipo PagamentoOk). */
export default function Comprovante() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [pg, setPg] = useState<Pagamento | null | 'indisponivel'>(null)

  useEffect(() => {
    if (id) pagamentoDetalhe(id).then((p) => setPg(p ?? 'indisponivel'), () => setPg('indisponivel'))
  }, [id])

  if (!pg || pg === 'indisponivel') {
    return (
      <View style={s.tela}>
        <HeroiOnda titulo="Comprovante" />
        <View style={s.centro}>{pg ? <Text style={s.texto}>Pagamento não encontrado.</Text> : <ActivityIndicator color={colors.primaryDeep} />}</View>
      </View>
    )
  }

  const pago = pg.status === 'pago' || pg.status === 'estorno_pendente' || pg.status === 'estornado'
  const linhas: [string, string][] = [
    ['Para', pg.para ?? 'PetLive'],
    ...(pg.itens.length ? ([['Item', pg.itens.join('\n')]] as [string, string][]) : [['Descrição', pg.descricao] as [string, string]]),
    ['Pago por Pix', pg.paid_at ? dataHora(pg.paid_at) : '—'],
    ['Código', `#${pg.codigo}`],
  ]

  function compartilhar() {
    if (pg === null || pg === 'indisponivel') return
    const texto = [`Comprovante PetLive #${pg.codigo}`, `${reais(pg.amount_cents)} por Pix`, ...linhas.slice(0, -1).map(([a, b]) => `${a}: ${b.replace(/\n/g, ', ')}`)].join('\n')
    Share.share({ message: texto }).catch(() => undefined)
  }

  return (
    <View style={s.tela}>
      <HeroiOnda titulo={STATUS[pg.status]} />
      <ScrollView contentContainerStyle={s.conteudo} showsVerticalScrollIndicator={false}>
        <View style={s.topo}>
          {pago ? (
            <View style={s.selo}>
              <CheckCircle size={40} color="#1F8A70" weight="fill" />
            </View>
          ) : null}
          <Text style={s.valor}>{reais(pg.amount_cents)}</Text>
        </View>
        <View style={s.lista}>
          {linhas.map(([rotulo, valor], i) => (
            <View key={rotulo} style={[s.linha, i > 0 && s.divisor]}>
              <Text style={s.rotulo}>{rotulo}</Text>
              <Text style={s.valorLinha}>{valor}</Text>
            </View>
          ))}
        </View>
        <Text style={s.nota}>
          {pg.status === 'estorno_pendente'
            ? 'O pedido não pôde ser atendido. O valor volta para a sua conta em até 3 dias úteis.'
            : pg.status === 'estornado'
              ? 'O valor já foi devolvido para a conta que pagou.'
              : pg.request_id
                ? 'A loja foi avisada. Você recebe uma notificação quando estiver pronto.'
                : pg.album_order_id
                  ? 'O álbum vai para a gráfica parceira. Você acompanha o pedido na tela do álbum.'
                : 'Você recebe uma notificação a cada passo do pedido.'}
        </Text>
      </ScrollView>
      <View style={s.rodape}>
        <BotaoPrimario titulo="Comprovante" claro estilo={s.flex} onPress={compartilhar} />
        {pg.request_id ? <BotaoPrimario titulo="Acompanhar" estilo={s.flex} onPress={() => router.replace(`/pedidos/${pg.request_id}`)} /> : <BotaoPrimario titulo="Concluir" estilo={s.flex} onPress={() => router.back()} />}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  flex: { flex: 1 },
  conteudo: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  topo: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  selo: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#DDF5EC', alignItems: 'center', justifyContent: 'center' },
  valor: { fontFamily: fontFamily.bold, fontSize: 34, letterSpacing: -1, color: colors.text },
  lista: { backgroundColor: colors.surface, borderRadius: 26, ...shadow.card },
  linha: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingHorizontal: 18, paddingVertical: 14 },
  divisor: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rotulo: { fontFamily: fontFamily.regular, fontSize: 14, color: colors.textMuted },
  valorLinha: { flex: 1, textAlign: 'right', fontFamily: fontFamily.bold, fontSize: 14, color: colors.text },
  texto: { fontFamily: fontFamily.regular, fontSize: 14, color: colors.textMuted },
  nota: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted, paddingHorizontal: 4, textAlign: 'center' },
  rodape: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
})
