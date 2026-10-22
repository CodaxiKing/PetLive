import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { BotaoPrimario } from '../src/components/BotaoPrimario'
import { HeroiOnda } from '../src/components/HeroiOnda'
import { Icone } from '../src/components/Icone'
import type { MotivoPremium } from '../src/pets/limite'
import { usePets } from '../src/pets/PetsProvider'
import { colors } from '../src/theme/colors'
import { fontFamily } from '../src/theme/typography'

const VANTAGENS = [
  'Vários pets na mesma conta, todos editáveis',
  'PDF da carteira para o veterinário',
  'Anexos de exames sem limite',
  'Acesso compartilhado com a família',
]

/**
 * Convite Premium do limite de pets (BUSINESS.md 5.13 e 10): abre no lugar
 * do cadastro quando o grátis já tem 1 pet ativo, e em toda tentativa de
 * editar um pet que está só para consulta.
 */
export default function ConvitePremium() {
  const { motivo, pet: petId } = useLocalSearchParams<{ motivo?: MotivoPremium; pet?: string }>()
  const { pets } = usePets()
  const pet = pets.find((p) => p.id === petId) ?? null

  const titulo = motivo === 'somente_leitura' && pet ? `${pet.nome} está só para consulta` : 'Mais pets com o Premium'
  const explicacao =
    motivo === 'somente_leitura'
      ? 'No plano Grátis, só o pet ativo há mais tempo fica editável. Os outros continuam no app, com perfil, vacinas, histórico e carteirinha, só para consulta.'
      : 'No plano Grátis você tem 1 pet ativo, com todas as funções. Pets em memória não contam. Com o Premium, cadastre vários pets e edite todos.'

  return (
    <View style={estilos.tela}>
      <HeroiOnda fundo={colors.premiumSurface} subtitulo="Plano Grátis" titulo={titulo} altura={210} />
      <ScrollView style={estilos.flex} contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        <Text style={estilos.intro}>{explicacao}</Text>
        <Text style={estilos.secao}>No Premium</Text>
        {VANTAGENS.map((t) => (
          <View key={t} style={estilos.item}>
            <View style={estilos.check}>
              <Icone nome="check" size={16} cor={colors.primary} espessura={2.4} />
            </View>
            <Text style={estilos.itemTexto}>{t}</Text>
          </View>
        ))}
        <Text style={estilos.nota}>Nenhum pet é apagado por causa do limite.</Text>
      </ScrollView>
      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo="Conhecer o Premium"
          onPress={() => Alert.alert('Premium', 'O Premium chega na próxima fase do PetLive. Avisaremos você por aqui.')}
        />
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={estilos.agoraNao}>
          <Text style={estilos.agoraNaoTexto}>Agora não</Text>
        </Pressable>
      </View>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  intro: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24, color: '#5E6878' },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  check: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  itemTexto: { flex: 1, fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 21, color: colors.black },
  nota: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.premiumText, marginTop: 6 },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28, gap: 10 },
  agoraNao: { height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: '#E1E6EE', alignItems: 'center', justifyContent: 'center' },
  agoraNaoTexto: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
})
