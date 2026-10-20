import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { colors } from '../theme/colors'
import { spacing } from '../theme/tokens'
import { typography } from '../theme/typography'

export type AtivoFoto = { uri: string; mimeType?: string }

type Props = {
  /** URI local recém-escolhida ou URL pública já salva. */
  foto: string | null
  onEscolher: (ativo: AtivoFoto) => void
  onRemover?: () => void
}

/**
 * Seletor de foto do pet: galeria + câmera, com pré-visualização circular.
 * O envio para o Storage acontece na tela, junto com o salvamento do pet.
 */
export function CampoFoto({ foto, onEscolher, onRemover }: Props) {
  async function galeria() {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permissao.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso às fotos nas configurações do aparelho.')
      return
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    })
    if (resultado.canceled) return
    const ativo = resultado.assets[0]
    if (ativo) onEscolher({ uri: ativo.uri, mimeType: ativo.mimeType ?? undefined })
  }

  async function camera() {
    const permissao = await ImagePicker.requestCameraPermissionsAsync()
    if (!permissao.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso à câmera nas configurações do aparelho.')
      return
    }
    const resultado = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    })
    if (resultado.canceled) return
    const ativo = resultado.assets[0]
    if (ativo) onEscolher({ uri: ativo.uri, mimeType: ativo.mimeType ?? undefined })
  }

  return (
    <View style={estilos.bloco}>
      <Text style={estilos.rotulo}>Foto</Text>

      <View style={estilos.linha}>
        <View style={estilos.disco}>
          {foto ? (
            <Image source={{ uri: foto }} style={estilos.imagem} />
          ) : (
            <Text style={estilos.semFoto}>🐾</Text>
          )}
        </View>

        <View style={estilos.acoes}>
          <Pressable accessibilityRole="button" onPress={galeria} hitSlop={6} style={estilos.botao}>
            <Text style={estilos.botaoTexto}>Escolher da galeria</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={camera} hitSlop={6} style={estilos.botao}>
            <Text style={estilos.botaoTexto}>Tirar foto</Text>
          </Pressable>
          {foto && onRemover ? (
            <Pressable accessibilityRole="button" onPress={onRemover} hitSlop={6} style={estilos.botao}>
              <Text style={estilos.botaoRemover}>Remover foto</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Text style={estilos.ajuda}>Opcional. A foto fica visível só para você, na ficha do pet.</Text>
    </View>
  )
}

const estilos = StyleSheet.create({
  bloco: { gap: spacing.sm },
  rotulo: { ...typography.label, color: colors.text },
  linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  disco: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  imagem: { width: 96, height: 96 },
  semFoto: { fontSize: 34 },
  acoes: { flex: 1, gap: spacing.xs },
  botao: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  botaoTexto: { ...typography.captionMedium, color: colors.primaryDeep },
  botaoRemover: { ...typography.captionMedium, color: colors.danger },
  ajuda: { ...typography.small, color: colors.textMuted },
})
