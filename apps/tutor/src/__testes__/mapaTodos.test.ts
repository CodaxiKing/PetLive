import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buscarLugares, buscarPetFriendly } from '../mapa/lugares';
import { descobrirLugares } from '../mapa/descoberta';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('../mapa/descoberta', async (original) => ({ ...await original<object>(), descobrirLugares: vi.fn().mockResolvedValue([]) }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(descobrirLugares).mockResolvedValue([]); });
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
  it('mostra dados públicos mesmo com banco vazio, respeitando categoria, raio e 24h', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    vi.mocked(descobrirLugares).mockResolvedValue([
      { id: 'a', nome: 'Veterinária', categoria: 'clinica', lat: 0.001, lng: 0, aberto_24h: true },
      { id: 'b', nome: 'Banho e tosa', categoria: 'banho_tosa', lat: 0.001, lng: 0 },
      { id: 'c', nome: 'Distante', categoria: 'clinica', lat: 1, lng: 0, aberto_24h: true },
    ] as Awaited<ReturnType<typeof descobrirLugares>>);
    expect((await buscarLugares({ lat: 0, lng: 0, categoria: 'clinica', raioKm: 3, aberto24h: true })).map((l) => l.id)).toEqual(['a']);
  });
  it('mantém lugares importados quando o provedor está indisponível', async () => {
    rpc.mockResolvedValue({ data: [{ id: 'a', nome: 'Petshop' }], error: null });
    vi.mocked(descobrirLugares).mockRejectedValue(new Error('Provedor indisponível'));
    expect(await buscarLugares({ lat: 0, lng: 0 })).toEqual([{ id: 'a', nome: 'Petshop' }]);
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(buscarLugares({ lat: 0, lng: 0 })).rejects.toThrow('Provedor indisponível');
  });
  it('Todos mantém os serviços mesmo se a busca pet friendly falhar', async () => {
    rpc.mockImplementation((_nome, args) => Promise.resolve({ data: args.p_grupo === 'pet_friendly' ? [] : [{ id: 'c', nome: 'Clínica' }], error: null }));
    vi.mocked(descobrirLugares).mockRejectedValue(new Error('Provedor indisponível'));
    expect(await buscarLugares({ lat: 0, lng: 0, incluirPetFriendly: true })).toEqual([{ id: 'c', nome: 'Clínica' }]);
  });
  it('mostra os dados já importados enquanto o provedor público ainda está carregando', async () => {
    const lista = [{ id: 'a', nome: 'Petshop' }];
    rpc.mockResolvedValue({ data: lista, error: null });
    let concluir!: (dados: Awaited<ReturnType<typeof descobrirLugares>>) => void;
    vi.mocked(descobrirLugares).mockReturnValue(new Promise((resolve) => { concluir = resolve; }));
    const aoCarregar = vi.fn();
    const consulta = buscarLugares({ lat: 0, lng: 0, aoCarregar });
    await vi.waitFor(() => expect(aoCarregar).toHaveBeenCalledWith(lista));
    concluir([]);
    expect(await consulta).toEqual(lista);
  });
});
