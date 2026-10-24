import { beforeEach, describe, expect, it, vi } from 'vitest';
import { escolherFotoPasseio } from '../passeios/escolherFoto';

const m = vi.hoisted(() => ({ permissao: vi.fn(), camera: vi.fn(), galeria: vi.fn() }));
vi.mock('expo-image-picker', () => ({ requestCameraPermissionsAsync: m.permissao, launchCameraAsync: m.camera, launchImageLibraryAsync: m.galeria }));
beforeEach(() => {
  vi.clearAllMocks(); m.permissao.mockResolvedValue({ granted: true });
  m.camera.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/foto.jpg', type: 'image', fileSize: 1000 }] });
  m.galeria.mockResolvedValue({ canceled: true });
});
describe('foto do resumo', () => {
  it('permite cancelar sem mudar foto e pede câmera somente quando necessário', async () => {
    expect(await escolherFotoPasseio('galeria')).toBeNull(); expect(m.permissao).not.toHaveBeenCalled();
    expect(await escolherFotoPasseio('camera')).toBe('file:///cache/foto.jpg');
    expect(m.camera).toHaveBeenCalledWith(expect.objectContaining({ exif: false, mediaTypes: ['images'] }));
  });
  it('trata permissão negada e imagem acima do limite', async () => {
    m.permissao.mockResolvedValueOnce({ granted: false });
    await expect(escolherFotoPasseio('camera')).rejects.toThrow('Autorize');
    expect(m.camera).not.toHaveBeenCalled();
    m.galeria.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///grande.jpg', type: 'image', fileSize: 6 * 1024 * 1024 }] });
    await expect(escolherFotoPasseio('galeria')).rejects.toThrow('5 MB');
  });
});
