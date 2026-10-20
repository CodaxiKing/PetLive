import { Image, StyleSheet, View } from 'react-native'
import { Mascote } from '../components/Mascote'
import { colors } from '../theme/colors'
import type { Especie } from './types'

type Props = {
  especie: Especie
  /** `foto_url` do pet; sem foto cai no mascote da espécie. */
  foto?: string | null
  size?: number
}

/** Avatar circular do pet: foto quando existe, senão o mascote. */
export function AvatarPet({ especie, foto, size = 52 }: Props) {
  const estilo = { width: size, height: size, borderRadius: size / 2 }
  return (
    <View style={[estilos.caixa, estilo]}>
      {foto ? (
        <Image source={{ uri: foto }} style={estilo} accessibilityLabel="Foto do pet" />
      ) : (
        <Mascote especie={especie} size={size} recorte />
      )}
    </View>
  )
}

const estilos = StyleSheet.create({
  caixa: {
    overflow: 'hidden',
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
})
