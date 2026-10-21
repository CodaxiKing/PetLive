import type { Pet } from './types'

/** Cores dos cartões de pet do protótipo (Meus pets, Perfil, Início). */
export type CoresPet = { fundo: string; borda: string; texto: string }

const PALETA: CoresPet[] = [
  { fundo: '#EBDDFB', borda: '#D7BDF5', texto: '#5B3C8F' },
  { fundo: '#FCE1EF', borda: '#F5BFD9', texto: '#8A2E5C' },
  { fundo: '#E0F1FA', borda: '#B9DFF3', texto: '#1D5F86' },
  { fundo: '#DDF3E6', borda: '#BCE5CC', texto: '#25683F' },
  { fundo: '#FFF1C9', borda: '#F5DE9A', texto: '#7A5F0A' },
]

/**
 * Cor do pet: a etiqueta escolhida no cadastro, quando bate com a paleta;
 * senão alterna pela posição na lista (o 1º roxo, o 2º rosa...).
 */
export function coresDoPet(pet: Pick<Pet, 'cor_etiqueta'>, indice: number): CoresPet {
  const daEtiqueta = PALETA.find((c) => c.fundo.toLowerCase() === pet.cor_etiqueta?.toLowerCase())
  return daEtiqueta ?? PALETA[indice % PALETA.length]
}
