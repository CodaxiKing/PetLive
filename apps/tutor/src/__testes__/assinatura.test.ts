import { describe, expect, it } from 'vitest';
import { lerAssinatura, resumoAssinatura, type Assinatura } from '../perfil/assinatura';
const assinatura: Assinatura = { id: 'a', ciclo: 'anual', status: 'ativa', periodo_inicio: '2026-01-01T00:00:00Z', periodo_fim: '2027-01-01T00:00:00Z', forma_pagamento: 'pix', valor_centavos: 9900, moeda: 'BRL', provedor: 'asaas' };
describe('minha assinatura', () => {
  it('distingue Premium sem contrato de uma cobrança registrada', () => {
    expect(lerAssinatura({ plano: 'premium', assinatura: null, gestao_disponivel: false }).assinatura).toBeNull();
    expect(lerAssinatura({ plano: 'gratis', assinatura, gestao_disponivel: false }).plano).toBe('gratis');
  });
  it('rejeita resposta ausente, estado desconhecido e período inválido', () => {
    for (const valor of [null, {}, { plano: 'premium', gestao_disponivel: false, assinatura: { ...assinatura, status: 'desconhecido' } },
      { plano: 'premium', gestao_disponivel: false, assinatura: { ...assinatura, periodo_fim: '2025-01-01' } }]) {
      expect(() => lerAssinatura(valor)).toThrow();
    }
  });
  it('não anuncia renovação de contrato cancelando ou encerrado', () => {
    expect(resumoAssinatura({ ...assinatura, status: 'cancelando' }, Date.parse('2026-10-25')).periodo).toContain('período já pago');
    expect(resumoAssinatura(assinatura, Date.parse('2028-01-01')).status).toBe('Período encerrado');
    expect(resumoAssinatura({ ...assinatura, status: 'pagamento_falhou' }, Date.parse('2026-10-25')).periodo).toContain('Pagamento pendente');
  });
  it('não inventa valor ou forma de pagamento ausentes', () => {
    const r = resumoAssinatura({ ...assinatura, valor_centavos: null, forma_pagamento: null });
    expect(r.valor).toBe('Valor não informado'); expect(r.pagamento).toBe('Não informado');
  });
});
