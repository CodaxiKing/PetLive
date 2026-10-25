import { beforeEach, describe, expect, it, vi } from 'vitest';

type Lote = { data?: { locations: { timestamp: number; coords: { latitude: number; longitude: number; accuracy: number | null } }[] }; error?: { message: string } };
const m = vi.hoisted(() => ({
  iniciar: vi.fn(), parar: vi.fn(), rodando: false, frente: vi.fn(), fundo: vi.fn(), servicos: vi.fn(), disponivel: vi.fn(),
  tarefa: null as null | ((lote: Lote) => Promise<void>), app: { currentState: 'active' }, plataforma: { OS: 'android' },
  constants: { executionEnvironment: 'standalone', expoConfig: { extra: { passeioSegundoPlano: true } } },
}));
vi.mock('react-native', () => ({ AppState: m.app, Platform: m.plataforma }));
vi.mock('expo-constants', () => ({ default: m.constants, ExecutionEnvironment: { StoreClient: 'storeClient' } }));
vi.mock('expo-task-manager', () => ({
  defineTask: (_nome: string, fn: (lote: Lote) => Promise<void>) => { m.tarefa = fn; }, isAvailableAsync: m.disponivel,
}));
vi.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: m.frente, requestBackgroundPermissionsAsync: m.fundo,
  hasServicesEnabledAsync: m.servicos, hasStartedLocationUpdatesAsync: async () => m.rodando,
  startLocationUpdatesAsync: m.iniciar, stopLocationUpdatesAsync: m.parar, Accuracy: { High: 4 },
}));
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); m.rodando = false; m.tarefa = null;
  m.app.currentState = 'active'; m.plataforma.OS = 'android';
  m.constants.executionEnvironment = 'standalone'; m.constants.expoConfig.extra.passeioSegundoPlano = true;
  m.frente.mockResolvedValue({ granted: true, android: { accuracy: 'fine' } });
  m.fundo.mockResolvedValue({ granted: true }); m.servicos.mockResolvedValue(true); m.disponivel.mockResolvedValue(true);
  m.iniciar.mockImplementation(async () => { m.rodando = true; });
  m.parar.mockImplementation(async () => { m.rodando = false; });
});
const posicao = (timestamp: number) => ({ timestamp, coords: { latitude: -22, longitude: -43, accuracy: 5 } });

describe('GPS Android com tela apagada', () => {
  it('só inicia por ação explícita, com notificação permanente e permissões concedidas', async () => {
    const { gpsSegundoPlano } = await import('../passeios/segundoPlano');
    expect(m.iniciar).not.toHaveBeenCalled(); expect(m.frente).not.toHaveBeenCalled();
    const remover = await gpsSegundoPlano.observar(vi.fn(), vi.fn());
    expect(m.iniciar).toHaveBeenCalledWith('petlive-passeio-gps-v1', expect.objectContaining({ foregroundService: expect.objectContaining({ killServiceOnDestroy: true }), timeInterval: 5000 }));
    await remover(); expect(m.parar).toHaveBeenCalledOnce();
  });
  it('não pede permissão em APK sem suporte, Expo Go ou iOS', async () => {
    const { gpsSegundoPlano } = await import('../passeios/segundoPlano');
    m.constants.expoConfig.extra.passeioSegundoPlano = false;
    await expect(gpsSegundoPlano.observar(vi.fn(), vi.fn())).rejects.toThrow('versão Android');
    m.constants.expoConfig.extra.passeioSegundoPlano = true; m.constants.executionEnvironment = 'storeClient';
    await expect(gpsSegundoPlano.observar(vi.fn(), vi.fn())).rejects.toThrow('versão Android');
    m.constants.executionEnvironment = 'standalone'; m.plataforma.OS = 'ios';
    await expect(gpsSegundoPlano.observar(vi.fn(), vi.fn())).rejects.toThrow('versão Android');
    expect(m.frente).not.toHaveBeenCalled();
  });
  it('recusa permissão negada, imprecisa e de segundo plano sem criar serviço', async () => {
    const { gpsSegundoPlano } = await import('../passeios/segundoPlano');
    m.frente.mockResolvedValueOnce({ granted: false });
    await expect(gpsSegundoPlano.observar(vi.fn(), vi.fn())).rejects.toThrow('Autorize');
    m.frente.mockResolvedValueOnce({ granted: true, android: { accuracy: 'coarse' } });
    await expect(gpsSegundoPlano.observar(vi.fn(), vi.fn())).rejects.toThrow('precisa');
    m.fundo.mockResolvedValueOnce({ granted: false });
    await expect(gpsSegundoPlano.observar(vi.fn(), vi.fn())).rejects.toThrow('tempo todo');
    expect(m.iniciar).not.toHaveBeenCalled();
  });
  it('recusa GPS desligado e retorno das configurações ainda em segundo plano', async () => {
    const { gpsSegundoPlano } = await import('../passeios/segundoPlano');
    m.servicos.mockResolvedValueOnce(false);
    await expect(gpsSegundoPlano.observar(vi.fn(), vi.fn())).rejects.toThrow('Ative o GPS');
    m.fundo.mockImplementationOnce(async () => { m.app.currentState = 'background'; return { granted: true }; });
    await expect(gpsSegundoPlano.observar(vi.fn(), vi.fn())).rejects.toThrow('Volte ao app');
    expect(m.iniciar).not.toHaveBeenCalled();
  });
  it('ordena lotes e aguarda a persistência de cada ponto antes de concluir a tarefa', async () => {
    const { gpsSegundoPlano } = await import('../passeios/segundoPlano');
    let liberar!: () => void;
    const espera = new Promise<void>((r) => { liberar = r; });
    const ponto = vi.fn().mockImplementationOnce(() => espera);
    const remover = await gpsSegundoPlano.observar(ponto, vi.fn());
    const lote = m.tarefa!({ data: { locations: [posicao(2000), posicao(1000)] } });
    expect(ponto).toHaveBeenCalledTimes(1); expect(ponto.mock.calls[0][0].instante).toBe(1000);
    liberar(); await lote; expect(ponto.mock.calls[1][0].instante).toBe(2000);
    await remover();
    await m.tarefa!({ data: { locations: [posicao(3000)] } });
    expect(ponto).toHaveBeenCalledTimes(2);
  });
  it('encerra serviço órfão após reiniciar sem restaurar a conta implicitamente', async () => {
    await import('../passeios/segundoPlano'); m.rodando = true;
    await m.tarefa!({ data: { locations: [posicao(1000)] } });
    expect(m.parar).toHaveBeenCalledOnce(); expect(m.iniciar).not.toHaveBeenCalled();
  });
  it('propaga erro da tarefa e impede dois recebedores simultâneos', async () => {
    const { gpsSegundoPlano } = await import('../passeios/segundoPlano');
    const erro = vi.fn(); const remover = await gpsSegundoPlano.observar(vi.fn(), erro);
    await expect(gpsSegundoPlano.observar(vi.fn(), vi.fn())).rejects.toThrow('Pause');
    await m.tarefa!({ error: { message: 'erro nativo' } });
    expect(erro).toHaveBeenCalledWith(expect.stringContaining('interrompido')); await remover();
  });
  it('falha ao iniciar não deixa serviço ou recebedor presos e permite nova tentativa', async () => {
    const { gpsSegundoPlano } = await import('../passeios/segundoPlano');
    m.iniciar.mockRejectedValueOnce(new Error('falha nativa'));
    await expect(gpsSegundoPlano.observar(vi.fn(), vi.fn())).rejects.toThrow('falha nativa');
    const remover = await gpsSegundoPlano.observar(vi.fn(), vi.fn()); await remover();
  });
  it('remoção repetida de uma sessão anterior não desliga nem recebe pontos da nova sessão', async () => {
    const { gpsSegundoPlano } = await import('../passeios/segundoPlano');
    const antigo = vi.fn(), novo = vi.fn();
    const removerAntigo = await gpsSegundoPlano.observar(antigo, vi.fn());
    await removerAntigo();
    const removerNovo = await gpsSegundoPlano.observar(novo, vi.fn());
    const paradas = m.parar.mock.calls.length;
    await removerAntigo();
    expect(m.parar).toHaveBeenCalledTimes(paradas);
    await m.tarefa!({ data: { locations: [posicao(4000)] } });
    expect(antigo).not.toHaveBeenCalled(); expect(novo).toHaveBeenCalledOnce();
    await removerNovo();
  });
});
