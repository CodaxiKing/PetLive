import type { Pet } from './types';
import type { Selo } from './selos';

/** Somente os campos que podem aparecer na imagem compartilhada. */
export function dadosCartaoPet(pet: Pet, selos: Iterable<Selo>) {
  return {
    nome: pet.nome.trim() || 'Meu pet',
    especie: pet.especie === 'gato' ? 'Gato' : 'Cão',
    raca: pet.raca?.trim() || 'Raça não informada',
    foto: pet.foto_url,
    emMemoria: Boolean(pet.em_memoria),
    selos: pet.em_memoria ? [] : [...new Set(selos)],
  };
}

export type DadosCartaoPet = ReturnType<typeof dadosCartaoPet>;
