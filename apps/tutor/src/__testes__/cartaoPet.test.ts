import { describe, expect, it } from 'vitest';
import { dadosCartaoPet } from '../pets/cartaoPet';
import type { Pet } from '../pets/types';

const pet: Pet = {
  id: 'pet-privado', tutor_id: 'tutor-privado', nome: ' Mia ', especie: 'gato', raca: ' Siamês ',
  foto_url: 'https://example.invalid/mia.jpg', nascimento: '2020-01-01', sexo: 'femea', peso_atual: 4,
  castrado: true, cor_etiqueta: null, ativo: true, criado_em: '2026-01-01',
  alergias: 'Informação privada', veterinario: 'Contato privado', observacoes: 'Anotações privadas',
};

describe('dados da imagem do cartão', () => {
  it('inclui somente os campos públicos da prévia', () => {
    const dados = dadosCartaoPet(pet, ['peso', 'vacinas']);
    expect(dados).toEqual({ nome: 'Mia', especie: 'Gato', raca: 'Siamês', foto: pet.foto_url, emMemoria: false, selos: ['peso', 'vacinas'] });
    const texto = JSON.stringify(dados);
    for (const privado of ['tutor-privado', 'pet-privado', 'Informação privada', 'Contato privado', 'Anotações privadas']) expect(texto).not.toContain(privado);
  });
  it('não duplica selos e aceita pet sem foto ou raça', () => {
    expect(dadosCartaoPet({ ...pet, foto_url: null, raca: null, especie: 'cao' }, ['peso', 'peso'])).toMatchObject({ especie: 'Cão', raca: 'Raça não informada', foto: null, selos: ['peso'] });
  });
  it('preserva o modo memorial sem metas de cuidado', () => {
    expect(dadosCartaoPet({ ...pet, em_memoria: true }, ['vacinas', 'peso'])).toMatchObject({ emMemoria: true, selos: [] });
  });
});
