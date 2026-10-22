import { Linking, Share } from 'react-native'
import { urlFicha, type Secao } from './linkCarteirinha'
import { idadeEmAnos, type Pet } from './types'

/**
 * Ficha de emergência (BUSINESS.md 5.37): o mesmo link da carteirinha, com
 * o tipo 'emergencia'. Os dados do pet sempre vão; o resto o tutor escolhe.
 */
export type ItemFicha = { chave: string; titulo: string; secoes: Secao[]; chip: string }

export const ITENS_FICHA: ItemFicha[] = [
  { chave: 'alergias', titulo: 'Alergias e condições', secoes: ['alergias'], chip: 'Alergias' },
  { chave: 'remedios', titulo: 'Remédios em uso', secoes: ['remedios'], chip: 'Remédios' },
  { chave: 'vacinas', titulo: 'Vacinas e vermífugo', secoes: ['vacinas'], chip: 'Vacinas' },
  { chave: 'contato', titulo: 'Veterinário habitual e meu telefone', secoes: ['veterinario', 'telefone'], chip: 'Contato' },
]

export function secoesFicha(ligados: Set<string>): Secao[] {
  return ['dados', ...ITENS_FICHA.filter((i) => ligados.has(i.chave)).flatMap((i) => i.secoes)]
}

/** "Rex · cão, labrador · 28 kg". */
export function resumoPet(pet: Pet): string {
  const especie = pet.especie === 'gato' ? 'gato' : 'cão'
  const raca = pet.raca ? `, ${pet.raca.toLowerCase()}` : ''
  const peso = pet.peso_atual ? ` · ${String(pet.peso_atual).replace('.', ',')} kg` : ''
  return `${pet.nome} · ${especie}${raca}${peso}`
}

export function idadePeso(pet: Pet): string {
  return [idadeEmAnos(pet.nascimento), pet.peso_atual ? `${String(pet.peso_atual).replace('.', ',')} kg` : null]
    .filter(Boolean)
    .join(' · ')
}

/** Mensagem do protótipo EnviarFichaClinica. */
export function mensagemFicha(pet: Pet, codigo: string, horas: number): string {
  const especie = pet.especie === 'gato' ? 'gato' : 'cão'
  const detalhes = [especie, pet.raca?.toLowerCase(), pet.peso_atual ? `${String(pet.peso_atual).replace('.', ',')} kg` : null]
    .filter(Boolean)
    .join(', ')
  const artigo = pet.sexo === 'femea' ? 'a' : 'o'
  return `Olá! Estou a caminho com ${artigo} ${pet.nome} (${detalhes}). Segue a ficha de emergência: ${urlFicha(codigo)} (vale por ${horas} h).`
}

/** Celular brasileiro: DDD + 9 + 8 dígitos (com ou sem o 55). */
export function ehCelular(telefone: string): boolean {
  const d = telefone.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').replace(/^0/, '')
  return d.length === 11 && d[2] === '9'
}

/** Abre a conversa do WhatsApp já com a mensagem; sem número, o tutor escolhe o contato. */
export async function abrirWhatsAppComTexto(texto: string, telefone?: string | null): Promise<void> {
  const numero = telefone ? telefone.replace(/\D/g, '').replace(/^(?!55)/, '55') : null
  const texto64 = encodeURIComponent(texto)
  try {
    await Linking.openURL(numero ? `whatsapp://send?phone=${numero}&text=${texto64}` : `whatsapp://send?text=${texto64}`)
  } catch {
    if (numero) {
      await Linking.openURL(`https://wa.me/${numero}?text=${texto64}`).catch(() => undefined)
    } else {
      // Sem WhatsApp no aparelho: menu de compartilhar do sistema.
      await Share.share({ message: texto }).catch(() => undefined)
    }
  }
}
