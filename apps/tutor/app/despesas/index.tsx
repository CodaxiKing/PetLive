import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Tocavel } from '../../src/components/Animacoes'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../src/components/HeroiOnda'
import { Icone } from '../../src/components/Icone'
import { carregarDespesas, CATEGORIAS, chaveMes, reais, ROTULO_CATEGORIA, type Despesa } from '../../src/despesas/despesas'
import { usePlano } from '../../src/lib/plano'
import { usePets } from '../../src/pets/PetsProvider'
import { colors } from '../../src/theme/colors'
import { fontFamily } from '../../src/theme/typography'
import { AcoesDespesas } from '../../src/despesas/AcoesDespesas'
import { mesValido } from '../../src/despesas/relatorio'
import { useAuth } from '../../src/auth/AuthProvider'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
/** Plano grátis: últimos 3 meses (BUSINESS.md 10). */
const MESES_GRATIS = 3

/** "2026-11" deslocado n meses. */
function somarMes(chave: string, n: number): string {
  const [a, m] = chave.split('-').map(Number)
  const d = new Date(a, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function mesAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Despesas (protótipo Despesas): gasto do mês, comparação com o mês
 * anterior, gráfico dos últimos 6 meses e divisão por categoria, com filtro
 * por pet. Só registro: o PetLive não paga nem cobra nada aqui.
 */
export default function TelaDespesas() {
  const { user } = useAuth()
  return user ? <DespesasDaConta key={user.id} /> : null
}

function DespesasDaConta() {
  const parametros = useLocalSearchParams<{ mes?: string }>()
  const { pets } = usePets()
  const plano = usePlano()
  const [hoje] = useState(mesAtual)
  const [mes, setMes] = useState(() => typeof parametros.mes === 'string' && mesValido(parametros.mes) && parametros.mes <= hoje && parametros.mes >= somarMes(hoje, -11) ? parametros.mes : hoje)
  const [filtro, setFiltro] = useState<string | null>(null)
  const [despesas, setDespesas] = useState<Despesa[] | null>(null)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)

  useFocusEffect(
    useCallback(() => {
      let atual = true
      carregarDespesas(`${somarMes(hoje, -11)}-01`).then((dados) => { if (atual) { setDespesas(dados); setErroCarga(null) } }, () => { if (atual) setErroCarga('Não foi possível carregar suas despesas. Verifique a conexão e tente novamente.') })
      return () => { atual = false }
    // A tentativa força uma nova consulta após falha de conexão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hoje, tentativa]),
  )

  // Filtro por pet: a despesa de "todos" entra em qualquer pet.
  const filtradas = useMemo(
    () => (despesas ?? []).filter((d) => !filtro || d.pet_id === filtro || d.pet_id === null),
    [despesas, filtro],
  )
  const porMes = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of filtradas) m.set(chaveMes(d.data), (m.get(chaveMes(d.data)) ?? 0) + d.valor_centavos)
    return m
  }, [filtradas])

  const limiteGratis = somarMes(hoje, -(MESES_GRATIS - 1))
  const bloqueado = (chave: string) => plano === 'gratis' && chave < limiteGratis
  const mostrado = bloqueado(mes) ? limiteGratis : mes

  const total = porMes.get(mostrado) ?? 0
  const anterior = porMes.get(somarMes(mostrado, -1)) ?? 0
  const doMes = filtradas.filter((d) => chaveMes(d.data) === mostrado)
  const meses6 = Array.from({ length: 6 }, (_, i) => somarMes(mostrado, i - 5))
  const maior = Math.max(...meses6.map((k) => porMes.get(k) ?? 0), 1)
  const porCategoria = CATEGORIAS.map((c) => ({
    ...c,
    valor: doMes.filter((d) => d.categoria === c.valor).reduce((s, d) => s + d.valor_centavos, 0),
  }))
    .filter((c) => c.valor > 0)
    .sort((a, b) => b.valor - a.valor)

  const [ano, numMes] = mostrado.split('-').map(Number)
  const nomeAnterior = MESES_LONGOS[(numMes + 10) % 12]
  let comparacao = 'Primeiro mês com despesas registradas'
  if (anterior > 0) {
    const pct = Math.round(((total - anterior) / anterior) * 100)
    comparacao = pct === 0 ? `Igual a ${nomeAnterior}` : `${Math.abs(pct)}% a ${pct < 0 ? 'menos' : 'mais'} que em ${nomeAnterior}`
  } else if (total === 0) {
    comparacao = 'Nada registrado neste mês'
  }
  const nomePet = (id: string | null) => (id ? (pets.find((p) => p.id === id)?.nome ?? 'Pet') : 'Todos os pets')
  const podeVoltar = !bloqueado(somarMes(mostrado, -1)) && somarMes(mostrado, -1) >= somarMes(hoje, -11)

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo={pets.map((p) => p.nome).join(' e ') || 'Seus pets'} titulo="Despesas" altura={200} />
      {erroCarga ? <View style={estilos.conteudo}><Text accessibilityRole="alert" style={estilos.nota}>{erroCarga}</Text><BotaoPrimario titulo="Tentar carregar despesas" onPress={() => { setErroCarga(null); setDespesas(null); setTentativa((n) => n + 1) }} /></View> : despesas === null ? (
        <ActivityIndicator color={colors.primaryDeep} style={estilos.carregando} />
      ) : (
        <ScrollView style={estilos.flex} contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
          {pets.length > 1 ? (
            <View style={estilos.filtros}>
              {[null, ...pets.map((p) => p.id)].map((id) => (
                <Tocavel
                  key={id ?? 'todos'}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: filtro === id }}
                  onPress={() => setFiltro(id)}
                  style={[estilos.filtro, filtro === id && estilos.filtroAtivo]}
                >
                  <Text style={[estilos.filtroTexto, filtro === id && estilos.filtroTextoAtivo]}>{id ? nomePet(id) : 'Todos'}</Text>
                </Tocavel>
              ))}
            </View>
          ) : null}

          <View style={estilos.navMes}>
            <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" disabled={!podeVoltar} onPress={() => setMes(somarMes(mostrado, -1))} hitSlop={12}>
              <Text style={[estilos.seta, !podeVoltar && estilos.setaInativa]}>‹</Text>
            </Pressable>
            <Text style={estilos.mes}>
              {MESES_LONGOS[numMes - 1].charAt(0).toUpperCase() + MESES_LONGOS[numMes - 1].slice(1)} de {ano}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" disabled={mostrado >= hoje} onPress={() => setMes(somarMes(mostrado, 1))} hitSlop={12}>
              <Text style={[estilos.seta, mostrado >= hoje && estilos.setaInativa]}>›</Text>
            </Pressable>
          </View>

          <View style={estilos.total}>
            <Text style={estilos.totalRotulo}>Gasto no mês</Text>
            <Text style={estilos.totalValor}>{reais(total)}</Text>
            <Text style={estilos.totalApoio}>{comparacao}</Text>
          </View>

          <View style={estilos.grafico} accessibilityLabel="Gasto dos últimos 6 meses">
            {meses6.map((k) => {
              const valor = porMes.get(k) ?? 0
              const travado = bloqueado(k)
              return (
                <Pressable key={k} style={estilos.colunaGrafico} disabled={travado || k > hoje} onPress={() => setMes(k)}>
                  <View style={estilos.areaBarra}>
                    <View
                      style={[
                        estilos.barra,
                        { height: `${travado ? 12 : Math.max((valor / maior) * 100, valor ? 6 : 3)}%` },
                        k === mostrado ? estilos.barraAtual : travado ? estilos.barraTravada : null,
                      ]}
                    />
                  </View>
                  <Text style={[estilos.mesCurto, k === mostrado && estilos.mesCurtoAtivo]}>{MESES[Number(k.slice(5)) - 1]}</Text>
                </Pressable>
              )
            })}
          </View>
          {plano === 'gratis' ? <Text style={estilos.nota}>No plano grátis você vê os últimos 3 meses. O histórico completo fica no Premium.</Text> : null}

          {porCategoria.length > 0 ? (
            <View style={estilos.categorias}>
              {porCategoria.map((c) => (
                <View key={c.valor} style={estilos.categoria}>
                  <View style={[estilos.bolinha, { backgroundColor: c.cor }]} />
                  <Text style={estilos.categoriaNome}>{c.rotulo}</Text>
                  <Text style={estilos.categoriaPct}>{Math.round((c.valor / total) * 100)}%</Text>
                </View>
              ))}
            </View>
          ) : null}

          {doMes.length > 0 ? (
            <>
              <Text style={estilos.secao}>Despesas do mês</Text>
              {doMes.map((d) => (
                <Tocavel key={d.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/despesas/nova', params: { id: d.id } })} style={estilos.item}>
                  <View style={[estilos.itemIcone, { backgroundColor: CATEGORIAS.find((c) => c.valor === d.categoria)?.cor }]}>
                    <Icone nome={d.recibo_path ? 'documento' : 'sacola'} size={18} />
                  </View>
                  <View style={estilos.flex}>
                    <Text style={estilos.itemTitulo} numberOfLines={1}>
                      {d.anotacao || ROTULO_CATEGORIA[d.categoria]}
                    </Text>
                    <Text style={estilos.itemSub} numberOfLines={1}>
                      {[d.anotacao ? ROTULO_CATEGORIA[d.categoria] : null, nomePet(d.pet_id), `${d.data.slice(8, 10)}/${d.data.slice(5, 7)}`].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Text style={estilos.itemValor}>{reais(d.valor_centavos)}</Text>
                </Tocavel>
              ))}
            </>
          ) : null}
          <Text style={estilos.nota}>Só registro: o PetLive não paga nem cobra nada por aqui. Seus gastos ficam só na sua conta.</Text>
          <AcoesDespesas mes={mostrado} petId={filtro} />
        </ScrollView>
      )}

      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Adicionar despesa" icone={<Icone nome="sacola" size={22} espessura={2} />} onPress={() => router.push('/despesas/nova')} />
      </View>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  carregando: { marginTop: 40 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 14 },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filtro: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.surface },
  filtroAtivo: { backgroundColor: colors.black },
  filtroTexto: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.black },
  filtroTextoAtivo: { color: colors.white },
  navMes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seta: { fontFamily: fontFamily.bold, fontSize: 28, color: colors.black, paddingHorizontal: 4 },
  setaInativa: { color: '#C9D0DB' },
  mes: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.black },
  total: { backgroundColor: colors.premiumSurface, borderRadius: 30, paddingVertical: 18, paddingHorizontal: 22 },
  totalRotulo: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.premiumText },
  totalValor: { fontFamily: fontFamily.bold, fontSize: 40, letterSpacing: -1.2, color: colors.black, marginTop: 2 },
  totalApoio: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.premiumText },
  grafico: { flexDirection: 'row', gap: 10, height: 170, alignItems: 'flex-end' },
  colunaGrafico: { flex: 1, alignItems: 'center', gap: 6, height: '100%' },
  areaBarra: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  barra: { width: '100%', borderRadius: 14, backgroundColor: colors.primary },
  barraAtual: { backgroundColor: colors.black },
  barraTravada: { backgroundColor: '#E1E6EE' },
  mesCurto: { fontFamily: fontFamily.semiBold, fontSize: 12, color: '#566070' },
  mesCurtoAtivo: { color: colors.black, fontFamily: fontFamily.bold },
  categorias: { gap: 8 },
  categoria: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bolinha: { width: 16, height: 16, borderRadius: 8 },
  categoriaNome: { flex: 1, fontFamily: fontFamily.medium, fontSize: 16, color: colors.black },
  categoriaPct: { fontFamily: fontFamily.semiBold, fontSize: 16, color: colors.black },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 22, padding: 12 },
  itemIcone: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  itemTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  itemSub: { fontFamily: fontFamily.regular, fontSize: 12, color: '#566070' },
  itemValor: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: '#566070' },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
})
