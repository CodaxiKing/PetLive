import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cotar, type Parceiro } from '../parceiros/parceiros';

const m = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc: m.rpc } }));

const parceiro: Parceiro = { id: 'p1', nome: 'A', tipo: 'plano', beneficios: 'Consultas', preco_texto: null, url: 'https://a.invalid' };

beforeEach(() => vi.clearAllMocks());

describe('parceiros de plano e seguro', () => {
  it('registra o clique e usa o link do banco', async () => {
    m.rpc.mockResolvedValue({ data: 'https://b.invalid/cotar', error: null });
    expect(await cotar(parceiro)).toBe('https://b.invalid/cotar');
    expect(m.rpc).toHaveBeenCalledWith('parceiro_cotar', { p_partner: 'p1' });
  });

  it('recusa link que não é https', async () => {
    m.rpc.mockResolvedValue({ data: 'javascript:alert(1)', error: null });
    await expect(cotar(parceiro)).rejects.toThrow('inválido');
  });

  it('mostra o erro do banco', async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: 'Este parceiro não está mais disponível.' } });
    await expect(cotar(parceiro)).rejects.toThrow('disponível');
  });
});
