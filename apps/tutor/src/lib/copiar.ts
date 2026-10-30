import { requireOptionalNativeModule } from 'expo'
import { Share } from 'react-native'

/**
 * Copia o texto (código Pix copia e cola) com expo-clipboard. O módulo é
 * nativo: num app instalado antes dele (atualização pelo ar), abre o menu de
 * compartilhar do sistema, que também tem "Copiar", em vez de fechar o app.
 */
export async function copiarTexto(texto: string): Promise<'copiado' | 'compartilhado'> {
  // Confere antes de carregar: em desenvolvimento, um require que falha vira
  // erro na tela mesmo dentro do try.
  if (requireOptionalNativeModule('ExpoClipboard')) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard')
      await Clipboard.setStringAsync(texto)
      return 'copiado'
    } catch {
      // Cai para o compartilhar.
    }
  }
  await Share.share({ message: texto }).catch(() => undefined)
  return 'compartilhado'
}
