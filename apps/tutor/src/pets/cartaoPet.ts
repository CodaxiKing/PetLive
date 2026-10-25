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

export const TEMAS_CARTAO = [
  { id: 'azul', nome: 'Céu', fundo: '#E0F1FA', tinta: '#163E56', detalhe: '#FFFFFF' },
  { id: 'verde', nome: 'Jardim', fundo: '#D8F2E3', tinta: '#194A36', detalhe: '#FFFFFF' },
  { id: 'lilas', nome: 'Lavanda', fundo: '#EADCFB', tinta: '#482B69', detalhe: '#FFFFFF' },
  { id: 'rosa', nome: 'Carinho', fundo: '#FDE0E6', tinta: '#702B4B', detalhe: '#FFFFFF' },
  { id: 'areia', nome: 'Sol', fundo: '#FFF0C9', tinta: '#614515', detalhe: '#FFFFFF' },
] as const;

export type TemaCartao = typeof TEMAS_CARTAO[number]['id'];
export type FormatoCartao = 'post' | 'stories';
export const FORMATOS_CARTAO = {
  post: { nome: 'Post', largura: 1080, altura: 1080 },
  stories: { nome: 'Stories', largura: 1080, altura: 1920 },
} as const;

/** O plano deve estar confirmado pela consulta atual; grátis tem o tema Céu. */
export function temaCartaoPermitido(tema: TemaCartao, premiumConfirmado: boolean) {
  return TEMAS_CARTAO.find((opcao) => opcao.id === (premiumConfirmado ? tema : 'azul')) ?? TEMAS_CARTAO[0];
}

/** Convite genérico: não herda códigos de acesso, parâmetros ou IDs da conta. */
export function conviteCartao(site: string | undefined): string | null {
  try {
    const url = new URL(site?.trim() || '');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return `${url.origin}/?utm_source=cartao_pet&utm_medium=compartilhamento`;
  } catch { return null; }
}

/** View-shot 6.1.1: Android redimensiona em pixels; iOS usa o renderer na escala da tela. */
export function dimensoesCapturaCartao(formato: FormatoCartao, plataforma: string, densidade: number) {
  const escala = plataforma === 'ios' && Number.isFinite(densidade) && densidade > 0 ? densidade : 1;
  const { largura, altura } = FORMATOS_CARTAO[formato];
  return { width: largura / escala, height: altura / escala };
}
