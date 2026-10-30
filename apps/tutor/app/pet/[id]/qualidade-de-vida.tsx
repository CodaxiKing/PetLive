import { useCallback, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Tocavel } from '../../../src/components/Animacoes'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { Icone } from '../../../src/components/Icone'
import { mensagemDeErro } from '../../../src/lib/cacheOffline'
import { abrirPdf } from '../../../src/lib/pdf'
import { usePlano } from '../../../src/lib/plano'
import { carregarItensEscala } from '../../../src/pets/conteudoCuidado'
import { usePets } from '../../../src/pets/PetsProvider'
import { AVISO_ESCALA, carregarEscala, htmlResumo, ITENS_ESCALA, salvarEscala, type ItemEscala, type RegistroEscala } from '../../../src/pets/senior'
import { idadeEmAnos } from '../../../src/pets/types'
import { colors } from '../../../src/theme/colors'
import { fontFamily } from '../../../src/theme/typography'

type Notas = Record<ItemEscala, number>
const INICIAL = Object.fromEntries(ITENS_ESCALA.map((i) => [i.chave, 5])) as Notas

/** Barra de 0 a 10: toque na posição escolhe a nota (e o leitor de tela ajusta de 1 em 1). */
function Barra({ rotulo, ajuda, valor, onMudar }: { rotulo: string; ajuda: string; valor: number; onMudar: (v: number) => void }) {
  const [largura, setLargura] = useState(1)
  return (
    <View style={estilos.item}>
      <View style={estilos.itemTopo}>
        <Text style={estilos.itemRotulo}>{rotulo}</Text>
        <Text style={estilos.itemValor}>{valor}/10</Text>
      </View>
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel={`${rotulo}: ${ajuda}`}
        accessibilityValue={{ min: 0, max: 10, now: valor }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onMudar(Math.max(0, Math.min(10, valor + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}
        onLayout={(e) => setLargura(e.nativeEvent.layout.width || 1)}
        onPress={(e) => onMudar(Math.max(0, Math.min(10, Math.round((e.nativeEvent.locationX / largura) * 10))))}
        hitSlop={{ top: 10, bottom: 10 }}
        style={estilos.trilho}
      >
        <View style={[estilos.preenchido, { width: `${valor * 10}%` }]} />
      </Pressable>
      <Text style={estilos.ajuda}>{ajuda}</Text>
    </View>
  )
}

/**
 * Qualidade de vida (protótipo QualidadeVida): 7 itens de 0 a 10, total de
 * 70, histórico e resumo em PDF para o veterinário (Premium). Sempre com o
 * aviso de que a escala não faz diagnóstico nem decide pelo tutor.
 */
export default function TelaQualidadeVida() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pets } = usePets()
  const plano = usePlano()
  const pet = pets.find((p) => p.id === id) ?? null
  const [notas, setNotas] = useState<Notas>(INICIAL)
  const [observacao, setObservacao] = useState('')
  const [historico, setHistorico] = useState<RegistroEscala[]>([])
  const [salvando, setSalvando] = useState(false)
  const [itens, setItens] = useState(ITENS_ESCALA)

  useFocusEffect(
    useCallback(() => {
      if (!id) return
      // Textos revisados no conteúdo mestre; sem resposta, ficam os embutidos.
      carregarItensEscala().then(setItens, () => undefined)
      carregarEscala(id).then((lista) => {
        setHistorico(lista)
        // Começa da última resposta: o tutor muda só o que mudou.
        if (lista[0]) setNotas(lista[0].notas)
      }, () => undefined)
    }, [id]),
  )

  if (!pet) return <View style={estilos.tela} />
  const total = Object.values(notas).reduce((s, n) => s + n, 0)

  async function salvar() {
    if (!pet) return
    setSalvando(true)
    try {
      await salvarEscala(pet.id, notas, observacao)
      setObservacao('')
      setHistorico(await carregarEscala(pet.id))
      Alert.alert('Respostas guardadas', AVISO_ESCALA)
    } catch (e) {
      Alert.alert('Não deu para salvar', mensagemDeErro(e instanceof Error ? e.message : String(e)))
    } finally {
      setSalvando(false)
    }
  }

  async function resumo() {
    if (!pet) return
    if (plano !== 'premium') {
      Alert.alert('Resumo para o veterinário', 'O resumo em PDF faz parte do Premium. As respostas e o histórico continuam aqui, no plano grátis.')
      return
    }
    if (historico.length === 0) {
      Alert.alert('Ainda sem respostas', 'Salve as respostas de hoje para gerar o resumo.')
      return
    }
    const r = await abrirPdf(htmlResumo(pet, historico, idadeEmAnos(pet.nascimento))).catch(() => 'erro' as const)
    if (r === 'sem-modulo') Alert.alert('Atualize o app', 'O resumo em PDF precisa da versão mais nova do PetLive na loja de apps.')
    if (r === 'erro') Alert.alert('Não deu para gerar o resumo', 'Tente de novo em instantes.')
  }

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo={pet.nome} titulo="Qualidade de vida" altura={200} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {itens.map((i) => (
          <Barra key={i.chave} rotulo={i.rotulo} ajuda={i.pergunta} valor={notas[i.chave]} onMudar={(v) => setNotas((n) => ({ ...n, [i.chave]: v }))} />
        ))}

        <View style={estilos.total}>
          <Text style={estilos.totalRotulo}>Pontuação de hoje</Text>
          <Text style={estilos.totalValor}>{total} de 70</Text>
          <Text style={estilos.totalAviso}>{AVISO_ESCALA}</Text>
        </View>

        <TextInput
          value={observacao}
          onChangeText={setObservacao}
          placeholder="Observação (opcional): o que mudou desde a última vez?"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Observação"
          multiline
          maxLength={300}
          style={estilos.observacao}
        />

        {historico.length > 0 ? (
          <>
            <Text style={estilos.secao}>Respostas anteriores</Text>
            {historico.slice(0, 12).map((r) => (
              <View key={r.id} style={estilos.registro}>
                <Text style={estilos.registroData}>{`${r.data.slice(8, 10)}/${r.data.slice(5, 7)}/${r.data.slice(2, 4)}`}</Text>
                <View style={estilos.registroTrilho}>
                  <View style={[estilos.registroBarra, { width: `${(r.total / 70) * 100}%` }]} />
                </View>
                <Text style={estilos.registroTotal}>{r.total}</Text>
              </View>
            ))}
          </>
        ) : null}

        <Tocavel accessibilityRole="button" onPress={resumo} style={estilos.resumo}>
          <Icone nome="documento" size={20} />
          <Text style={estilos.resumoTexto}>Gerar resumo para o veterinário{plano === 'premium' ? '' : ' · Premium'}</Text>
        </Tocavel>
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Salvar respostas de hoje" carregando={salvando} onPress={salvar} />
      </View>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 10 },
  item: { backgroundColor: colors.background, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 18, gap: 8 },
  itemTopo: { flexDirection: 'row', justifyContent: 'space-between' },
  itemRotulo: { fontFamily: fontFamily.semiBold, fontSize: 16, color: colors.black },
  itemValor: { fontFamily: fontFamily.semiBold, fontSize: 16, color: colors.black },
  trilho: { height: 14, borderRadius: 7, backgroundColor: '#E1E6EE', overflow: 'hidden', justifyContent: 'center' },
  preenchido: { height: 14, borderRadius: 7, backgroundColor: colors.primary },
  ajuda: { fontFamily: fontFamily.regular, fontSize: 11, color: '#566070' },
  total: { backgroundColor: colors.primarySurface, borderRadius: 28, paddingVertical: 18, paddingHorizontal: 22, gap: 2 },
  totalRotulo: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.primaryDeep },
  totalValor: { fontFamily: fontFamily.bold, fontSize: 38, letterSpacing: -1, color: colors.black },
  totalAviso: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: colors.primaryDeep },
  observacao: { backgroundColor: colors.background, borderRadius: 22, padding: 16, minHeight: 70, fontFamily: fontFamily.medium, fontSize: 14, color: colors.black },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 6 },
  registro: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  registroData: { width: 70, fontFamily: fontFamily.semiBold, fontSize: 13, color: '#566070' },
  registroTrilho: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#E1E6EE', overflow: 'hidden' },
  registroBarra: { height: 10, borderRadius: 5, backgroundColor: colors.premiumText },
  registroTotal: { width: 28, textAlign: 'right', fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  resumo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 54, borderRadius: 27, backgroundColor: colors.disabled, marginTop: 6 },
  resumoTexto: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
})
