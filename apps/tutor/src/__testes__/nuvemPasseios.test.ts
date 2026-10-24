import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apagarPasseiosNuvem, sincronizadorPasseios } from '../passeios/nuvem';
import { concluirPasseio, novoPasseio } from '../passeios/passeio';
import { dadosNuvem } from '../passeios/sincronizar';

const m = vi.hoisted(() => ({ user: 'tutor', getUser: vi.fn(), rpc: vi.fn(), range: vi.fn(), eq: vi.fn(),
  getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: m.getItem, setItem: m.setItem, removeItem: m.removeItem } }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getUser: m.getUser }, rpc: m.rpc,
  from: () => ({ select: () => ({ eq: m.eq }) }) } }));
const p = concluirPasseio(novoPasseio('a', 'tutor', 'pet', 'Luna', 1000), 2000);
beforeEach(() => {
  vi.resetAllMocks(); m.user = 'tutor';
  m.getUser.mockImplementation(async () => ({ data: { user: { id: m.user } }, error: null }));
  m.getItem.mockResolvedValue(null); m.setItem.mockResolvedValue(undefined); m.removeItem.mockResolvedValue(undefined);
  m.eq.mockReturnValue({ order: () => ({ range: m.range }) });
  m.range.mockResolvedValue({ data: [], error: null });
  m.rpc.mockImplementation(async (nome, args) => ({ data: nome === 'passeio_sincronizar'
    ? { id: args.p_dados.id, versao: 1, dados: args.p_dados } : null, error: null }));
});

describe('adaptador autenticado de passeios', () => {
  it('lê por conta, envia versão, persiste registros antes da base e não envia foto', async () => {
    const salvar = vi.fn().mockResolvedValue(undefined);
    await sincronizadorPasseios('tutor')([{ ...p, fotoId: 'local' }], salvar);
    expect(m.eq).toHaveBeenCalledWith('tutor_id', 'tutor');
    expect(m.rpc).toHaveBeenCalledWith('passeios_preparar_sincronizacao', { p_tutor: 'tutor' });
    expect(m.rpc).toHaveBeenCalledWith('passeio_sincronizar', { p_dados: dadosNuvem(p), p_versao: 0 });
    expect(salvar.mock.invocationCallOrder[0]).toBeLessThan(m.setItem.mock.invocationCallOrder[0]);
    expect(m.getItem).toHaveBeenCalledWith('petlive:passeios:base-nuvem:v1:tutor');
  });
  it('troca de conta durante envio bloqueia a gravação local e da base', async () => {
    m.rpc.mockImplementation(async (nome, args) => {
      if (nome === 'passeio_sincronizar') m.user = 'outro';
      return { data: nome === 'passeio_sincronizar' ? { id: 'a', versao: 1, dados: args.p_dados } : null, error: null };
    });
    const salvar = vi.fn();
    await expect(sincronizadorPasseios('tutor')([p], salvar)).rejects.toThrow('nesta conta');
    expect(salvar).not.toHaveBeenCalled(); expect(m.setItem).not.toHaveBeenCalled();
  });
  it('falha de rede/migration mantém os registros e o controle de sincronização', async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: 'not found' } });
    const salvar = vi.fn();
    await expect(sincronizadorPasseios('tutor')([p], salvar)).rejects.toThrow('disponível');
    expect(salvar).not.toHaveBeenCalled(); expect(m.setItem).not.toHaveBeenCalled();
  });
  it('falha de persistência local não avança a versão confirmada', async () => {
    await expect(sincronizadorPasseios('tutor')([p], vi.fn().mockRejectedValue(new Error('disco cheio')))).rejects.toThrow('disco');
    expect(m.setItem).not.toHaveBeenCalled();
  });
  it('pagina todos os passeios em vez de truncar a restauração nos primeiros cem', async () => {
    const registros = Array.from({ length: 100 }, (_, i) => ({ id: String(i), versao: 1, dados: { ...p, id: String(i) } }));
    m.range.mockResolvedValueOnce({ data: registros, error: null }).mockResolvedValueOnce({ data: [], error: null });
    const resultado = await sincronizadorPasseios('tutor')([], vi.fn());
    expect(resultado).toHaveLength(100); expect(m.range.mock.calls).toEqual([[0, 99], [100, 199]]);
  });
  it('exclusão exige a conta esperada no servidor e não apaga base quando há erro', async () => {
    m.rpc.mockResolvedValueOnce({ error: { message: 'offline' } });
    await expect(apagarPasseiosNuvem('tutor')).rejects.toThrow('nuvem');
    expect(m.removeItem).not.toHaveBeenCalled();
    await apagarPasseiosNuvem('tutor');
    expect(m.rpc).toHaveBeenCalledWith('passeios_apagar_nuvem', { p_tutor: 'tutor' });
    expect(m.removeItem).toHaveBeenCalledWith('petlive:passeios:base-nuvem:v1:tutor');
  });
});
