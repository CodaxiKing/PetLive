import * as ImagePicker from 'expo-image-picker';

export async function escolherFotoPasseio(origem: 'camera' | 'galeria') {
  if (origem === 'camera') {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) throw new Error('Autorize a câmera nas configurações para tirar a foto. Você também pode escolher da galeria.');
  }
  const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.6, exif: false };
  const resultado = origem === 'camera' ? await ImagePicker.launchCameraAsync(opcoes) : await ImagePicker.launchImageLibraryAsync(opcoes);
  if (resultado.canceled) return null;
  const foto = resultado.assets[0];
  if (!foto || foto.type === 'video') throw new Error('Escolha uma imagem para o passeio.');
  if (foto.fileSize && foto.fileSize > 5 * 1024 * 1024) throw new Error('Escolha uma foto de até 5 MB. Tente recortar ou escolher outra.');
  return foto.uri;
}
