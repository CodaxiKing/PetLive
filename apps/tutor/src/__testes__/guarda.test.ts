import { beforeEach, describe, expect, it, vi } from 'vitest';
import { agruparPorDia, convidar, linkConvite, nomeAutor, nomesPets, responderConvite, sairDaGuarda } from '../guarda/guarda';

const m = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc: m.rpc } }));

beforeEach(() => {
  vi.clearAllMocks();
  m.rpc.mockResolvedValue({ data: {}, error: null });
});

describe('guarda compartilhada', () => {
  it('junta os nomes dos pets como numa frase', () => {
    expect(nomesPets([{ nome: 'Rex' }])).toBe('Rex');
    expect(nomesPets([{ nome: 'Rex' }, { nome: 'Mia' }])).toBe('Rex e Mia');
    expect(nomesPets([{ nome: 'Rex' }, { nome: 'Mia' }, { nome: 'Thor' }])).toBe('Rex, Mia e Thor');
  });

  it('agrupa as atualizações em Hoje, Ontem e datas', () => {
    const agora = new Date(2026, 9, 25, 15, 0);
    const grupos = agruparPorDia(
      [
        { criado_em: new Date(2026, 9, 25, 9, 14).toISOString() },
        { criado_em: new Date(2026, 9, 25, 8, 2).toISOString() },
        { criado_em: new Date(2026, 9, 24, 19, 40).toISOString() },
        { criado_em: new Date(2026, 9, 20, 10, 0).toISOString() },
      ],
      agora,
    );
    expect(grupos.map((g) => [g.dia, g.itens.length])).toEqual([['Hoje', 2], ['Ontem', 1], ['20/10', 1]]);
  });

  it('mostra Você para quem usa o app e o nome das outras pessoas', () => {
    const cuidadores = {
      titular: { user_id: 'd', nome: 'Diego', voce: false },
      pessoas: [{ user_id: 'a', nome: 'Ana', voce: true, desde: '' }],
    };
    expect(nomeAutor('a', 'a', cuidadores)).toBe('Você');
    expect(nomeAutor('d', 'a', cuidadores)).toBe('Diego');
    expect(nomeAutor('x', 'a', cuidadores)).toBe('Alguém');
    expect(nomeAutor(null, 'a', cuidadores)).toBe('Alguém');
  });

  it('manda os pets escolhidos e o e-mail sem espaços', async () => {
    await convidar(['rex', 'mia'], '  ana@email.com ');
    expect(m.rpc).toHaveBeenCalledWith('guarda_convidar', { p_pet_ids: ['rex', 'mia'], p_email: 'ana@email.com' });
  });

  it('aceita só os pets escolhidos e recusa sem pets', async () => {
    await responderConvite('c1', true, ['rex'], null);
    expect(m.rpc).toHaveBeenCalledWith('guarda_responder', { p_id: 'c1', p_aceitar: true, p_pet_ids: ['rex'], p_token: null });
  });

  it('sair sem escolher pets sai de todos', async () => {
    await sairDaGuarda();
    expect(m.rpc).toHaveBeenCalledWith('guarda_sair', { p_pet_ids: null });
  });

  it('repassa o erro do servidor', async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: 'Rex já tem 4 pessoas na guarda.' } });
    await expect(convidar(['rex'], 'a@b.c')).rejects.toThrow('4 pessoas');
  });

  it('monta o link do convite no site', () => {
    expect(linkConvite('abc')).toMatch(/\/convite\/abc$/);
  });
});
