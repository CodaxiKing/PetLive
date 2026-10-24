import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportarMeusDados } from '../privacidade/conta';

const mocks = vi.hoisted(() => ({ share: vi.fn(), getUser: vi.fn(), rpc: vi.fn(), carregar: vi.fn(), repositorio: vi.fn(), meta: vi.fn(), carregarMeta: vi.fn() }));
vi.mock('react-native', () => ({ Share: { share: mocks.share } }));
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
    expect(JSON.parse(mocks.share.mock.calls[0][0].message)).toMatchObject({ passeios_locais: [{ id: 'passeio-local' }], meta_semanal_passeios_km: 5 });
    expect(mocks.rpc).toHaveBeenCalledWith('registrar_exportacao');
  });
  it('interrompe antes de compartilhar se a conta mudou durante a consulta', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'tutor-a' } }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: 'tutor-b' } }, error: null });
    await expect(exportarMeusDados()).rejects.toThrow('conta mudou');
    expect(mocks.share).not.toHaveBeenCalled();
  });
});
