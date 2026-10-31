import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Tocavel } from '../../src/components/Animacoes'
import { HeroiOnda } from '../../src/components/HeroiOnda'
import { reais } from '../../src/despesas/despesas'
import { mensagemDeErro } from '../../src/lib/cacheOffline'
import { minhasSolicitacoes, STATUS_FINAIS, TEXTO_STATUS, type Solicitacao } from '../../src/loja/loja'
import { haQuanto } from '../../src/perdido/perdido'
import { colors } from '../../src/theme/colors'
import { fontFamily } from '../../src/theme/typography'
import { textoDeErro } from '../../src/lib/erros'

/** Minhas solicitações às lojas, das mais recentes. */
export default function Pedidos() {
  const [lista, setLista] = useState<Solicitacao[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      minhasSolicitacoes().then(setLista, (e: unknown) => setErro(mensagemDeErro(textoDeErro(e))))
    }, []),
  )

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo="Lojas" titulo="Minhas solicitações" altura={176} />
      {!lista ? (
        <View style={estilos.centro}>{erro ? <Text style={estilos.vazio}>{erro}</Text> : <ActivityIndicator color={colors.primaryDeep} />}</View>
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(s) => s.id}
          contentContainerStyle={estilos.lista}
          ItemSeparatorComponent={() => <View style={estilos.separador} />}
          ListEmptyComponent={<Text style={estilos.vazio}>Você ainda não fez solicitações. Encontre lojas no mapa.</Text>}
          renderItem={({ item }) => {
            const final = STATUS_FINAIS.includes(item.status)
            return (
              <Tocavel accessibilityRole="button" onPress={() => router.push(`/pedidos/${item.id}`)} style={estilos.cartao}>
                <View style={estilos.topo}>
                  <Text style={estilos.loja} numberOfLines={1}>{item.loja.name}</Text>
                  <Text style={[estilos.status, final ? estilos.statusFinal : estilos.statusAtivo]}>{TEXTO_STATUS[item.status]}</Text>
                </View>
                <Text style={estilos.sub} numberOfLines={1}>{item.itens.map((i) => `${i.nome} × ${i.qty}`).join(', ')}</Text>
                <Text style={estilos.sub}>Nº {item.numero} · {reais(item.total_cents)} · {haQuanto(item.criado_em)}</Text>
              </Tocavel>
            )
          }}
        />
      )}
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  lista: { paddingHorizontal: 24, paddingBottom: 32 },
  separador: { height: 10 },
  cartao: { backgroundColor: colors.surface, borderRadius: 22, padding: 14, gap: 4 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loja: { flex: 1, fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  status: { fontFamily: fontFamily.bold, fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  statusAtivo: { backgroundColor: colors.primarySurface, color: colors.primaryDeep },
  statusFinal: { backgroundColor: colors.surface, color: colors.textMuted },
  sub: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textMuted },
  vazio: { fontFamily: fontFamily.regular, fontSize: 14, color: colors.textMuted, textAlign: 'center', padding: 24 },
})
