import { Alert, Linking } from 'react-native'
import * as ImagePicker from 'expo-image-picker'

export type AtivoFoto = { uri: string; mimeType?: string; /** Bytes, quando o sistema informa. */ tamanho?: number }

/** Abre a galeria ou a câmera e devolve a foto, ou null. Recorte quadrado por padrão (foto do pet). */
export async function escolherFoto(origem: 'galeria' | 'camera', quadrado = true): Promise<AtivoFoto | null> {
  const permissao =
    origem === 'galeria'
      ? await ImagePicker.requestMediaLibraryPermissionsAsync()
      : await ImagePicker.requestCameraPermissionsAsync()
  if (!permissao.granted) {
    // Negada: explica o motivo e leva às configurações (o sistema não pergunta de novo).
    Alert.alert(
      'Permissão necessária',
      origem === 'galeria'
        ? 'Para escolher uma foto, o PetLive precisa de acesso às suas fotos. Autorize nas configurações do aparelho.'
        : 'Para tirar a foto, o PetLive precisa de acesso à câmera. Autorize nas configurações do aparelho.',
      [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Abrir configurações', onPress: () => Linking.openSettings().catch(() => undefined) },
      ],
    )
    return null
  }
  const opcoes: ImagePicker.ImagePickerOptions = quadrado ? { allowsEditing: true, aspect: [1, 1], quality: 0.85 } : { quality: 0.7 }
  const resultado =
    origem === 'galeria'
      ? await ImagePicker.launchImageLibraryAsync({ ...opcoes, mediaTypes: ['images'] })
      : await ImagePicker.launchCameraAsync(opcoes)
  if (resultado.canceled) return null
  const ativo = resultado.assets[0]
  return ativo ? { uri: ativo.uri, mimeType: ativo.mimeType ?? undefined, tamanho: ativo.fileSize ?? undefined } : null
}

/**
 * Botão da câmera do herói do pet: pergunta galeria ou câmera (e remover,
 * quando já há foto). A foto só sobe para o Storage ao salvar o pet.
 */
export function pedirFoto(onEscolher: (ativo: AtivoFoto | null) => void, temFoto: boolean) {
  const escolher = (origem: 'galeria' | 'camera') => () => {
    escolherFoto(origem).then((ativo) => {
      if (ativo) onEscolher(ativo)
    })
  }
  Alert.alert('Foto do pet', 'A foto aparece na ficha do pet e na carteirinha que você compartilhar.', [
    temFoto
      ? { text: 'Remover', style: 'destructive', onPress: () => onEscolher(null) }
      : { text: 'Cancelar', style: 'cancel' },
    { text: 'Galeria', onPress: escolher('galeria') },
    { text: 'Câmera', onPress: escolher('camera') },
  ])
}
