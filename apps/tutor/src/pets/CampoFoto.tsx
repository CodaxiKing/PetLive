import { Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'

export type AtivoFoto = { uri: string; mimeType?: string }

/** Abre a galeria ou a câmera (com recorte quadrado) e devolve a foto, ou null. */
export async function escolherFoto(origem: 'galeria' | 'camera'): Promise<AtivoFoto | null> {
  const permissao =
    origem === 'galeria'
      ? await ImagePicker.requestMediaLibraryPermissionsAsync()
      : await ImagePicker.requestCameraPermissionsAsync()
  if (!permissao.granted) {
    Alert.alert(
      'Permissão necessária',
      origem === 'galeria'
        ? 'Autorize o acesso às fotos nas configurações do aparelho.'
        : 'Autorize o acesso à câmera nas configurações do aparelho.',
    )
    return null
  }
  const opcoes: ImagePicker.ImagePickerOptions = { allowsEditing: true, aspect: [1, 1], quality: 0.85 }
  const resultado =
    origem === 'galeria'
      ? await ImagePicker.launchImageLibraryAsync({ ...opcoes, mediaTypes: ['images'] })
      : await ImagePicker.launchCameraAsync(opcoes)
  if (resultado.canceled) return null
  const ativo = resultado.assets[0]
  return ativo ? { uri: ativo.uri, mimeType: ativo.mimeType ?? undefined } : null
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
  Alert.alert('Foto do pet', 'A foto fica visível só para você, na ficha do pet.', [
    temFoto
      ? { text: 'Remover', style: 'destructive', onPress: () => onEscolher(null) }
      : { text: 'Cancelar', style: 'cancel' },
    { text: 'Galeria', onPress: escolher('galeria') },
    { text: 'Câmera', onPress: escolher('camera') },
  ])
}
