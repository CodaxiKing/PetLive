import type { ComponentType } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { Tocavel } from '../components/Animacoes'
import { Icone } from '../components/Icone'
import { colors } from '../theme/colors'
import { fontFamily } from '../theme/typography'
import { abrirConvitePremium } from './convitePremium'
import { usePets } from './PetsProvider'
import type { Pet } from './types'

/**
 * Faixa do pet só para consulta (BUSINESS.md 5.13): avisa que ele está além
 * do limite do plano grátis e leva ao convite Premium.
 */
export function FaixaSomenteLeitura({ pet }: { pet: Pet }) {
  if (!pet.somente_leitura) return null
  return (
    <Tocavel
      accessibilityRole="button"
      accessibilityLabel={`${pet.nome} está só para consulta. Conhecer o Premium`}
      onPress={() => abrirConvitePremium('somente_leitura', pet.id)}
      style={estilos.faixa}
    >
      <View style={estilos.icone}>
        <Icone nome="documento" size={18} />
      </View>
      <View style={estilos.flex}>
        <Text style={estilos.titulo}>Só para consulta</Text>
        <Text style={estilos.texto}>No plano Grátis, 1 pet fica editável. Com o Premium, todos.</Text>
      </View>
      <Text style={estilos.seta}>›</Text>
    </Tocavel>
  )
}

/**
 * Telas que só editam (cadastro, vacina, remédio, consulta, marco, escala):
 * com o pet só para consulta, troca pela tela do convite Premium.
 */
export function somenteParaEditavel<P extends object>(Tela: ComponentType<P>) {
  function TelaEditavel(props: P) {
    const { id } = useLocalSearchParams<{ id: string }>()
    const { pets } = usePets()
    if (pets.find((p) => p.id === id)?.somente_leitura) {
      return <Redirect href={{ pathname: '/premium', params: { motivo: 'somente_leitura', pet: id } }} />
    }
    return <Tela {...props} />
  }
  return TelaEditavel
}

const estilos = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  faixa: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.premiumSurface, borderRadius: 26, padding: 12 },
  icone: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.premiumText },
  texto: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.premiumText },
  seta: { fontFamily: fontFamily.bold, fontSize: 24, color: colors.premiumText, paddingRight: 6 },
})
