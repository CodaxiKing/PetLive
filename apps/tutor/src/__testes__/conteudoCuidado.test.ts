import { beforeEach, describe, expect, it, vi } from 'vitest';
import { carregarItensEscala, carregarLuto, linkSeguro, LUTO_PADRAO } from '../pets/conteudoCuidado';

const m = vi.hoisted(() => ({ resposta: { data: null as unknown, error: null as unknown } }));
vi.mock('../lib/pdf', () => ({ escaparHtml: (t: string) => t }));
vi.mock('../lib/supabase', () => {
  const cadeia = { select: () => cadeia, order: () => cadeia, then: (ok: (v: unknown) => unknown) => Promise.resolve(m.resposta).then(ok) };
  return { supabase: { from: () => cadeia } };
});

beforeEach(() => {
  m.resposta = { data: null, error: null };
});

describe('conteúdo de cuidado', () => {
  it('usa o texto embutido sem resposta', async () => {
    m.resposta = { data: null, error: { message: 'offline' } };
    expect(await carregarLuto()).toBe(LUTO_PADRAO);
    expect((await carregarItensEscala()).map((i) => i.chave)).toHaveLength(7);
  });

  it('troca só rótulo e pergunta da escala, mantendo as 7 chaves', async () => {
    m.resposta = { data: [{ chave: 'dor', rotulo: 'Dor', pergunta: 'nova' }, { chave: 'outra', rotulo: 'X', pergunta: 'Y' }], error: null };
    const itens = await carregarItensEscala();
    expect(itens).toHaveLength(7);
    expect(itens.find((i) => i.chave === 'dor')?.pergunta).toBe('nova');
  });

  it('só abre telefone e https', () => {
    expect(linkSeguro('tel:188')).toBe('tel:188');
    expect(linkSeguro('https://cvv.org.br')).toBe('https://cvv.org.br');
    expect(linkSeguro('javascript:alert(1)')).toBeNull();
    expect(linkSeguro('tel:188;x')).toBeNull();
  });
});
