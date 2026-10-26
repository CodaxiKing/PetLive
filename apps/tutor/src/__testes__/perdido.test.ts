import { beforeEach, describe, expect, it, vi } from 'vitest';
import { alertar, avistar, distanciaKm, haQuanto, ligarRegiaoPerdidos, renovarRegiaoPerdidosSeLigada, textoDistancia } from '../perdido/perdido';

const m = vi.hoisted(() => ({ rpc: vi.fn(), pedir: vi.fn(), ver: vi.fn(), atual: vi.fn(), ultima: vi.fn() }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));
vi.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: m.pedir,
  getForegroundPermissionsAsync: m.ver,
  getCurrentPositionAsync: m.atual,
  getLastKnownPositionAsync: m.ultima,
}));
vi.mock('../lib/supabase', () => ({ supabase: { rpc: m.rpc } }));

beforeEach(() => {
  vi.clearAllMocks();
  m.rpc.mockResolvedValue({ data: { ativo: true }, error: null });
});

describe('pet perdido', () => {
  it('envia o alerta com recado limpo e sem recado vazio', async () => {
    m.rpc.mockResolvedValue({ data: { id: 'a1', avisados: 3 }, error: null });
    const r = await alertar('p1', -23.5, -46.6, new Date('2026-10-25T12:00:00Z'), 2, '   ', true);
    expect(r).toEqual({ id: 'a1', avisados: 3 });
    expect(m.rpc).toHaveBeenCalledWith('perdido_alertar', expect.objectContaining({ p_pet_id: 'p1', p_raio: 2, p_mensagem: null, p_mostrar_telefone: true }));
  });

  it('mostra o erro do banco ao avisar que viu', async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: 'Este alerta já foi encerrado.' } });
    await expect(avistar('a1', 1, 2, new Date(), 'oi', false, null)).rejects.toThrow('encerrado');
  });

  it('liga a região só com a posição arredondada (~1 km)', async () => {
    m.pedir.mockResolvedValue({ granted: true });
    m.atual.mockResolvedValue({ coords: { latitude: -23.55678, longitude: -46.63912, accuracy: 10 } });
    await ligarRegiaoPerdidos();
    expect(m.rpc).toHaveBeenCalledWith('perdido_regiao_configurar', { p_ativo: true, p_lat: -23.56, p_lng: -46.64 });
  });

  it('não pede permissão nem renova a região desligada', async () => {
    m.rpc.mockResolvedValueOnce({ data: { ativo: false }, error: null });
    await renovarRegiaoPerdidosSeLigada();
    expect(m.ver).not.toHaveBeenCalled();
    expect(m.rpc).toHaveBeenCalledTimes(1);
  });

  it('renova a região ligada com a última posição conhecida', async () => {
    m.ver.mockResolvedValue({ granted: true });
    m.ultima.mockResolvedValue({ coords: { latitude: -22.901, longitude: -43.178 } });
    await renovarRegiaoPerdidosSeLigada();
    expect(m.pedir).not.toHaveBeenCalled();
    expect(m.rpc).toHaveBeenLastCalledWith('perdido_regiao_configurar', { p_ativo: true, p_lat: -22.9, p_lng: -43.18 });
  });

  it('formata distância e tempo', () => {
    expect(distanciaKm(-23.55, -46.63, -23.55, -46.63)).toBe(0);
    expect(distanciaKm(-23.55, -46.63, -23.56, -46.63)).toBeCloseTo(1.11, 1);
    expect(textoDistancia(0.01)).toBe('a 50 m');
    expect(textoDistancia(0.32)).toBe('a 300 m');
    const agora = Date.parse('2026-10-25T12:00:00Z');
    expect(haQuanto('2026-10-25T11:45:00Z', agora)).toBe('há 15 min');
    expect(haQuanto('2026-10-25T09:00:00Z', agora)).toBe('há 3 h');
    expect(haQuanto('2026-10-24T12:00:00Z', agora)).toBe('há 1 dia');
  });
});
