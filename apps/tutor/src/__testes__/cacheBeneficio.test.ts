import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fetchComCache } from '../lib/cacheOffline';
const { storage } = vi.hoisted(() => ({ storage: { getItem: vi.fn(), setItem: vi.fn() } }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));
const rede = vi.fn();
const headers = { Authorization: `Bearer cabecalho.${btoa(JSON.stringify({ sub: 'tutor-a', role: 'authenticated' }))}.assinatura` };
const base = 'https://teste.supabase.co/rest/v1/';
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', rede);
  storage.getItem.mockResolvedValue('[{"plano":"premium"}]');
  storage.setItem.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());

describe('consulta atual de benefício sem cache de autorização', () => {
  it('não guarda a confirmação de Premium como autorização offline', async () => {
    rede.mockResolvedValue(new Response('[{"plano":"premium"}]', { status: 200 }));
    expect((await fetchComCache(`${base}profiles?select=plano&id=eq.tutor-a`, { headers })).status).toBe(200);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it('não reutiliza uma confirmação antiga após perder a rede', async () => {
    rede.mockRejectedValue(new TypeError('Network request failed'));
    await expect(fetchComCache(`${base}profiles?select=plano&id=eq.tutor-a`, { headers })).rejects.toThrow('Network request failed');
    expect(storage.getItem).not.toHaveBeenCalled();
  });
  it.each(['*', 'id,plano', 'beneficio:plano'])('não usa cache em seleções completas ou com alias: %s', async (select) => {
    rede.mockRejectedValue(new TypeError('Network request failed'));
    await expect(fetchComCache(`${base}profiles?select=${encodeURIComponent(select)}`, { headers })).rejects.toThrow();
    expect(storage.getItem).not.toHaveBeenCalled();
  });
  it('preserva leituras offline de saúde do pet com a conta vinculada ao pedido', async () => {
    const corpo = '[{"id":"vacina-a"}]';
    storage.getItem.mockResolvedValue(corpo);
    rede.mockRejectedValue(new TypeError('Network request failed'));
    const resposta = await fetchComCache(`${base}vaccinations?select=id`, { headers });
    expect(await resposta.text()).toBe(corpo);
    expect(storage.getItem).toHaveBeenCalledWith(expect.stringContaining('petlive-cache:tutor-a:'));
  });
  it('preserva cache de campos de perfil que não concedem benefício', async () => {
    storage.getItem.mockResolvedValue('[{"nome":"Tutor"}]');
    rede.mockRejectedValue(new TypeError('Network request failed'));
    expect(await (await fetchComCache(`${base}profiles?select=nome`, { headers })).json()).toEqual([{ nome: 'Tutor' }]);
  });
  it('não substitui sessão expirada por um benefício antigo', async () => {
    rede.mockResolvedValue(new Response('{"message":"expired"}', { status: 401 }));
    expect((await fetchComCache(`${base}profiles?select=plano`, { headers })).status).toBe(401);
    expect(storage.getItem).not.toHaveBeenCalled();
  });
});
