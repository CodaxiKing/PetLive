import { beforeEach, describe, expect, it, vi } from 'vitest';
import { carregarInteressesOng, carregarPetsOng, linkRespostaOng, marcarAdotadoOng, prepararRespostaOng } from '../adocao/ong';
const m = vi.hoisted(() => ({ user: vi.fn(), rpc: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getUser: m.user }, rpc: m.rpc } }));
const pet = { id: 'p', nome: 'Mia', status: 'publicado', confirmado_em: '2026-10-24T12:00:00Z', criado_em: '2026-10-24T12:00:00Z', ong_nome: 'Abrigo', ong_status: 'aprovada', interesses: 2 };
beforeEach(() => { vi.resetAllMocks(); m.user.mockResolvedValue({ data: { user: { id: 'a' } }, error: null }); m.rpc.mockResolvedValue({ data: null, error: null }); });
describe('painel da ONG', () => {
  it('confere página, metadados e cursor do painel', async () => {
    m.rpc.mockResolvedValue({ data: { itens: [pet], tem_mais: false, ongs: [{ nome: 'Abrigo', status: 'aprovada' }] }, error: null });
    expect((await carregarPetsOng('a', pet)).itens).toEqual([pet]);
    expect(m.rpc).toHaveBeenCalledWith('ong_pets_listar', { p_tutor: 'a', p_antes: pet.criado_em, p_antes_id: 'p' });
    m.rpc.mockResolvedValue({ data: { itens: [{ ...pet, interesses: -1 }], tem_mais: false, ongs: [] }, error: null });
    await expect(carregarPetsOng('a')).rejects.toThrow('incompleta');
  });
  it('recusa respostas incompletas e metadados desconhecidos', async () => {
    for (const data of [null, { itens: [pet], tem_mais: true, ongs: [] }, { itens: [pet], tem_mais: false }, { itens: [pet], tem_mais: false, ongs: [{ nome: 'Abrigo', status: 'autoaprovada' }] }]) {
      m.rpc.mockResolvedValue({ data, error: null }); await expect(carregarPetsOng('a')).rejects.toThrow();
    }
  });
  it('busca interessados somente para a conta e pet esperados', async () => {
    m.rpc.mockResolvedValue({ data: { itens: [{ id: 'c', criado_em: pet.criado_em, mensagem: 'Olá', email_resposta: null }], tem_mais: false }, error: null });
    expect((await carregarInteressesOng('a', 'p')).itens).toHaveLength(1);
    expect(m.rpc).toHaveBeenCalledWith('ong_interesses_listar', { p_tutor: 'a', p_pet: 'p', p_antes: null, p_antes_id: null });
  });
  it('não devolve dados privados depois de troca de conta', async () => {
    m.user.mockResolvedValueOnce({ data: { user: { id: 'a' } }, error: null }).mockResolvedValueOnce({ data: { user: { id: 'b' } }, error: null });
    await expect(carregarInteressesOng('a', 'p')).rejects.toThrow('conta mudou');
    m.user.mockResolvedValueOnce({ data: { user: { id: 'b' } }, error: null });
    await expect(marcarAdotadoOng('a', 'p')).rejects.toThrow('conta mudou');
    expect(m.rpc).toHaveBeenCalledTimes(1);
  });
  it('só confirma adotado após retorno verdadeiro do servidor', async () => {
    m.rpc.mockResolvedValueOnce({ data: true, error: null }); await marcarAdotadoOng('a', 'p');
    m.rpc.mockResolvedValueOnce({ data: false, error: null }); await expect(marcarAdotadoOng('a', 'p')).rejects.toThrow('confirmar');
    m.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Somente a ONG responsável e aprovada pode atualizar este pet.' } });
    await expect(marcarAdotadoOng('a', 'p')).rejects.toThrow('Somente a ONG');
  });
  it('revalida o contato no servidor e codifica destinatário/assunto sem injeção', async () => {
    m.rpc.mockResolvedValue({ data: 'eu+pet@example.com', error: null });
    const url = await prepararRespostaOng('a', 'c', 'Mia & Bia?bcc=outro');
    expect(url).toBe('mailto:eu%2Bpet%40example.com?subject=Interesse%20na%20ado%C3%A7%C3%A3o%20de%20Mia%20%26%20Bia%3Fbcc%3Doutro');
    expect(m.rpc).toHaveBeenCalledWith('ong_contato_email', { p_tutor: 'a', p_contato: 'c' });
    expect(() => linkRespostaOng('eu@example.com\r\nbcc:outro', 'Mia')).toThrow('inválido');
    m.rpc.mockResolvedValue({ data: null, error: null }); await expect(prepararRespostaOng('a', 'c', 'Mia')).rejects.toThrow('indisponível');
  });
});
