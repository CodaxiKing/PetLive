import { beforeEach, describe, expect, it, vi } from 'vitest';
import { consultarLimites } from '../premium/consultarLimites';
const m = vi.hoisted(() => ({ sessao: vi.fn(), criar: vi.fn(), rpc: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: m.sessao } }, criarClienteTemporario: m.criar }));
const sessao = (id = 'a') => ({ data: { session: { user: { id }, access_token: `token-${id}` } }, error: null });
const quota = { limites_ativos: true, pets_limite: 1, pets_somente_leitura: [], pets_ativos: 1, pode_cadastrar_pet: false };
beforeEach(() => {
  vi.resetAllMocks();
  m.sessao.mockResolvedValue(sessao());
  m.criar.mockReturnValue({ rpc: m.rpc });
  m.rpc.mockResolvedValue({ data: quota, error: null });
});
describe('consulta atual de limites da própria conta', () => {
  it('captura a credencial e confere o titular antes e depois da consulta', async () => {
    expect(await consultarLimites('a')).toMatchObject({ podeCadastrarPet: false, petsAtivos: 1 });
    expect(m.criar).toHaveBeenCalledWith('token-a');
    expect(m.rpc).toHaveBeenCalledWith('limites_meu_plano', { p_tutor: 'a' });
    expect(m.sessao).toHaveBeenCalledTimes(2);
  });
  it('não consulta conta diferente ou sessão inválida', async () => {
    await expect(consultarLimites('b')).rejects.toThrow('conta mudou');
    m.sessao.mockResolvedValue({ data: { session: null }, error: null });
    await expect(consultarLimites('a')).rejects.toThrow('conta mudou');
    m.sessao.mockResolvedValue({ data: {}, error: new Error('falha') });
    await expect(consultarLimites('a')).rejects.toThrow('conta mudou');
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it('descarta resposta após trocar a conta', async () => {
    m.sessao.mockResolvedValueOnce(sessao()).mockResolvedValue(sessao('b'));
    await expect(consultarLimites('a')).rejects.toThrow('conta mudou');
  });
  it('propaga erro de rede/servidor e contrato incompleto sem inferir permissão', async () => {
    m.rpc.mockRejectedValueOnce(new Error('sem rede'));
    await expect(consultarLimites('a')).rejects.toThrow('sem rede');
    m.rpc.mockResolvedValueOnce({ error: { message: 'privado' } });
    await expect(consultarLimites('a')).rejects.toThrow('atualizar os limites');
    m.rpc.mockResolvedValueOnce({ data: { ...quota, pode_cadastrar_pet: undefined } });
    await expect(consultarLimites('a')).rejects.toThrow('inconsistente');
  });
});
