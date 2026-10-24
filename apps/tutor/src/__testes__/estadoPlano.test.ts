import { describe, expect, it } from 'vitest';
import { confirmarConsultaPlano, estadoPlanoDaConta } from '../lib/estadoPlano';
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
  it('uma reconsulta retira a confirmação anterior até a resposta atual chegar', () => {
    expect(estadoPlanoDaConta('conta-a', { ...premium, carregando: true })).toEqual({ plano: 'gratis', carregando: true, erro: false });
    expect(estadoPlanoDaConta('conta-a', { ...premium, plano: 'gratis', carregando: false })).toEqual({ plano: 'gratis', carregando: false, erro: false });
  });
  it('perfil ausente, plano desconhecido ou erro não confirmam benefício', () => {
    for (const plano of [undefined, null, 'desconhecido', 1]) {
      expect(confirmarConsultaPlano('conta-a', plano)).toEqual({ tutorId: 'conta-a', plano: 'gratis', erro: true });
    }
    expect(confirmarConsultaPlano('conta-a', 'premium', true)).toEqual({ tutorId: 'conta-a', plano: 'gratis', erro: true });
    expect(confirmarConsultaPlano('conta-a', 'premium')).toEqual({ tutorId: 'conta-a', plano: 'premium', erro: false });
  });
});
