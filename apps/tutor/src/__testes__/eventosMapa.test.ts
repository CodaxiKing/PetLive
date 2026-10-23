import { afterEach, describe, expect, it, vi } from 'vitest';
import { dataHoraEvento, eventosPorPerto } from '../mapa/eventos';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('eventos no mapa', () => {
  it('envia o tipo do banco e delega o período ao servidor', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2027-03-07T23:00:00-03:00'));
    rpc.mockResolvedValue({ data: [], error: null });
    await eventosPorPerto({ lat: -22, lng: -43 }, 10, 'semana', 'adocao');
    expect(rpc).toHaveBeenCalledWith('eventos_por_perto', expect.objectContaining({ p_tipo: 'adocao', p_periodo: 'semana', p_raio_km: 10 }));
    const args = rpc.mock.calls[0][1];
    expect(new Date(args.p_fim).getTime()).toBeGreaterThan(new Date(args.p_inicio).getTime());
  });
  it('expõe erro de consulta em vez de fingir lista vazia', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Sem conexão' } });
    await expect(eventosPorPerto({ lat: -22, lng: -43 }, 3, 'hoje', null)).rejects.toThrow('Sem conexão');
  });
  it('mostra o fim em outra data quando atravessa meia-noite', () => {
    expect(dataHoraEvento('2027-03-10T23:30:00-03:00', '2027-03-11T01:30:00-03:00')).toMatch(/23:30 até .*01:30/);
    expect(dataHoraEvento('2027-03-10T13:00:00Z', '2027-03-10T15:00:00Z')).toContain('10:00–12:00');
  });
});
