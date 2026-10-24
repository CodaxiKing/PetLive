import { describe, expect, it } from 'vitest';
import { conviteCartao, dadosCartaoPet, dimensoesCapturaCartao, FORMATOS_CARTAO, TEMAS_CARTAO, temaCartaoPermitido } from '../pets/cartaoPet';
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

describe('personalização e convite do cartão', () => {
  it('volta ao tema grátis quando Premium deixa de estar confirmado', () => {
    expect(TEMAS_CARTAO).toHaveLength(5);
    expect(temaCartaoPermitido('lilas', true).id).toBe('lilas');
    expect(temaCartaoPermitido('lilas', false).id).toBe('azul');
    expect(temaCartaoPermitido('azul', false).id).toBe('azul');
  });
  it('mantém proporções e resolução de saída nas densidades de Android e iOS', () => {
    expect(FORMATOS_CARTAO.post).toMatchObject({ largura: 1080, altura: 1080 });
    expect(FORMATOS_CARTAO.stories).toMatchObject({ largura: 1080, altura: 1920 });
    for (const formato of ['post', 'stories'] as const) {
      for (const densidade of [1, 2, 2.625, 3]) {
        const android = dimensoesCapturaCartao(formato, 'android', densidade);
        const ios = dimensoesCapturaCartao(formato, 'ios', densidade);
        expect(android).toEqual({ width: 1080, height: FORMATOS_CARTAO[formato].altura });
        expect(ios.width * densidade).toBeCloseTo(1080);
        expect(ios.height * densidade).toBeCloseTo(FORMATOS_CARTAO[formato].altura);
        expect(android.width / android.height).toBeCloseTo(ios.width / ios.height);
      }
    }
  });
  it('remove caminhos, códigos, parâmetros e fragmentos do endereço de convite', () => {
    const link = conviteCartao('https://petlive.example/cuidador/segredo?token=privado#tutor-1');
    expect(link).toBe('https://petlive.example/?utm_source=cartao_pet&utm_medium=compartilhamento');
    for (const segredo of ['segredo', 'privado', 'tutor-1']) expect(link).not.toContain(segredo);
    expect(conviteCartao('http://preview.example/')).toMatch(/^http:\/\/preview.example\//);
  });
  it('não gera um convite quebrado ou com credenciais quando a configuração é inválida', () => {
    for (const site of [undefined, '', 'petlive.app', 'javascript:alert(1)', 'file:///tmp/foto', 'https://usuario:senha@example.com']) {
      expect(conviteCartao(site)).toBeNull();
    }
    expect(dimensoesCapturaCartao('post', 'ios', Number.NaN)).toEqual({ width: 1080, height: 1080 });
  });
});
