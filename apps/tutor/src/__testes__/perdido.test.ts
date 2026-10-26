import { beforeEach, describe, expect, it, vi } from 'vitest';
import { alertar, avistar, buscarPorFoto, distanciaKm, haQuanto, ligarRegiaoPerdidos, renovarRegiaoPerdidosSeLigada, textoDistancia } from '../perdido/perdido';

const m = vi.hoisted(() => ({ invoke: vi.fn(), rpc: vi.fn(), pedir: vi.fn(), ver: vi.fn(), atual: vi.fn(), ultima: vi.fn() }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));
vi.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: m.pedir,
  getForegroundPermissionsAsync: m.ver,
  getCurrentPositionAsync: m.atual,
  getLastKnownPositionAsync: m.ultima,
}));
vi.mock('../lib/supabase', () => ({ supabase: { rpc: m.rpc, functions: { invoke: m.invoke } } }));

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

  it('busca por foto devolve só níveis conhecidos, até 5', async () => {
    const c = (n: number, nivel: string) => ({ alert_id: `a${n}`, nome: `Pet ${n}`, especie: 'cao', foto_url: 'https://x', visto_em: '2026-10-25T10:00:00Z', distancia_km: n, nivel });
    m.invoke.mockResolvedValue({ data: { candidatos: [c(1, 'muito_parecido'), c(2, '87%'), c(3, 'parecido'), c(4, 'parecido'), c(5, 'pouco_parecido'), c(6, 'parecido'), c(7, 'parecido')] }, error: null });
    const lista = await buscarPorFoto('AAAA', 'image/jpeg', -22.9, -43.1);
    expect(lista.map((x) => x.alert_id)).toEqual(['a1', 'a3', 'a4', 'a5', 'a6']);
    expect(m.invoke).toHaveBeenCalledWith('find-lost-pet', { body: { imagem: 'AAAA', tipo: 'image/jpeg', lat: -22.9, lng: -43.1 } });
  });

  it('busca por foto mostra a explicação da função', async () => {
    m.invoke.mockResolvedValue({ data: null, error: { context: { json: async () => ({ erro: 'Tire outra foto só do pet, sem o rosto de pessoas.' }) } } });
    await expect(buscarPorFoto('AAAA', 'image/jpeg', 0, 0)).rejects.toThrow('sem o rosto');
    await expect(buscarPorFoto('AAAA', 'image/gif', 0, 0)).rejects.toThrow('JPEG');
  });
});
