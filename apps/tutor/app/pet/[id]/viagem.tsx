import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Tocavel } from '../../../src/components/Animacoes'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { ControleSegmentado } from '../../../src/components/ControleSegmentado'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { Icone } from '../../../src/components/Icone'
import { mensagemDeErro } from '../../../src/lib/cacheOffline'
import { abrirPdf } from '../../../src/lib/pdf'
import { usePlano } from '../../../src/lib/plano'
import { usePets } from '../../../src/pets/PetsProvider'
import {
  AVISO_REGRAS,
  carregarConteudo,
  htmlChecklist,
  marcadoSozinho,
  salvarViagem,
  ultimaViagem,
  type Companhia,
  type ItemViagem,
  type Modo,
} from '../../../src/pets/viagem'
import { dataParaExibicao, dataParaIso } from '../../../src/saude/types'
import { mascaraData } from '../../../src/lib/mascaras'
import { supabase } from '../../../src/lib/supabase'
import type { Vacina } from '../../../src/saude/types'
import { colors } from '../../../src/theme/colors'
import { fontFamily } from '../../../src/theme/typography'

const MODOS: Modo[] = ['carro', 'aviao']

/**
 * Viagem com pet (protótipo Viagem): carro ou avião, destino e data, a lista
 * do conteúdo mestre (antirrábica em dia se marca sozinha) e as regras da
 * companhia só como referência. Salva a lista; o PDF fica no Premium.
 */
export default function TelaViagem() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pets } = usePets()
  const plano = usePlano()
  const pet = pets.find((p) => p.id === id) ?? null
  const [itens, setItens] = useState<ItemViagem[] | null>(null)
  const [companhias, setCompanhias] = useState<Companhia[]>([])
  const [vacinas, setVacinas] = useState<Vacina[]>([])
  const [viagemId, setViagemId] = useState<string | null>(null)
  const [modo, setModo] = useState<Modo>('aviao')
  const [destino, setDestino] = useState('')
  const [data, setData] = useState('')
  const [companhiaId, setCompanhiaId] = useState<string | null>(null)
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [salvando, setSalvando] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (!id) return
      carregarConteudo().then((c) => {
        setItens(c.itens)
        setCompanhias(c.companhias)
      }, () => setItens([]))
      supabase.from('vaccinations').select('*').eq('pet_id', id).then(({ data: v }) => setVacinas((v ?? []) as Vacina[]))
      ultimaViagem(id).then((v) => {
        if (!v) return
        setViagemId(v.id)
        setModo(v.modo)
        setDestino(v.destino ?? '')
        setData(v.data ? dataParaExibicao(v.data) : '')
        setCompanhiaId(v.companhia_id)
        setMarcados(new Set(v.marcados))
      }, () => undefined)
    }, [id]),
  )

  if (!pet) return <View style={estilos.tela} />
  const lista = (itens ?? []).filter((i) => i.modo === 'ambos' || i.modo === modo)
  const feitos = new Set(lista.filter((i) => marcados.has(i.id) || marcadoSozinho(i, vacinas)).map((i) => i.id))
  const companhia = modo === 'aviao' ? (companhias.find((c) => c.id === companhiaId) ?? null) : null

  function alternar(item: ItemViagem) {
    if (marcadoSozinho(item, vacinas)) {
      Alert.alert('Marcado pelo app', 'A antirrábica está em dia na carteirinha. Se vencer, o item desmarca sozinho.')
      return
    }
    setMarcados((atual) => {
      const nova = new Set(atual)
      if (nova.has(item.id)) nova.delete(item.id)
      else nova.add(item.id)
      return nova
    })
  }

  function viagemAtual() {
    return {
      pet_id: pet!.id,
      modo,
      destino: destino.trim() || null,
      data: data ? dataParaIso(data) : null,
      companhia_id: modo === 'aviao' ? companhiaId : null,
      marcados: [...marcados],
    }
  }

  async function salvar() {
    if (data && !dataParaIso(data)) {
      Alert.alert('Confira a data', 'Use o formato DD/MM/AAAA.')
      return
    }
    setSalvando(true)
    try {
      setViagemId(await salvarViagem({ id: viagemId, ...viagemAtual() }))
      Alert.alert('Checklist salvo', `${feitos.size} de ${lista.length} itens prontos. ${modo === 'aviao' ? AVISO_REGRAS : ''}`)
    } catch (e) {
      Alert.alert('Não deu para salvar', mensagemDeErro(e instanceof Error ? e.message : String(e)))
    } finally {
      setSalvando(false)
    }
  }

  async function pdf() {
    if (plano !== 'premium') {
      Alert.alert('Checklist em PDF', 'O PDF faz parte do Premium. A lista e o salvar continuam no plano grátis.')
      return
    }
    const r = await abrirPdf(htmlChecklist(pet!, viagemAtual(), lista, feitos, companhia)).catch(() => 'erro' as const)
    if (r === 'sem-modulo') Alert.alert('Atualize o app', 'O PDF precisa da versão mais nova do PetLive na loja de apps.')
    if (r === 'erro') Alert.alert('Não deu para gerar o PDF', 'Tente de novo em instantes.')
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo={`Viagem · ${pet.nome}`} titulo="Viagem com pet" altura={200} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <ControleSegmentado opcoes={['Carro', 'Avião']} ativo={MODOS.indexOf(modo)} onSelecionar={(i) => setModo(MODOS[i])} />

        <View style={estilos.destino}>
          <Text style={estilos.rotulo}>Destino e data</Text>
          <View style={estilos.linha}>
            <TextInput value={destino} onChangeText={setDestino} placeholder="Cidade" placeholderTextColor={colors.textMuted} accessibilityLabel="Destino" maxLength={80} style={[estilos.entrada, estilos.flex]} />
            <TextInput value={data} onChangeText={(t) => setData(mascaraData(t))} placeholder="DD/MM/AAAA" placeholderTextColor={colors.textMuted} accessibilityLabel="Data da viagem" keyboardType="number-pad" maxLength={10} style={[estilos.entrada, estilos.data]} />
          </View>
        </View>

        {modo === 'aviao' && companhias.length > 0 ? (
          <View style={estilos.companhias}>
            {companhias.map((c) => (
              <Tocavel key={c.id} accessibilityRole="radio" accessibilityState={{ selected: companhiaId === c.id }} onPress={() => setCompanhiaId(companhiaId === c.id ? null : c.id)} style={[estilos.chip, companhiaId === c.id && estilos.chipAtivo]}>
                <Text style={[estilos.chipTexto, companhiaId === c.id && estilos.chipTextoAtivo]}>{c.nome}</Text>
              </Tocavel>
            ))}
          </View>
        ) : null}

        {itens === null ? (
          <ActivityIndicator color={colors.primaryDeep} />
        ) : (
          lista.map((i) => {
            const feito = feitos.has(i.id)
            return (
              <Pressable key={i.id} accessibilityRole="checkbox" accessibilityState={{ checked: feito }} onPress={() => alternar(i)} style={estilos.item}>
                <View style={[estilos.caixa, feito && estilos.caixaFeita]}>{feito ? <Icone nome="check" size={16} cor={colors.primary} espessura={2.4} /> : null}</View>
                <View style={estilos.flex}>
                  <Text style={estilos.itemTitulo}>{i.titulo}</Text>
                  {i.detalhe ? <Text style={estilos.itemSub}>{i.automatico && feito ? 'Em dia na carteirinha' : i.detalhe}</Text> : null}
                </View>
              </Pressable>
            )
          })
        )}

        {companhia ? (
          <View style={estilos.regras}>
            <Text style={estilos.regrasTitulo}>{companhia.nome}</Text>
            <Text style={estilos.regrasTexto}>{companhia.regras ?? 'Confira as regras para pets no site oficial da companhia.'}</Text>
            {companhia.revisado_em ? <Text style={estilos.regrasData}>Revisado em {dataParaExibicao(companhia.revisado_em)}</Text> : null}
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(companhia.link).catch(() => undefined)}>
              <Text style={estilos.regrasLink}>Abrir o site da companhia</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={estilos.aviso}>{modo === 'aviao' ? AVISO_REGRAS : 'Confira também as regras do destino, como hotéis e praias.'}</Text>
        <Tocavel accessibilityRole="button" onPress={pdf} style={estilos.pdf}>
          <Icone nome="documento" size={20} />
          <Text style={estilos.pdfTexto}>Gerar PDF{plano === 'premium' ? '' : ' · Premium'}</Text>
        </Tocavel>
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Salvar checklist" carregando={salvando} icone={<Icone nome="check" size={22} espessura={2} />} onPress={salvar} />
      </View>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 10 },
  destino: { backgroundColor: colors.background, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 18, gap: 4 },
  rotulo: { fontFamily: fontFamily.semiBold, fontSize: 12, color: '#566070' },
  linha: { flexDirection: 'row', gap: 10 },
  entrada: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black, paddingVertical: 2 },
  data: { width: 120 },
  companhias: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: '#E1E6EE' },
  chipAtivo: { backgroundColor: colors.black, borderColor: colors.black },
  chipTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  chipTextoAtivo: { color: colors.white },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.background, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 16 },
  caixa: { width: 34, height: 34, borderRadius: 10, borderWidth: 2, borderColor: '#D5DAE2', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  caixaFeita: { backgroundColor: colors.black, borderColor: colors.black },
  itemTitulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  itemSub: { fontFamily: fontFamily.regular, fontSize: 13, color: '#566070' },
  regras: { backgroundColor: colors.primarySurface, borderRadius: 24, padding: 16, gap: 4 },
  regrasTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  regrasTexto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: '#2B3A4A' },
  regrasData: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.primaryDeep },
  regrasLink: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.primaryDeep, textDecorationLine: 'underline', marginTop: 2 },
  aviso: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: '#8A6414', backgroundColor: '#FFF0C9', borderRadius: 22, overflow: 'hidden', padding: 16 },
  pdf: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: 26, backgroundColor: colors.disabled },
  pdfTexto: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
})
