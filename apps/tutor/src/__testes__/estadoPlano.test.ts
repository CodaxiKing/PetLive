import { describe, expect, it } from 'vitest';
import { estadoPlanoDaConta } from '../lib/estadoPlano';
describe('plano vinculado à conta', () => {
  const premium = { tutorId: 'conta-a', plano: 'premium' as const, erro: false };
  it('não mantém Premium após sair ou trocar de conta', () => {
    expect(estadoPlanoDaConta(undefined, premium)).toEqual({ plano: 'gratis', carregando: false, erro: false });
    expect(estadoPlanoDaConta('conta-b', premium)).toEqual({ plano: 'gratis', carregando: true, erro: false });
  });
  it('aplica tanto concessão quanto retirada do benefício', () => {
    expect(estadoPlanoDaConta('conta-a', premium).plano).toBe('premium');
    expect(estadoPlanoDaConta('conta-a', { ...premium, plano: 'gratis' }).plano).toBe('gratis');
  });
  it('distingue falha de consulta de plano grátis confirmado', () => {
    expect(estadoPlanoDaConta('conta-a', { ...premium, erro: true })).toEqual({ plano: 'gratis', carregando: false, erro: true });
    expect(estadoPlanoDaConta('conta-a', null)).toEqual({ plano: 'gratis', carregando: true, erro: false });
  });
});
