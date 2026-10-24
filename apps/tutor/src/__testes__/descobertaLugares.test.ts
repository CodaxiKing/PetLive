import { beforeEach, describe, expect, it, vi } from 'vitest';
import { consultaOSM, converterOSM, validarRegiao } from '../../../../supabase/functions/_shared/descoberta-osm';
import type { Lugar } from '../mapa/lugares';
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke } } }));
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

describe('descoberta regional sem cadastro de lojas', () => {
  it('preserva falha de transporte e distingue indisponibilidade HTTP do provedor', async () => {
    const { descobrirLugares } = await import('../mapa/descoberta');
    invoke.mockResolvedValueOnce({ error: Object.assign(new Error('Falha ao enviar'), { name: 'FunctionsFetchError' }) });
    await expect(descobrirLugares({ lat: 0, lng: 0 }, 3)).rejects.toThrow('Network request failed');
    invoke.mockResolvedValueOnce({ error: Object.assign(new Error('HTTP 503'), { name: 'FunctionsHttpError' }) });
    await expect(descobrirLugares({ lat: 0, lng: 0 }, 3)).rejects.not.toThrow('Network request failed');
  });
  it('reutiliza a consulta entre filtros e pessoas próximas, sem enviar dados pessoais', async () => {
    const { descobrirLugares } = await import('../mapa/descoberta');
    invoke.mockResolvedValue({ data: { lugares: [] }, error: null });
    await Promise.all([descobrirLugares({ lat: -22.759, lng: -43.451 }, 3), descobrirLugares({ lat: -22.761, lng: -43.449 }, 3)]);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('discover-places', { body: { lat: -22.76, lng: -43.45, raioKm: 3 } });
    await descobrirLugares({ lat: -22.76, lng: -43.45 }, 10);
    expect(invoke).toHaveBeenCalledTimes(2);
  });
  it('não guarda falha como uma região vazia e permite tentar de novo', async () => {
    const { descobrirLugares } = await import('../mapa/descoberta');
    invoke.mockResolvedValueOnce({ error: new Error('timeout') }).mockResolvedValueOnce({ data: { lugares: [] } });
    await expect(descobrirLugares({ lat: 0, lng: 0 }, 3)).rejects.toThrow('descobrir');
    await expect(descobrirLugares({ lat: 0, lng: 0 }, 3)).resolves.toEqual([]);
    expect(invoke).toHaveBeenCalledTimes(2);
  });
  it('une o mesmo comércio no OSM e Overture sem remover filiais distintas', async () => {
    const { reunirLugares } = await import('../mapa/descoberta');
    const base = { id: '1', nome: 'Clínica São José', categoria: 'clinica', lat: -22.76, lng: -43.45, distancia_km: 1 } as Lugar;
    const repetido = { ...base, id: '2', nome: 'Clinica Sao Jose', lat: -22.76001 };
    const filial = { ...base, id: '3', lat: -22.77, distancia_km: 2 };
    expect(reunirLugares([[base], [repetido, filial]])).toEqual([base, filial]);
  });
});

describe('importação pública regional', () => {
  it('rejeita coordenadas, raios e valores não numéricos antes da consulta', () => {
    for (const corpo of [{ lat: NaN, lng: 0 }, { lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: '0', lng: 0 }, { lat: 0, lng: 0, raioKm: 100 }]) {
      expect(() => validarRegiao(corpo)).toThrow('Região inválida');
    }
    expect(consultaOSM(validarRegiao({ lat: -22.76, lng: -43.45, raioKm: 3 }))).toContain('around:4000,-22.76,-43.45');
  });
  it('classifica serviços e áreas pet friendly e lê o centro dos polígonos', () => {
    const tipos: Record<string, string>[] = [
      { amenity: 'veterinary' }, { shop: 'pet' }, { shop: 'pet_grooming' },
      { amenity: 'animal_boarding', name: 'Creche Patinhas' }, { amenity: 'animal_boarding' },
      { leisure: 'dog_park' }, { amenity: 'restaurant', dog: 'yes' },
    ];
    const lugares = converterOSM(tipos.map((tags, id) => ({ type: 'way', id: id + 1, center: { lat: -22.76, lon: -43.45 }, tags: { name: 'Lugar', ...tags } })));
    expect(lugares.map((l) => l.categoria)).toEqual(['clinica', 'petshop', 'banho_tosa', 'creche', 'hotelzinho', 'parque', 'restaurante']);
    expect(lugares[0]).toMatchObject({ fonte: 'osm', fonte_id: 'way/1', lat: -22.76, lng: -43.45 });
  });
  it('ignora dados inválidos, duplicatas e restaurante sem confirmação de aceitar cães', () => {
    const base = { type: 'node', id: 1, lat: 0, lon: 0, tags: { name: 'Pet', shop: 'pet' } };
    expect(converterOSM([base, base, { ...base, id: 2, lat: NaN }, { ...base, id: 3, tags: { name: 'Restaurante', amenity: 'restaurant' } }])).toHaveLength(1);
    expect(converterOSM([{ ...base, tags: { ...base.tags, opening_hours: 'Mo-Fr 08:00-18:00; Sa 24/7' } }])[0].aberto_24h).toBe(false);
  });
});
