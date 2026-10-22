/**
 * Máscaras dos campos: o tutor digita só os números e a barra, o parêntese e
 * o hífen entram sozinhos. Apagar continua natural (a máscara é refeita a
 * partir dos dígitos que sobraram).
 */
export type Mascara = 'data' | 'telefone' | 'hora'

const digitos = (texto: string) => texto.replace(/\D/g, '')

/** "12032024" -> "12/03/2024". */
export function mascaraData(texto: string): string {
  const d = digitos(texto).slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

/** "21998765432" -> "(21) 99876-5432"; fixo com 10 dígitos -> "(21) 3333-4444". */
export function mascaraTelefone(texto: string): string {
  let d = digitos(texto)
  // Colado com o +55 na frente: tira o código do país.
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2)
  d = d.slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  const ddd = d.slice(0, 2)
  const resto = d.slice(2)
  if (resto.length <= 4) return `(${ddd}) ${resto}`
  const meio = resto.length === 9 ? 5 : 4
  return `(${ddd}) ${resto.slice(0, meio)}-${resto.slice(meio)}`
}

/** "0930" -> "09:30". */
export function mascaraHora(texto: string): string {
  const d = digitos(texto).slice(0, 4)
  if (d.length <= 2) return d
  return `${d.slice(0, 2)}:${d.slice(2)}`
}

export function aplicarMascara(mascara: Mascara, texto: string): string {
  if (mascara === 'data') return mascaraData(texto)
  if (mascara === 'telefone') return mascaraTelefone(texto)
  return mascaraHora(texto)
}

/** Celular ou fixo brasileiro completo (10 ou 11 dígitos com DDD). */
export function telefoneValido(texto: string): boolean {
  const d = digitos(texto)
  return d.length === 10 || (d.length === 11 && d[2] === '9')
}

export const TAMANHO_MASCARA: Record<Mascara, number> = { data: 10, telefone: 15, hora: 5 }
