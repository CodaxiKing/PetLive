import type { Pet } from './types'

/** Cores dos cartões de pet do protótipo (Meus pets, Perfil, Início). */
export type CoresPet = { fundo: string; borda: string; texto: string }

const PALETA: CoresPet[] = [
  { fundo: '#EADCFB', borda: '#D7BDF5', texto: '#5B3E8A' },
  { fundo: '#FDE0E6', borda: '#F5BFD9', texto: '#A3324F' },
  { fundo: '#E0F1FA', borda: '#B9DFF3', texto: '#1A5577' },
  { fundo: '#D8F2E3', borda: '#BCE5CC', texto: '#1F6B45' },
  { fundo: '#FFF0C9', borda: '#F5DE9A', texto: '#8A6414' },
]

/**
 * Cor do pet: a etiqueta escolhida no cadastro, quando bate com a paleta;
 * senão alterna pela posição na lista (o 1º roxo, o 2º rosa...).
 */
export function coresDoPet(pet: Pick<Pet, 'cor_etiqueta'>, indice: number): CoresPet {
  const daEtiqueta = PALETA.find((c) => c.fundo.toLowerCase() === pet.cor_etiqueta?.toLowerCase())
  return daEtiqueta ?? PALETA[indice % PALETA.length]
}
