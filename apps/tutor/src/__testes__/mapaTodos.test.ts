import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buscarLugares, buscarPetFriendly } from '../mapa/lugares';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }));
beforeEach(() => { vi.clearAllMocks(); });
describe('filtros do mapa de lugares', () => {
  it('Todos reúne serviços e pet friendly por distância sem duplicar pins', async () => {
    const clinica = { id: 'clinica-1', nome: 'Clínica', distancia_km: 2 };
    const parque = { id: 'parque-1', nome: 'Parque', distancia_km: 1 };
    rpc.mockImplementation((_nome, args) => Promise.resolve({ data: args.p_grupo ? [parque, clinica] : [clinica], error: null }));
    expect(await buscarLugares({ lat: -23, lng: -46, raioKm: 3, incluirPetFriendly: true })).toEqual([parque, clinica]);
    expect(rpc).toHaveBeenCalledWith('lugares_por_perto', expect.objectContaining({ p_grupo: 'pet_friendly', p_raio_km: 3 }));
  });
  it('respeita nome e categoria selecionados', async () => {
    rpc.mockImplementation((_nome, args) => Promise.resolve({ data: args.p_grupo ? [{ id: 'p', nome: 'Parque' }] : [{ id: 'c', nome: 'Clínica' }], error: null }));
    expect(await buscarLugares({ lat: 0, lng: 0, busca: 'parque', incluirPetFriendly: true })).toEqual([{ id: 'p', nome: 'Parque' }]);
    rpc.mockClear();
    await buscarLugares({ lat: 0, lng: 0, categoria: 'clinica', incluirPetFriendly: true });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('propaga falhas do serviço para não exibir um falso estado vazio', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Serviço indisponível' } });
    await expect(buscarPetFriendly({ lat: 0, lng: 0 }, 10)).rejects.toThrow('Serviço indisponível');
  });
});
