import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportarMeusDados } from '../privacidade/conta';

const mocks = vi.hoisted(() => ({ share: vi.fn(), getUser: vi.fn(), rpc: vi.fn(), carregar: vi.fn(), repositorio: vi.fn(), meta: vi.fn(), carregarMeta: vi.fn() }));
vi.mock('../privacidade/arquivoExportacao', () => ({ compartilharExportacao: mocks.share }));
vi.mock('../lib/supabase', () => ({ supabase: {
  auth: { getUser: mocks.getUser }, rpc: mocks.rpc,
  from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
} }));
vi.mock('../passeios/local', () => ({ repositorioPasseiosLocal: mocks.repositorio, repositorioMetaPasseiosLocal: mocks.meta }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'tutor-a' } }, error: null });
  mocks.carregar.mockResolvedValue([{ id: 'passeio-local' }]);
  mocks.repositorio.mockReturnValue({ carregar: mocks.carregar });
  mocks.carregarMeta.mockResolvedValue(5);
  mocks.meta.mockReturnValue({ carregar: mocks.carregarMeta });
  mocks.rpc.mockResolvedValue({ data: { pets: [] }, error: null });
  mocks.share.mockResolvedValue({});
});
describe('exportação dos passeios locais', () => {
  it('inclui registros do aparelho somente da conta autenticada', async () => {
    await exportarMeusDados();
    expect(mocks.repositorio).toHaveBeenCalledWith('tutor-a');
    expect(mocks.meta).toHaveBeenCalledWith('tutor-a');
    expect(mocks.share.mock.calls[0][0]).toMatchObject({ passeios_locais: [{ id: 'passeio-local' }], meta_semanal_passeios_km: 5 });
    expect(mocks.share.mock.calls[0][1]).toBe('tutor-a');
    expect(mocks.rpc).toHaveBeenCalledWith('privacidade_registrar_exportacao', { p_tutor: 'tutor-a' });
  });
  it('interrompe antes de compartilhar se a conta mudou durante a consulta', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'tutor-a' } }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: 'tutor-b' } }, error: null });
    await expect(exportarMeusDados()).rejects.toThrow('conta mudou');
    expect(mocks.share).not.toHaveBeenCalled();
  });
  it('não registra em outra conta depois de fechar o compartilhamento', async () => {
    mocks.share.mockImplementationOnce(async () => { mocks.getUser.mockResolvedValue({ data: { user: { id: 'tutor-b' } }, error: null }); });
    await expect(exportarMeusDados()).rejects.toThrow('conta mudou');
    expect(mocks.rpc).not.toHaveBeenCalledWith('privacidade_registrar_exportacao', expect.anything());
  });
  it('informa falha de registro em vez de ignorar o erro do servidor', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { pets: [] }, error: null }).mockResolvedValueOnce({ error: { message: 'offline' } });
    await expect(exportarMeusDados()).rejects.toThrow('Arquivo preparado');
  });
});
