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
  it('mostra descobertas válidas antes do banco responder e filtra raio, categoria e 24h', async () => {
    let concluirBanco!: (r: { data: never[]; error: null }) => void;
    rpc.mockReturnValue(new Promise((resolve) => { concluirBanco = resolve; }));
    vi.mocked(descobrirLugares).mockResolvedValue([
      { id: 'a', nome: 'Clínica perto', categoria: 'clinica', lat: 0.001, lng: 0, aberto_24h: true },
      { id: 'b', nome: 'Clínica distante', categoria: 'clinica', lat: 1, lng: 0, aberto_24h: true },
      { id: 'c', nome: 'Petshop', categoria: 'petshop', lat: 0.001, lng: 0, aberto_24h: true },
      { id: 'd', nome: 'Clínica diurna', categoria: 'clinica', lat: 0.001, lng: 0, aberto_24h: false },
    ] as Awaited<ReturnType<typeof descobrirLugares>>);
    const aoCarregar = vi.fn();
    const consulta = buscarLugares({ lat: 0, lng: 0, categoria: 'clinica', raioKm: 3, aberto24h: true, aoCarregar });
    await vi.waitFor(() => expect(aoCarregar).toHaveBeenCalledOnce());
    expect(aoCarregar.mock.calls[0][0].map((l: { id: string }) => l.id)).toEqual(['a']);
    concluirBanco({ data: [], error: null });
    expect((await consulta).map((l) => l.id)).toEqual(['a']);
  });
  it('Todos aplica a busca por nome também aos pins parciais pet friendly', async () => {
    const parque = { id: 'p', nome: 'Parque do Lago', categoria: 'parque', lat: 0.001, lng: 0 };
    const restaurante = { id: 'r', nome: 'Restaurante', categoria: 'restaurante', lat: 0.001, lng: 0 };
    rpc.mockResolvedValue({ data: [parque, restaurante], error: null });
    let concluir!: (r: Awaited<ReturnType<typeof descobrirLugares>>) => void;
    const pendente = new Promise<Awaited<ReturnType<typeof descobrirLugares>>>((resolve) => { concluir = resolve; });
    vi.mocked(descobrirLugares).mockReturnValue(pendente);
    const aoCarregar = vi.fn();
    const consulta = buscarLugares({ lat: 0, lng: 0, busca: 'lago', incluirPetFriendly: true, aoCarregar });
    await vi.waitFor(() => expect(aoCarregar).toHaveBeenCalled());
    expect(aoCarregar.mock.calls.every(([lista]) => lista.every((l: { id: string }) => l.id === 'p'))).toBe(true);
    concluir([]);
    expect((await consulta).map((l) => l.id)).toEqual(['p']);
  });
  it('descoberta sem resultado para o filtro não encerra o carregamento com pins de outra categoria', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    vi.mocked(descobrirLugares).mockResolvedValue([
      { id: 'p', nome: 'Parque', categoria: 'parque', lat: 0.001, lng: 0 },
    ] as Awaited<ReturnType<typeof descobrirLugares>>);
    const aoCarregar = vi.fn();
    expect(await buscarLugares({ lat: 0, lng: 0, categoria: 'clinica', aoCarregar })).toEqual([]);
    expect(aoCarregar).not.toHaveBeenCalled();
  });
});
