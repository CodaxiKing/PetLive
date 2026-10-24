import { beforeEach, describe, expect, it, vi } from 'vitest';
import { guardarMapa, lerMapa, type ConsultaMapa } from '../mapa/cacheMapa';
import type { Lugar } from '../mapa/lugares';
const { dados, storage } = vi.hoisted(() => {
  const dados = new Map<string, string>();
  return { dados, storage: {
    getItem: vi.fn(async (chave: string) => dados.get(chave) ?? null),
    setItem: vi.fn(async (chave: string, valor: string) => { dados.set(chave, valor); }),
  } };
});
vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));
vi.mock('../lib/supabase', () => ({ supabase: {} }));
const consulta: ConsultaMapa = { usuario: 'tutor-a', lat: -22.76, lng: -43.45, raioKm: 3, categoria: 'todos', busca: '' };
const lugar = { id: 'local-a', nome: 'Petshop', categoria: 'petshop', fonte: 'osm', lat: -22.76, lng: -43.45 } as Lugar;
beforeEach(() => { dados.clear(); vi.clearAllMocks(); vi.useRealTimers(); });

describe('cópia offline do mapa', () => {
  it('separa região, raio, categoria, busca e conta', async () => {
    await guardarMapa(consulta, [lugar]);
    expect((await lerMapa(consulta))?.lugares[0].id).toBe(lugar.id);
    for (const alteracao of [{ lat: -25.43 }, { raioKm: 10 }, { categoria: 'clinica' }, { busca: 'Hospital' }, { usuario: 'tutor-b' }]) {
      expect(await lerMapa({ ...consulta, ...alteracao })).toBeNull();
    }
  });
  it('guarda lista vazia para substituir resultados que deixaram de existir', async () => {
    await guardarMapa(consulta, [lugar]);
    await guardarMapa(consulta, []);
    expect((await lerMapa(consulta))?.lugares).toEqual([]);
  });
  it('recalcula a distância e exclui pins fora do raio atual', async () => {
    await guardarMapa(consulta, [lugar, { ...lugar, id: 'longe', lat: -23 }]);
    const copia = await lerMapa({ ...consulta, lat: -22.761 });
    expect(copia?.lugares).toHaveLength(1);
    expect(copia?.lugares[0].distancia_km).toBeGreaterThan(0.1);
  });
  it('não mistura favoritos nem dados do Google com o cache de dados abertos', async () => {
    await guardarMapa({ ...consulta, categoria: 'salvos' }, [lugar]);
    await guardarMapa(consulta, [{ ...lugar, fonte: 'google' }]);
    await guardarMapa({ ...consulta, usuario: '' }, [lugar]);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it('descarta cópias corrompidas, inválidas ou com mais de sete dias', async () => {
    dados.set('petlive-cache:mapa-v2:tutor-a', '{');
    expect(await lerMapa(consulta)).toBeNull();
    await guardarMapa(consulta, [{ ...lugar, lat: NaN }]);
    expect(await lerMapa(consulta)).toBeNull();
    await guardarMapa(consulta, [lugar]);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 8 * 86_400_000);
    expect(await lerMapa(consulta)).toBeNull();
    vi.useRealTimers();
  });
  it('limita o espaço usado e preserva escritas concorrentes', async () => {
    await Promise.all(Array.from({ length: 15 }, (_, i) => guardarMapa({ ...consulta, busca: `lugar ${i}` }, [lugar])));
    expect(JSON.parse([...dados.values()][0])).toHaveLength(12);
    expect(await lerMapa({ ...consulta, busca: 'lugar 0' })).toBeNull();
    expect((await lerMapa({ ...consulta, busca: 'lugar 14' }))?.lugares).toHaveLength(1);
  });
  it('guarda no máximo 200 lugares por consulta', async () => {
    await guardarMapa(consulta, Array.from({ length: 250 }, (_, i) => ({ ...lugar, id: `local-${i}` })));
    expect((await lerMapa(consulta))?.lugares).toHaveLength(200);
  });
  it('falha de armazenamento não interrompe o mapa', async () => {
    storage.getItem.mockRejectedValueOnce(new Error('Disco indisponível'));
    await expect(guardarMapa(consulta, [lugar])).resolves.toBeUndefined();
    storage.getItem.mockRejectedValueOnce(new Error('Disco indisponível'));
    expect(await lerMapa(consulta)).toBeNull();
  });
});
