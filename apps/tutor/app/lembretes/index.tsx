import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { router, useFocusEffect } from 'expo-router'
import { animarLista, Flutuar, Surgir, Tocavel } from '../../src/components/Animacoes'
import { Icone } from '../../src/components/Icone'
import { LinhaIcone } from '../../src/components/LinhaIcone'
import { Mascote } from '../../src/components/Mascote'
import { supabase } from '../../src/lib/supabase'
import { AVISO_SEM_SALVAR } from '../../src/lib/cacheOffline'
import { useLembretes } from '../../src/lembretes/LembretesProvider'
import type { Lembrete } from '../../src/lembretes/types'
import { permissaoConcedida, pedirPermissao } from '../../src/notificacoes/notificacoes'
import { coresDoPet, type CoresPet } from '../../src/pets/coresPet'
import { usePets } from '../../src/pets/PetsProvider'
import type { Especie } from '../../src/pets/types'
import { progressoDias } from '../../src/remedios/doses'
import { normalizarHorarios, type Remedio } from '../../src/remedios/types'
import { colors } from '../../src/theme/colors'
import { fontFamily, typography } from '../../src/theme/typography'

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const AMARELO: CoresPet = { fundo: '#FFF0C9', borda: '#F5DE9A', texto: '#8A6414' }

type RemedioDoTutor = Remedio & { pets: { nome: string; especie: Especie } | null }

const p2 = (n: number) => String(n).padStart(2, '0')
const diaIso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`

/** Segunda-feira da semana de `d`. */
function inicioDaSemana(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7))
  return s
}

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "sáb, 24 de out." (montado à mão: o Intl do Hermes varia por aparelho). */
function dataPorExtenso(iso: string): string {
  const [a, m, d] = iso.split('T')[0].split('-').map(Number)
  const data = new Date(a, m - 1, d)
  return `${DIAS_CURTOS[data.getDay()]}, ${d} de ${MESES_CURTOS[m - 1]}.`
}

/**
 * Lembretes (protótipo Lembretes; board P0 "Tela Lembretes (semana, hoje e
 * mês)"): faixa da semana com os dias que têm lembrete, e os lembretes e
 * remédios em seções (atrasados, esta semana, este mês, depois). O ✓
 * conclui e recalcula a próxima; segurar apaga.
 */
export default function Lembretes() {
  const { width } = useWindowDimensions()
  const { lembretes, carregando, concluirLembrete, removerLembrete, recarregar } = useLembretes()
  const { pets } = usePets()
  const [remedios, setRemedios] = useState<RemedioDoTutor[]>([])
  const [diaEscolhido, setDiaEscolhido] = useState<string | null>(null)
  const [atualizando, setAtualizando] = useState(false)
  const [permissao, setPermissao] = useState<'inicial' | 'concedida' | 'negada' | 'indefinida'>('inicial')

  useEffect(() => {
    permissaoConcedida()
      .then((concedida) => setPermissao(concedida ? 'concedida' : 'inicial'))
      .catch(() => {})
  }, [])

  // Remédios em tratamento de todos os pets (o provider só tem o pet ativo).
  const carregarRemedios = useCallback(() => {
    const hoje = diaIso(new Date())
    return Promise.resolve(
      supabase
        .from('medications')
        .select('*, pets(nome, especie)')
        .eq('ativo', true)
        .lte('inicio', hoje)
        .or(`fim.is.null,fim.gte.${hoje}`),
    ).then(({ data }) => {
      setRemedios(
        ((data ?? []) as RemedioDoTutor[]).map((r) => ({
          ...r,
          horarios: normalizarHorarios(r.horarios as unknown as (string | number)[]),
        })),
      )
    })
  }, [])

  useFocusEffect(
    useCallback(() => {
      carregarRemedios()
    }, [carregarRemedios]),
  )

  const ativarAvisos = useCallback(async () => {
    const resultado = await pedirPermissao()
    setPermissao(resultado)
    if (resultado === 'negada') {
      Alert.alert(
        'Avisos desativados',
        'Para receber os lembretes, libere as notificações do PetLive nas configurações do aparelho.',
        [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Abrir configurações', onPress: () => Linking.openSettings() },
        ],
      )
    }
  }, [])

  const hoje = new Date()
  const hojeIso = diaIso(hoje)
  const inicioSemana = inicioDaSemana(hoje)
  const semana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicioSemana)
    d.setDate(inicioSemana.getDate() + i)
    return diaIso(d)
  })
  const fimSemana = semana[6]
  const fimMes = diaIso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0))
  const diasComLembrete = new Set(lembretes.map((l) => l.proxima_em.split('T')[0]))

  const secoes = (() => {
    const lista = diaEscolhido ? lembretes.filter((l) => l.proxima_em.startsWith(diaEscolhido)) : lembretes
    const grupos: { titulo: string; itens: Lembrete[] }[] = [
      { titulo: 'Atrasados', itens: [] },
      { titulo: diaEscolhido ? 'Neste dia' : 'Esta semana', itens: [] },
      { titulo: 'Este mês', itens: [] },
      { titulo: 'Depois', itens: [] },
    ]
    for (const l of lista) {
      const dia = l.proxima_em.split('T')[0]
      if (diaEscolhido) grupos[1].itens.push(l)
      else if (dia < hojeIso) grupos[0].itens.push(l)
      else if (dia <= fimSemana) grupos[1].itens.push(l)
      else if (dia <= fimMes) grupos[2].itens.push(l)
      else grupos[3].itens.push(l)
    }
    return grupos
  })()

  const petDe = (id: string | null) => {
    const indice = pets.findIndex((p) => p.id === id)
    return indice >= 0 ? { pet: pets[indice], cores: coresDoPet(pets[indice], indice) } : null
  }

  const confirmarRemocao = (lembrete: Lembrete) => {
    Alert.alert('Remover lembrete?', `"${lembrete.titulo}" será apagado.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => {
          animarLista()
          removerLembrete(lembrete.id)
        },
      },
    ])
  }

  const mostrarRemedios = !diaEscolhido && remedios.length > 0
  const vazio = !carregando && secoes.every((s) => s.itens.length === 0) && !mostrarRemedios

  return (
    <View style={estilos.tela}>
      <View style={estilos.heroi}>
        <View style={estilos.topo}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            hitSlop={8}
            onPress={() => router.back()}
            style={estilos.botaoBranco}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M15 5l-7 7 7 7" stroke={colors.black} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <View style={estilos.topoDireita}>
            <Text style={estilos.mes}>
              {MESES[hoje.getMonth()]} {hoje.getFullYear()}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Novo lembrete"
              hitSlop={8}
              onPress={() => router.push('/lembretes/novo')}
              style={estilos.botaoPreto}
            >
              <Text style={estilos.botaoPretoSinal}>+</Text>
            </Pressable>
          </View>
        </View>

        <Text style={estilos.titulo} accessibilityRole="header">
          Lembretes
        </Text>

        <View style={estilos.semana}>
          {semana.map((dia, i) => {
            const ehHoje = dia === hojeIso
            const escolhido = dia === diaEscolhido
            const temLembrete = diasComLembrete.has(dia)
            return (
              <Pressable
                key={dia}
                accessibilityRole="button"
                accessibilityState={{ selected: escolhido }}
                accessibilityLabel={`${DIAS_SEMANA[i]} ${Number(dia.slice(8))}${temLembrete ? ', tem lembrete' : ''}`}
                onPress={() => setDiaEscolhido(escolhido ? null : dia)}
                style={estilos.dia}
              >
                <Text style={estilos.diaNome}>{DIAS_SEMANA[i]}</Text>
                <View
                  style={[
                    estilos.diaCirculo,
                    temLembrete && estilos.diaComLembrete,
                    (ehHoje || escolhido) && estilos.diaHoje,
                  ]}
                >
                  <Text style={[estilos.diaNumero, (ehHoje || escolhido) && estilos.diaNumeroHoje]}>
                    {Number(dia.slice(8))}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </View>

        <Svg style={estilos.onda} width={width} height={46} viewBox="0 0 390 46" preserveAspectRatio="none">
          <Path
            d="M0 46V26C28 8 56 10 80 24C104 38 132 40 154 26C180 8 214 10 238 26C262 42 300 38 322 22C346 6 372 12 390 24V46z"
            fill={colors.surface}
          />
        </Svg>
      </View>

      <ScrollView
        contentContainerStyle={estilos.conteudo}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={async () => {
              setAtualizando(true)
              await Promise.all([recarregar(), carregarRemedios()])
              setAtualizando(false)
            }}
            tintColor={colors.primaryDeep}
          />
        }
      >
        {permissao !== 'concedida' ? (
          <Pressable
            accessibilityRole="button"
            onPress={ativarAvisos}
            style={({ pressed }) => [estilos.banner, pressed && { opacity: 0.8 }]}
          >
            <Text style={estilos.bannerTitulo}>{permissao === 'negada' ? 'Avisos desativados' : 'Ative os avisos'}</Text>
            <Text style={estilos.bannerTexto}>
              {permissao === 'negada'
                ? 'Toque para abrir as configurações do aparelho.'
                : 'Receba um toque antes de cada vacina, consulta ou remédio.'}
            </Text>
          </Pressable>
        ) : null}

        {carregando ? <ActivityIndicator color={colors.primaryDeep} style={{ marginTop: 24 }} /> : null}

        {vazio ? (
          <View style={estilos.vazio}>
            <Flutuar>
              <Mascote especie="gato" size={130} />
            </Flutuar>
            <Text style={estilos.vazioTitulo}>{diaEscolhido ? 'Nada neste dia' : 'Nenhum lembrete'}</Text>
            <Text style={estilos.vazioTexto}>Crie lembretes de vacina, consulta ou banho para não esquecer.</Text>
          </View>
        ) : null}

        {secoes.map((secao, s) => {
          // Os remédios em curso entram em "Esta semana", logo abaixo dos lembretes.
          const comRemedios = s === 1 && mostrarRemedios
          if (secao.itens.length === 0 && !comRemedios) return null
          return (
            <View key={secao.titulo} style={estilos.secao}>
              <Text style={estilos.secaoTitulo}>{secao.titulo}</Text>
              {secao.itens.map((lembrete, i) => {
                const dono = petDe(lembrete.pet_id)
                const cores = dono?.cores ?? coresDoPet({ cor_etiqueta: null }, i)
                return (
                  <Surgir key={lembrete.id} indice={i}>
                    <Tocavel
                      accessibilityRole="button"
                      accessibilityHint="Segure para apagar"
                      onLongPress={() => confirmarRemocao(lembrete)}
                      escala={0.98}
                      style={[estilos.cartao, { backgroundColor: cores.fundo, borderColor: cores.borda }]}
                    >
                      <View style={estilos.avatar}>
                        {dono ? <Mascote especie={dono.pet.especie} size={58} recorte /> : <Icone nome="sino" size={22} />}
                      </View>
                      <View style={estilos.flex}>
                        <Text style={estilos.cartaoTitulo} numberOfLines={1}>
                          {lembrete.titulo}
                        </Text>
                        <Text style={[estilos.cartaoSub, { color: cores.texto }]} numberOfLines={1}>
                          {[dono?.pet.nome, dataPorExtenso(lembrete.proxima_em)].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Marcar ${lembrete.titulo} como feito`}
                        hitSlop={6}
                        onPress={() => {
                          animarLista()
                          concluirLembrete(lembrete).then((ok) => {
                            if (!ok) Alert.alert('Não deu para salvar', AVISO_SEM_SALVAR)
                          })
                        }}
                        style={estilos.feito}
                      >
                        <Text style={estilos.feitoSinal}>✓</Text>
                      </Pressable>
                    </Tocavel>
                  </Surgir>
                )
              })}
              {comRemedios
                ? remedios.map((remedio, i) => {
                    const { dia, total } = progressoDias(remedio)
                    const vezes = remedio.horarios.length
                    return (
                      <Surgir key={remedio.id} indice={secao.itens.length + i}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityHint="Abre as doses do remédio"
                          onPress={() =>
                            router.push({ pathname: '/pet/[id]/medicamentos', params: { id: remedio.pet_id } })
                          }
                          style={[estilos.cartao, { backgroundColor: AMARELO.fundo, borderColor: AMARELO.borda }]}
                        >
                          <View style={estilos.avatar}>
                            <Icone nome="capsula" size={22} />
                          </View>
                          <View style={estilos.flex}>
                            <Text style={estilos.cartaoTitulo} numberOfLines={1}>
                              {remedio.nome}
                              {vezes ? `, ${vezes}× ao dia` : ''}
                            </Text>
                            <Text style={[estilos.cartaoSub, { color: AMARELO.texto }]} numberOfLines={1}>
                              {[remedio.pets?.nome, total ? `dia ${dia} de ${total}` : `dia ${dia}`].filter(Boolean).join(' · ')}
                            </Text>
                          </View>
                          <View style={estilos.feito}>
                            <Icone nome="seta" size={16} />
                          </View>
                        </Pressable>
                      </Surgir>
                    )
                  })
                : null}
            </View>
          )
        })}

        <View style={estilos.secao}>
          <LinhaIcone
            icone={<Icone nome="relogio" />}
            rotulo="Rotina de cuidados"
            valor="Antipulgas, vermífugo, banho e mais"
            onPress={() => router.push('/lembretes/rotina')}
            direita={<Icone nome="seta" size={16} cor={colors.textMuted} />}
          />
        </View>
      </ScrollView>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  heroi: { height: 290, backgroundColor: colors.hero, overflow: 'hidden', paddingHorizontal: 24, paddingTop: 56 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topoDireita: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  botaoBranco: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoPreto: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoPretoSinal: { fontFamily: fontFamily.regular, fontSize: 26, lineHeight: 30, color: colors.white },
  mes: { fontSize: 15, fontFamily: fontFamily.medium, color: colors.black },
  titulo: {
    marginTop: 14,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1.2,
    fontFamily: fontFamily.medium,
    color: colors.black,
  },
  semana: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, marginHorizontal: -8 },
  dia: { alignItems: 'center', gap: 4, flex: 1 },
  diaNome: { fontSize: 12, fontFamily: fontFamily.medium, color: colors.primaryDark },
  diaCirculo: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  diaComLembrete: { backgroundColor: colors.white },
  diaHoje: { backgroundColor: colors.black },
  diaNumero: { fontSize: 15, fontFamily: fontFamily.semiBold, color: colors.black },
  diaNumeroHoje: { color: colors.white },
  onda: { position: 'absolute', left: 0, bottom: -1 },
  conteudo: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 48, gap: 16 },
  banner: { backgroundColor: colors.warningSurface, borderRadius: 24, padding: 16, gap: 2 },
  bannerTitulo: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.warningText },
  bannerTexto: { ...typography.caption, color: colors.warningText },
  vazio: { alignItems: 'center', gap: 8, paddingTop: 24 },
  vazioTitulo: { ...typography.h3, color: colors.text },
  vazioTexto: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  secao: { gap: 10 },
  secaoTitulo: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.black },
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 30,
    borderWidth: 1.5,
    padding: 12,
    paddingRight: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.white,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartaoTitulo: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.black },
  cartaoSub: { fontSize: 13, fontFamily: fontFamily.medium },
  feito: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feitoSinal: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.black },
})
