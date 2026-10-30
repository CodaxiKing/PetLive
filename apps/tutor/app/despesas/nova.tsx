import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../../src/auth/AuthProvider'
import { Tocavel } from '../../src/components/Animacoes'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { Campo } from '../../src/components/Campo'
import { HeroiOnda } from '../../src/components/HeroiOnda'
import { Icone } from '../../src/components/Icone'
import {
  apagarDespesa,
  carregarDespesa,
  CATEGORIAS,
  enviarRecibo,
  reais,
  salvarDespesa,
  urlRecibo,
  type Categoria,
  type Despesa,
} from '../../src/despesas/despesas'
import { mensagemDeErro } from '../../src/lib/cacheOffline'
import { escolherFoto, type AtivoFoto } from '../../src/pets/CampoFoto'
import { usePets } from '../../src/pets/PetsProvider'
import { dataParaExibicao, dataParaIso, hojeComoCampo } from '../../src/saude/types'
import { colors } from '../../src/theme/colors'
import { fontFamily } from '../../src/theme/typography'

/** Só dígitos -> centavos: "1990" = R$ 19,90 (o teclado numérico vai preenchendo). */
function centavosDe(texto: string): number {
  return Number(texto.replace(/\D/g, '').slice(0, 9) || '0')
}

/**
 * Nova despesa (protótipo NovaDespesa): categoria, valor, data, pet (ou
 * todos), anotação e foto do recibo opcional. Com ?id= edita e permite apagar.
 */
export default function TelaNovaDespesa() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const { user } = useAuth()
  const { pets, petAtivo } = usePets()
  const [categoria, setCategoria] = useState<Categoria>('racao')
  const [centavos, setCentavos] = useState(0)
  const [data, setData] = useState(hojeComoCampo())
  const [petId, setPetId] = useState<string | null>(pets.length > 1 ? null : (petAtivo?.id ?? null))
  const [anotacao, setAnotacao] = useState('')
  const [recibo, setRecibo] = useState<AtivoFoto | null>(null)
  const [reciboSalvo, setReciboSalvo] = useState<{ path: string; url: string | null } | null>(null)
  const [original, setOriginal] = useState<Despesa | null>(null)
  const [carregando, setCarregando] = useState(Boolean(id))
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!id) return
    carregarDespesa(id)
      .then(async (d) => {
        if (!d) return
        setOriginal(d)
        setCategoria(d.categoria)
        setCentavos(d.valor_centavos)
        setData(dataParaExibicao(d.data))
        setPetId(d.pet_id)
        setAnotacao(d.anotacao ?? '')
        if (d.recibo_path) setReciboSalvo({ path: d.recibo_path, url: await urlRecibo(d.recibo_path) })
      })
      .catch(() => undefined)
      .finally(() => setCarregando(false))
  }, [id])

  function pedirRecibo() {
    const escolher = (origem: 'galeria' | 'camera') => () => {
      escolherFoto(origem, false).then((foto) => foto && setRecibo(foto))
    }
    Alert.alert('Foto do recibo', 'Fica guardada só na sua conta.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Galeria', onPress: escolher('galeria') },
      { text: 'Câmera', onPress: escolher('camera') },
    ])
  }

  async function salvar() {
    if (!user) return
    const dataIso = dataParaIso(data)
    if (!dataIso) {
      Alert.alert('Falta a data', 'Informe a data da despesa (DD/MM/AAAA).')
      return
    }
    if (centavos <= 0) {
      Alert.alert('Falta o valor', 'Quanto foi a despesa?')
      return
    }
    setSalvando(true)
    try {
      let caminho = reciboSalvo?.path ?? null
      if (recibo) caminho = await enviarRecibo(user.id, recibo.uri, recibo.mimeType)
      await salvarDespesa(id ?? null, {
        categoria,
        valor_centavos: centavos,
        data: dataIso,
        pet_id: petId,
        anotacao: anotacao.trim() || null,
        recibo_path: caminho,
      })
      router.back()
    } catch (e) {
      Alert.alert('Não deu para salvar', mensagemDeErro(e instanceof Error ? e.message : String(e)))
    } finally {
      setSalvando(false)
    }
  }

  function apagar() {
    if (!original) return
    Alert.alert('Apagar esta despesa?', `${reais(original.valor_centavos)} em ${dataParaExibicao(original.data)}.`, [
      { text: 'Manter', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () => apagarDespesa(original).then(() => router.back(), (e) => Alert.alert('Não deu para apagar', String(e))),
      },
    ])
  }

  if (carregando) {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        <ActivityIndicator color={colors.primaryDeep} />
      </View>
    )
  }

  const fotoMostrada = recibo?.uri ?? reciboSalvo?.url ?? null

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo="Despesas" titulo={id ? 'Editar despesa' : 'Nova despesa'} altura={200} />
      <ScrollView style={estilos.flex} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={estilos.chips}>
          {CATEGORIAS.map((c) => (
            <Tocavel
              key={c.valor}
              accessibilityRole="radio"
              accessibilityState={{ selected: categoria === c.valor }}
              onPress={() => setCategoria(c.valor)}
              style={[estilos.chip, categoria === c.valor && { backgroundColor: c.cor, borderColor: c.cor }]}
            >
              <Text style={estilos.chipTexto}>{c.rotulo}</Text>
            </Tocavel>
          ))}
        </View>

        <View style={estilos.valor}>
          <Text style={estilos.valorRotulo}>Valor</Text>
          <TextInput
            value={centavos ? reais(centavos) : ''}
            onChangeText={(t) => setCentavos(centavosDe(t))}
            placeholder="R$ 0,00"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            accessibilityLabel="Valor da despesa"
            style={estilos.valorTexto}
          />
        </View>

        <Campo rotulo="Data" mascara="data" placeholder="DD/MM/AAAA" value={data} onChangeText={setData} maxLength={10} />

        <View style={estilos.campoPets}>
          <Text style={estilos.valorRotulo}>Pet</Text>
          <View style={estilos.chips}>
            {pets.length > 1 ? (
              <Tocavel accessibilityRole="radio" accessibilityState={{ selected: petId === null }} onPress={() => setPetId(null)} style={[estilos.chipPet, petId === null && estilos.chipPetAtivo]}>
                <Text style={[estilos.chipTexto, petId === null && estilos.chipTextoAtivo]}>Todos</Text>
              </Tocavel>
            ) : null}
            {pets.map((p) => (
              <Tocavel key={p.id} accessibilityRole="radio" accessibilityState={{ selected: petId === p.id }} onPress={() => setPetId(p.id)} style={[estilos.chipPet, petId === p.id && estilos.chipPetAtivo]}>
                <Text style={[estilos.chipTexto, petId === p.id && estilos.chipTextoAtivo]}>{p.nome}</Text>
              </Tocavel>
            ))}
          </View>
        </View>

        <Campo rotulo="Anotação" placeholder="Ex.: ração adulto 10 kg" value={anotacao} onChangeText={setAnotacao} maxLength={200} />

        <Tocavel accessibilityRole="button" onPress={pedirRecibo} style={estilos.recibo}>
          <View style={estilos.reciboIcone}>
            {fotoMostrada ? <Image source={{ uri: fotoMostrada }} style={estilos.reciboFoto} /> : <Icone nome="documento" size={22} />}
          </View>
          <Text style={estilos.reciboTexto}>{fotoMostrada ? 'Trocar a foto do recibo' : 'Foto do recibo (opcional)'}</Text>
        </Tocavel>

        {original ? (
          <Tocavel accessibilityRole="button" onPress={apagar} style={estilos.apagar}>
            <Text style={estilos.apagarTexto}>Apagar despesa</Text>
          </Tocavel>
        ) : null}
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Salvar despesa" carregando={salvando} onPress={salvar} />
      </View>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  centro: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: '#E1E6EE', backgroundColor: colors.white },
  chipTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  chipTextoAtivo: { color: colors.white },
  valor: { backgroundColor: colors.surface, borderRadius: 28, paddingVertical: 14, paddingHorizontal: 20 },
  valorRotulo: { fontFamily: fontFamily.semiBold, fontSize: 12, color: '#566070' },
  valorTexto: { fontFamily: fontFamily.bold, fontSize: 40, letterSpacing: -1, color: colors.black, paddingVertical: 2 },
  campoPets: { backgroundColor: colors.surface, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 16, gap: 8 },
  chipPet: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.white },
  chipPetAtivo: { backgroundColor: colors.black },
  recibo: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  reciboIcone: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  reciboFoto: { width: 64, height: 64 },
  reciboTexto: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  apagar: { alignSelf: 'flex-start', paddingVertical: 8 },
  apagarTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: '#B3173A' },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
})
