import { requireOptionalNativeModule } from 'expo'

/**
 * PDF pelo menu de imprimir do sistema ("Salvar como PDF"), com expo-print.
 * O módulo é nativo: em um app instalado antes dele (atualização pelo ar),
 * o require falha e devolvemos 'sem-modulo' para a tela pedir a atualização
 * da loja, em vez de fechar o app.
 */
export async function abrirPdf(html: string): Promise<'ok' | 'sem-modulo'> {
  // Confere antes de carregar: em desenvolvimento, um require que falha vira
  // erro na tela mesmo dentro do try.
  if (!requireOptionalNativeModule('ExpoPrint')) return 'sem-modulo'
  let Print: typeof import('expo-print')
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Print = require('expo-print') as typeof import('expo-print')
  } catch {
    return 'sem-modulo'
  }
  try {
    await Print.printAsync({ html })
    return 'ok'
  } catch (e) {
    if (e instanceof Error && /native module|ExpoPrint/i.test(e.message)) return 'sem-modulo'
    throw e
  }
}

/** Texto seguro para entrar no HTML do PDF. */
export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
