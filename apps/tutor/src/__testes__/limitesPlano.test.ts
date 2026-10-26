import { describe, expect, it } from 'vitest';
import { conferirLimites, limiteCadastroAtingido } from '../premium/limites';
describe('limites reais do servidor', () => {
  it('só bloqueia novo cadastro com quota confirmada pelo servidor', () => {
    const quota = { limites_ativos: true, pets_limite: 1, pets_somente_leitura: [], pets_ativos: 1, pode_cadastrar_pet: false };
    expect(limiteCadastroAtingido(conferirLimites(quota))).toBe(true);
    expect(limiteCadastroAtingido(conferirLimites({ ...quota, pets_ativos: 0, pode_cadastrar_pet: true }))).toBe(false);
    expect(limiteCadastroAtingido(conferirLimites({ ...quota, limites_ativos: false, pets_limite: null, pode_cadastrar_pet: true }))).toBe(false);
    expect(limiteCadastroAtingido(conferirLimites({ ...quota, pets_limite: null, pode_cadastrar_pet: true }))).toBe(false);
    expect(limiteCadastroAtingido(null)).toBe(false);
    expect(limiteCadastroAtingido(conferirLimites({ limites_ativos: true, pets_limite: 1, pets_somente_leitura: [] }))).toBe(false);
  });
  it('recusa quota parcial, negativa ou contraditória', () => {
    const quota = { limites_ativos: true, pets_limite: 1, pets_somente_leitura: [], pets_ativos: 1, pode_cadastrar_pet: false };
    for (const q of [{ ...quota, pets_ativos: -1 }, { ...quota, pets_ativos: 1.5 }, { ...quota, pets_ativos: undefined },
      { ...quota, pode_cadastrar_pet: undefined }, { ...quota, pode_cadastrar_pet: true }, { ...quota, pets_limite: null },
      { ...quota, limites_ativos: false, pets_limite: null }]) expect(() => conferirLimites(q)).toThrow();
  });
  it('mantém preparação desligada sem bloquear pets', () => {
    expect(conferirLimites({ limites_ativos: false, pets_limite: null, pets_somente_leitura: [] })).toEqual({ ativos: false, petsLimite: null, petsSomenteLeitura: [] });
  });
  it('preserva os IDs em leitura sem inferir a quota no cliente', () => {
    expect(conferirLimites({ limites_ativos: true, pets_limite: 1, pets_somente_leitura: ['pet2'] })).toMatchObject({ ativos: true, petsSomenteLeitura: ['pet2'] });
  });
  it('não interpreta erro, resposta parcial ou inconsistente como permissão', () => {
    for (const v of [null, {}, { limites_ativos: true, pets_limite: 0, pets_somente_leitura: [] }, { limites_ativos: false, pets_limite: null, pets_somente_leitura: ['pet'] }]) expect(() => conferirLimites(v)).toThrow();
  });
});
