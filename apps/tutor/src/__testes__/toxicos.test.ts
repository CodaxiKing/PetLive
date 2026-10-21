import { describe, expect, it } from 'vitest';
import { buscarToxicos, type ItemToxico } from '../sos/conteudo';

const item = (nome: string, risco: ItemToxico['risco'], sinonimos: string[] = []) =>
  ({ id: nome, nome, sinonimos, risco, especies: ['cao', 'gato'], resumo: '', sintomas: '' }) as unknown as ItemToxico;

const ITENS = [item('Uva', 'perigoso', ['passas']), item('Alho', 'cuidado'), item('Chocolate', 'perigoso', ['cacau'])];

describe('busca do que intoxica', () => {
  it('perigosos primeiro, depois em ordem alfabética', () => {
    expect(buscarToxicos(ITENS, '').map((i) => i.nome)).toEqual(['Chocolate', 'Uva', 'Alho']);
  });

  it('acha por sinônimo, sem acento e sem diferenciar maiúsculas', () => {
    expect(buscarToxicos(ITENS, 'PASSAS').map((i) => i.nome)).toEqual(['Uva']);
    expect(buscarToxicos(ITENS, 'cacáu').map((i) => i.nome)).toEqual(['Chocolate']);
  });
});
