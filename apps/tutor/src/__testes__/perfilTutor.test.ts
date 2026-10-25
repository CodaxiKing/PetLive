import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enviarFotoPerfil, removerFotoPerfil, urlFotoPerfil } from '../perfil/foto';
import { temSenha, trocarSenha, validarTrocaSenha } from '../perfil/senha';

const m = vi.hoisted(() => ({
  upload: vi.fn(), remove: vi.fn(), signed: vi.fn(), from: vi.fn(), tabela: vi.fn(), update: vi.fn(), eq: vi.fn(),
  signIn: vi.fn(), updateUser: vi.fn(), single: vi.fn(), select: vi.fn(),
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'nova' }));
vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: { from: m.from },
    from: m.tabela,
    auth: { signInWithPassword: m.signIn, updateUser: m.updateUser },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  m.from.mockReturnValue({ upload: m.upload, remove: m.remove, createSignedUrl: m.signed });
  m.upload.mockResolvedValue({ error: null });
  m.remove.mockResolvedValue({ error: null });
  m.tabela.mockReturnValue({ update: m.update });
  m.update.mockReturnValue({ eq: m.eq });
  m.eq.mockReturnValue({ select: m.select });
  m.select.mockReturnValue({ single: m.single });
  m.single.mockResolvedValue({ data: { id: 'tutor' }, error: null });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(100) }));
});
afterEach(() => vi.unstubAllGlobals());

describe('foto do tutor', () => {
  it('distingue bucket ausente e preserva a foto anterior quando o envio falha', async () => {
    m.upload.mockResolvedValue({ error: { message: 'Bucket not found' } });
    await expect(enviarFotoPerfil('tutor', { uri: 'file:///f' }, 'tutor/velha.jpg')).rejects.toThrow('indisponível no servidor');
    expect(m.update).not.toHaveBeenCalled();
    expect(m.remove).not.toHaveBeenCalled();
  });
  it('envia para o bucket privado, grava o caminho e apaga a foto antiga', async () => {
    await expect(enviarFotoPerfil('tutor', { uri: 'file:///f', mimeType: 'image/png' }, 'tutor/velha.jpg')).resolves.toBe('tutor/nova.png');
    expect(m.from).toHaveBeenCalledWith('perfis');
    expect(m.upload).toHaveBeenCalledWith('tutor/nova.png', expect.any(ArrayBuffer), { contentType: 'image/png', upsert: false });
    expect(m.update).toHaveBeenCalledWith({ avatar_url: 'tutor/nova.png' });
    expect(m.remove).toHaveBeenCalledWith(['tutor/velha.jpg']);
  });
  it('desfaz o envio quando o perfil não salva', async () => {
    m.single.mockResolvedValue({ data: null, error: { message: 'falhou' } });
    await expect(enviarFotoPerfil('tutor', { uri: 'file:///f' }, 'tutor/velha.jpg')).rejects.toThrow('salvar a foto');
    expect(m.remove).toHaveBeenCalledWith(['tutor/nova.jpg']);
    expect(m.remove).not.toHaveBeenCalledWith(['tutor/velha.jpg']);
  });
  it('recusa formato errado e arquivo grande antes de enviar', async () => {
    await expect(enviarFotoPerfil('tutor', { uri: 'file:///f', mimeType: 'image/heic' }, null)).rejects.toThrow('JPEG');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(5 * 1024 * 1024 + 1) }));
    await expect(enviarFotoPerfil('tutor', { uri: 'file:///f' }, null)).rejects.toThrow('5 MB');
    expect(m.upload).not.toHaveBeenCalled();
  });
  it('não declara foto salva quando o update não afetou o perfil', async () => {
    m.single.mockResolvedValue({ data: null, error: null });
    await expect(enviarFotoPerfil('tutor', { uri: 'file:///f' }, 'tutor/velha.jpg')).rejects.toThrow('salvar a foto');
    expect(m.remove).toHaveBeenCalledWith(['tutor/nova.jpg']);
    expect(m.remove).not.toHaveBeenCalledWith(['tutor/velha.jpg']);
  });
  it('não apaga o arquivo quando a remoção do avatar não foi confirmada', async () => {
    m.single.mockResolvedValue({ data: null, error: null });
    await expect(removerFotoPerfil('tutor', 'tutor/velha.jpg')).rejects.toThrow('remover a foto');
    expect(m.remove).not.toHaveBeenCalled();
  });
  it('mostra a foto com link assinado e nada quando não há foto', async () => {
    m.signed.mockResolvedValue({ data: { signedUrl: 'https://x/assinada' }, error: null });
    await expect(urlFotoPerfil('tutor/a.jpg')).resolves.toBe('https://x/assinada');
    await expect(urlFotoPerfil(null)).resolves.toBeNull();
  });
});

describe('troca de senha', () => {
  it('só contas com e-mail têm senha', () => {
    expect(temSenha({ app_metadata: { providers: ['email', 'google'] } } as never)).toBe(true);
    expect(temSenha({ app_metadata: { providers: ['google'] } } as never)).toBe(false);
    expect(temSenha(null)).toBe(false);
  });
  it('confere os campos', () => {
    expect(validarTrocaSenha('', '12345678', '12345678')).toMatch('atual');
    expect(validarTrocaSenha('a', '123', '123')).toMatch('8 caracteres');
    expect(validarTrocaSenha('a', '12345678', '12345679')).toMatch('não são iguais');
    expect(validarTrocaSenha('12345678', '12345678', '12345678')).toMatch('diferente');
    expect(validarTrocaSenha('antiga', '12345678', '12345678')).toBeNull();
  });
  it('não grava a nova quando a atual não confere', async () => {
    m.signIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    await expect(trocarSenha('a@b.c', 'errada', '12345678')).rejects.toThrow('não confere');
    expect(m.updateUser).not.toHaveBeenCalled();
  });
  it('grava a nova depois de conferir a atual', async () => {
    m.signIn.mockResolvedValue({ error: null });
    m.updateUser.mockResolvedValue({ error: null });
    await trocarSenha('a@b.c', 'antiga', '12345678');
    expect(m.signIn).toHaveBeenCalledWith({ email: 'a@b.c', password: 'antiga' });
    expect(m.updateUser).toHaveBeenCalledWith({ password: '12345678' });
  });
});
