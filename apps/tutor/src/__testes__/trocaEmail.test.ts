import { beforeEach, describe, expect, it, vi } from 'vitest';
import { solicitarTrocaEmail, validarTrocaEmail } from '../perfil/email';
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), setSession: vi.fn(), updateUser: vi.fn(), stop: vi.fn() }));
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: mocks.getSession } },
  criarClienteTemporario: () => ({ auth: { setSession: mocks.setSession, updateUser: mocks.updateUser, stopAutoRefresh: mocks.stop } }),
}));

describe('troca de e-mail', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'a' }, access_token: 'token-a', refresh_token: 'refresh-a', expires_at: Date.now() / 1000 + 3600 } } });
    mocks.setSession.mockResolvedValue({ error: null });
    mocks.updateUser.mockResolvedValue({ data: { user: { id: 'a', email: 'atual@exemplo.com' } }, error: null });
  });
  it('valida endereço, repetição e diferença do atual', () => {
    expect(validarTrocaEmail('a@b.com', 'inválido', 'inválido')).toBeTruthy();
    expect(validarTrocaEmail('a@b.com', 'novo@b.com', 'outro@b.com')).toBeTruthy();
    expect(validarTrocaEmail('A@b.com', ' a@b.com ', 'a@b.com')).toBeTruthy();
    expect(validarTrocaEmail('a@b.com', ' Novo@b.com ', 'novo@b.com')).toBeNull();
  });
  it('solicita pela sessão capturada sem declarar confirmação antecipada', async () => {
    const user = await solicitarTrocaEmail('a', ' Novo@Exemplo.com ');
    expect(mocks.setSession).toHaveBeenCalledWith(expect.objectContaining({ access_token: 'token-a' }));
    expect(mocks.updateUser).toHaveBeenCalledWith({ email: 'novo@exemplo.com' });
    expect(user?.email).toBe('atual@exemplo.com');
    expect(mocks.stop).toHaveBeenCalled();
  });
  it('bloqueia sessão trocada antes da requisição', async () => {
    mocks.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'a' }, expires_at: Date.now() / 1000 + 3600 } } })
      .mockResolvedValueOnce({ data: { session: { user: { id: 'b' } } } });
    await expect(solicitarTrocaEmail('a', 'novo@b.com')).rejects.toThrow('conta mudou');
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it('não disputa a renovação de sessão expirada', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'a' }, expires_at: 1 } } });
    await expect(solicitarTrocaEmail('a', 'novo@b.com')).rejects.toThrow('renovada');
    expect(mocks.setSession).not.toHaveBeenCalled();
  });
  it('informa limite de envio e encerra cliente temporário mesmo com erro', async () => {
    mocks.updateUser.mockResolvedValue({ error: { status: 429 } });
    await expect(solicitarTrocaEmail('a', 'novo@b.com')).rejects.toThrow('Aguarde');
    expect(mocks.stop).toHaveBeenCalled();
  });
});
