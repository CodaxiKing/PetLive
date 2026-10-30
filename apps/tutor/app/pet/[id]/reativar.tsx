import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { Icone } from '../../../src/components/Icone'
import { reativarPet } from '../../../src/pets/memorial'
import { usePets } from '../../../src/pets/PetsProvider'
import { colors } from '../../../src/theme/colors'
import { fontFamily } from '../../../src/theme/typography'

/** Reativar o pet (protótipo ReativarPet): diz o que volta e o que não volta. */
export default function TelaReativar() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { petsMemoria, recarregar } = usePets()
  const pet = petsMemoria.find((p) => p.id === id) ?? null
  const [salvando, setSalvando] = useState(false)

  if (!pet) return <View style={estilos.tela} />
  const o = pet.sexo === 'femea' ? 'a' : 'o'
  const nome = pet.nome

  async function reativar() {
    if (!pet) return
    setSalvando(true)
    try {
      await reativarPet(pet.id)
      await recarregar()
      router.dismissAll()
      router.push({ pathname: '/pet/[id]', params: { id: pet.id } })
    } catch (e) {
      Alert.alert('Não deu para reativar', e instanceof Error ? e.message : String(e))
    } finally {
      setSalvando(false)
    }
  }

  const volta = [
    `${o === 'a' ? 'A' : 'O'} ${nome} volta para a lista de pets ativos`,
    'Os lembretes e avisos voltam a funcionar, a partir de agora',
    'Os remédios em tratamento voltam para o dia a dia',
    'Fotos e linha do tempo continuam como estão',
  ]
  const naoVolta = [
    'Lembretes que passaram durante a pausa não são refeitos',
    'Links da carteirinha e acessos de cuidador encerrados não reabrem',
  ]

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo={nome} titulo={`Reativar ${o} ${nome}`} />
      <ScrollView style={estilos.flex} contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        <Text style={estilos.intro}>
          Se você registrou por engano, está tudo certo. Ao reativar, {o} {nome} volta para o app como antes.
        </Text>
        <Text style={estilos.secao}>O que volta</Text>
        {volta.map((t) => (
          <View key={t} style={estilos.item}>
            <View style={estilos.check}>
              <Icone nome="check" size={16} cor={colors.primary} espessura={2.4} />
            </View>
            <Text style={estilos.itemTexto}>{t}</Text>
          </View>
        ))}
        <Text style={estilos.secao}>O que não volta</Text>
        {naoVolta.map((t) => (
          <View key={t} style={estilos.item}>
            <View style={[estilos.check, estilos.traco]}>
              <Text style={estilos.tracoTexto}>–</Text>
            </View>
            <Text style={estilos.itemTexto}>{t}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={estilos.rodape}>
        <BotaoPrimario titulo={`Reativar ${o} ${nome}`} carregando={salvando} onPress={reativar} />
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={estilos.manter}>
          <Text style={estilos.manterTexto}>Manter em memória</Text>
        </Pressable>
      </View>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  intro: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24, color: '#566070' },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  check: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  traco: { backgroundColor: colors.surface, borderRadius: 17 },
  tracoTexto: { fontFamily: fontFamily.bold, fontSize: 18, color: '#566070' },
  itemTexto: { flex: 1, fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 21, color: colors.black },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28, gap: 10 },
  manter: { height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: '#E1E6EE', alignItems: 'center', justifyContent: 'center' },
  manterTexto: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
})
