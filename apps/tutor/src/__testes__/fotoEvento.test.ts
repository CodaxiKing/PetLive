import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enviarFotoEvento } from '../mapa/fotoEvento';

const mocks = vi.hoisted(() => ({ upload: vi.fn(), from: vi.fn(), publicUrl: vi.fn() }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'foto-aleatoria' }));
vi.mock('../lib/supabase', () => ({ supabase: { storage: { from: mocks.from } } }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ upload: mocks.upload, getPublicUrl: mocks.publicUrl });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.publicUrl.mockReturnValue({ data: { publicUrl: 'https://example.invalid/foto.jpg' } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(100) }));
});
afterEach(() => vi.unstubAllGlobals());

describe('foto de divulgação do evento', () => {
  it('envia na pasta do tutor sem sobrescrever arquivos', async () => {
    await expect(enviarFotoEvento('tutor', { uri: 'file:///foto', mimeType: 'image/png' })).resolves.toMatchObject({ caminho: 'tutor/foto-aleatoria.png' });
    expect(mocks.from).toHaveBeenCalledWith('eventos');
    expect(mocks.upload).toHaveBeenCalledWith('tutor/foto-aleatoria.png', expect.any(ArrayBuffer), { contentType: 'image/png', upsert: false });
  });
  it('recusa formato incompatível antes de enviar', async () => {
    await expect(enviarFotoEvento('tutor', { uri: 'file:///video', mimeType: 'video/mp4' })).rejects.toThrow('JPEG');
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('recusa imagens vazias e acima de 5 MB', async () => {
    for (const tamanho of [0, 5 * 1024 * 1024 + 1]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(tamanho) }));
      await expect(enviarFotoEvento('tutor', { uri: 'file:///foto' })).rejects.toThrow('5 MB');
    }
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('mantém uma falha de upload como erro, sem retornar URL de sucesso', async () => {
    mocks.upload.mockResolvedValue({ error: { message: 'Network error' } });
    await expect(enviarFotoEvento('tutor', { uri: 'file:///foto' })).rejects.toThrow('Não foi possível enviar');
    expect(mocks.publicUrl).not.toHaveBeenCalled();
  });
});
