import { describe, expect, it, vi } from 'vitest';
import { concluirPasseio, duracaoPasseio, novoPasseio, pausarPasseio, registrarPonto, retomarPasseio, type AmostraGps } from '../passeios/passeio';
import { GravadorPasseio, type GpsPasseio } from '../passeios/gravador';
import { RepositorioPasseios } from '../passeios/repositorio';
import { desenhoTrajeto } from '../passeios/trajeto';

const inicio = Date.parse('2026-10-24T12:00:00Z');
const amostra = (instante: number, lat = -22.75, precisao = 5): AmostraGps => ({ lat, lng: -43.45, instante, precisao });
const novo = () => novoPasseio('passeio-1', 'tutor-a', 'pet-a', 'Mia', inicio);

describe('registro do trajeto', () => {
  it('mede distância real entre pontos e não soma tempo pausado', () => {
    let p = registrarPonto(novo(), amostra(inicio), inicio);
    p = registrarPonto(p, amostra(inicio + 10000, -22.7499), inicio + 10000);
    expect(p.distanciaM).toBeCloseTo(11.12, 1);
    p = pausarPasseio(p, inicio + 20000);
    expect(duracaoPasseio(p, inicio + 60000)).toBe(20000);
    p = retomarPasseio(p, inicio + 60000);
    const primeiroRetorno = registrarPonto(p, amostra(inicio + 61000, -22.74), inicio + 61000);
    expect(primeiroRetorno.distanciaM).toBe(p.distanciaM);
    expect(primeiroRetorno.pontos.at(-1)?.trecho).toBe(1);
    expect(concluirPasseio(primeiroRetorno, inicio + 70000)).toMatchObject({ status: 'concluido', duracaoMs: 30000, ativoDesde: null });
  });
  it('ignora jitter, GPS impreciso, saltos, amostras antigas, futuras ou fora da ordem', () => {
    const p = registrarPonto(novo(), amostra(inicio), inicio);
    for (const ponto of [amostra(inicio + 10000, -22.75, 100), amostra(inicio + 10000, -22.749999),
      amostra(inicio + 1000, -20), amostra(inicio - 1000), amostra(inicio + 100000),
      amostra(inicio + 10000, Number.NaN), { ...amostra(inicio + 10000), lng: 200 }]) {
      expect(registrarPonto(p, ponto, inicio + 10000)).toBe(p);
    }
    expect(registrarPonto(p, amostra(inicio + 1000), inicio + 60000)).toBe(p);
    expect(registrarPonto(p, amostra(inicio), inicio)).toBe(p);
  });
  it('não liga posições através de perda longa do sinal nem grava durante pausa ou após finalizar', () => {
    const p = registrarPonto(novo(), amostra(inicio), inicio);
    const recuperado = registrarPonto(p, amostra(inicio + 60000, -22.74), inicio + 60000);
    expect(recuperado.distanciaM).toBe(0);
    expect(recuperado.trecho).toBe(1);
    for (const fechado of [pausarPasseio(p, inicio + 1000), concluirPasseio(p, inicio + 1000)]) {
      expect(registrarPonto(fechado, amostra(inicio + 10000, -22.7499), inicio + 10000)).toBe(fechado);
    }
  });
});

function ambiente() {
  let agora = inicio, sequencia = 0;
  const mapa = new Map<string, string>();
  const armazenamento = { getItem: vi.fn(async (chave: string) => mapa.get(chave) ?? null), setItem: vi.fn(async (chave: string, texto: string) => { mapa.set(chave, texto); }) };
  const repo = new RepositorioPasseios('tutor-a', armazenamento);
  let gpsPonto: (p: AmostraGps) => void = () => undefined;
  const remover = vi.fn();
  const gps: GpsPasseio = { observar: vi.fn(async (fn) => { gpsPonto = fn; return remover; }) };
  const gravador = new GravadorPasseio(repo, gps, () => agora, () => `passeio-${++sequencia}`);
  return { gravador, repo, armazenamento, mapa, remover, gps, tempo: (n: number) => { agora = inicio + n; }, ponto: (n: number, lat = -22.75) => gpsPonto(amostra(inicio + n, lat)) };
}

describe('persistência e ciclo de vida do passeio', () => {
  it('aguarda a parada assíncrona do GPS e ignora pontos recebidos depois de pausar', async () => {
    const a = ambiente();
    let encerrar!: () => void;
    const espera = new Promise<void>((r) => { encerrar = r; });
    vi.mocked(a.gps.observar).mockImplementationOnce(async (fn) => {
      a.gps.observar = vi.fn(async () => () => undefined);
      // Usa a referência recebida para simular um lote tardio do serviço.
      const depois = () => fn(amostra(inicio + 1000));
      return () => { depois(); return espera; };
    });
    await a.gravador.carregar(); await a.gravador.iniciar({ id: 'pet-a', nome: 'Mia' });
    a.tempo(2000);
    let terminou = false;
    const pausa = a.gravador.pausar().then(() => { terminou = true; });
    await Promise.resolve(); expect(terminou).toBe(false);
    encerrar(); await pausa;
    expect((await a.repo.carregar())[0]).toMatchObject({ status: 'pausado', pontos: [] });
  });
  it('preserva a função de parada para tentar novamente se o serviço nativo falhar', async () => {
    const a = ambiente();
    const remover = vi.fn().mockRejectedValueOnce(new Error('serviço ocupado')).mockResolvedValue(undefined);
    vi.mocked(a.gps.observar).mockResolvedValueOnce(remover);
    await a.gravador.carregar(); await a.gravador.iniciar({ id: 'pet-a', nome: 'Mia' });
    await a.gravador.pausar();
    expect(a.gravador.snapshot().erro).toContain('encerrar o GPS');
    expect((await a.repo.carregar())[0].status).toBe('pausado');
    await a.gravador.pausar();
    expect(remover).toHaveBeenCalledTimes(2); expect(a.gravador.snapshot().erro).toBeNull();
  });
  it('preserva os últimos pontos já recebidos quando finalizar vem antes de a escrita terminar', async () => {
    const a = ambiente(); await a.gravador.carregar(); await a.gravador.iniciar({ id: 'pet-a', nome: 'Mia' });
    a.tempo(1000); a.ponto(1000);
    a.tempo(11000); a.ponto(11000, -22.7499);
    await a.gravador.finalizar();
    const [salvo] = await a.repo.carregar();
    expect(salvo.status).toBe('concluido');
    expect(salvo.pontos).toHaveLength(2);
    expect(salvo.distanciaM).toBeGreaterThan(10);
  });
  it('grava offline, serializa pontos e finalização, e mantém uma única sessão em aberto', async () => {
    const a = ambiente(); await a.gravador.carregar();
    await a.gravador.iniciar({ id: 'pet-a', nome: 'Mia' });
    a.tempo(1000); a.ponto(1000);
    a.tempo(11000); a.ponto(11000, -22.7499);
    await a.gravador.checkpoint();
    expect((await a.repo.carregar())[0].pontos).toHaveLength(2);
    await a.gravador.iniciar({ id: 'pet-b', nome: 'Bento' });
    expect(a.gravador.snapshot().passeios).toHaveLength(1);
    await a.gravador.finalizar();
    await a.gravador.finalizar();
    const salvos = await a.repo.carregar();
    expect(salvos).toHaveLength(1);
    expect(salvos[0]).toMatchObject({ status: 'concluido', duracaoMs: 11000 });
    expect(salvos[0].distanciaM).toBeGreaterThan(10);
  });
  it('recupera sessão pausada no último checkpoint, sem contar horas com o app fechado', async () => {
    const a = ambiente(); await a.gravador.carregar(); await a.gravador.iniciar({ id: 'pet-a', nome: 'Mia' });
    a.tempo(15000); await a.gravador.checkpoint();
    const recuperado = new GravadorPasseio(a.repo, a.gps, () => inicio + 3600000, () => 'novo');
    await recuperado.carregar();
    expect(recuperado.snapshot().passeios[0]).toMatchObject({ status: 'pausado', duracaoMs: 15000 });
    expect(a.gps.observar).toHaveBeenCalledTimes(1);
  });
  it('cancela um GPS que termina de iniciar depois de sair da tela', async () => {
    const a = ambiente(); await a.gravador.carregar();
    let resolver!: (remover: () => void) => void;
    a.gps.observar = vi.fn(() => new Promise<() => void>((resolve) => { resolver = resolve; }));
    const iniciar = a.gravador.iniciar({ id: 'pet-a', nome: 'Mia' });
    await vi.waitFor(() => expect(a.gps.observar).toHaveBeenCalled());
    const pausa = a.gravador.pausar('Saiu da tela');
    resolver(a.remover);
    await iniciar; await pausa;
    expect(a.remover).toHaveBeenCalledTimes(1);
    expect(a.gravador.snapshot().passeios[0].status).toBe('pausado');
  });
  it('não cria sessão sem permissão de GPS e permite nova tentativa', async () => {
    const a = ambiente(); await a.gravador.carregar();
    vi.mocked(a.gps.observar).mockRejectedValueOnce(new Error('Permissão negada'));
    await a.gravador.iniciar({ id: 'pet-a', nome: 'Mia' });
    expect(a.gravador.snapshot().passeios).toHaveLength(0);
    expect(a.gravador.snapshot().erro).toContain('Permissão');
    await a.gravador.iniciar({ id: 'pet-a', nome: 'Mia' });
    expect(a.gravador.snapshot().passeios[0].status).toBe('gravando');
  });
  it('não anuncia conclusão quando o armazenamento falha e permite salvar novamente', async () => {
    const a = ambiente(); await a.gravador.carregar(); await a.gravador.iniciar({ id: 'pet-a', nome: 'Mia' });
    a.tempo(10000);
    a.armazenamento.setItem.mockRejectedValueOnce(new Error('Espaço insuficiente'));
    await a.gravador.finalizar();
    expect(a.gravador.snapshot().erro).toContain('Espaço');
    expect(a.gravador.snapshot().passeios[0].status).toBe('pausado');
    await a.gravador.finalizar();
    expect((await a.repo.carregar())[0]).toMatchObject({ status: 'concluido', duracaoMs: 10000 });
  });
  it('separa contas e recusa arquivo corrompido ou de outra conta sem sobrescrever', async () => {
    const a = ambiente(); await a.gravador.carregar(); await a.gravador.iniciar({ id: 'pet-a', nome: 'Mia' });
    expect(await new RepositorioPasseios('tutor-b', a.armazenamento).carregar()).toEqual([]);
    const escritaAntes = a.armazenamento.setItem.mock.calls.length;
    a.mapa.set(a.repo.chave, JSON.stringify([{ ...novo(), tutorId: 'tutor-b' }]));
    const outraInstancia = new GravadorPasseio(a.repo, a.gps, () => inicio, () => 'novo');
    await outraInstancia.carregar();
    expect(outraInstancia.snapshot()).toMatchObject({ carregando: true });
    expect(a.armazenamento.setItem).toHaveBeenCalledTimes(escritaAntes);
    a.mapa.set(a.repo.chave, '{invalido');
    await expect(a.repo.carregar()).rejects.toThrow();
    expect(a.mapa.get(a.repo.chave)).toBe('{invalido');
  });
  it('mostra aviso de falha ao salvar o GPS e não reinicia o observador após pausar', async () => {
    const a = ambiente(); await a.gravador.carregar(); await a.gravador.iniciar({ id: 'pet-a', nome: 'Mia' });
    a.armazenamento.setItem.mockRejectedValueOnce(new Error('Disco cheio'));
    a.tempo(1000); a.ponto(1000);
    await vi.waitFor(() => expect(a.gravador.snapshot().passeios[0].status).toBe('pausado'));
    expect(a.gravador.snapshot().aviso).toContain('Falha');
    const contagem = a.gravador.snapshot().passeios[0].pontos.length;
    a.tempo(10000); a.ponto(10000, -22.7499); await a.gravador.checkpoint();
    expect(a.gravador.snapshot().passeios[0].pontos).toHaveLength(contagem);
    expect(a.remover).toHaveBeenCalledTimes(1);
  });
  it('não inicia duas sessões com toque repetido e apaga os dados locais após pausa', async () => {
    const a = ambiente(); await a.gravador.carregar();
    await Promise.all([a.gravador.iniciar({ id: 'pet-a', nome: 'Mia' }), a.gravador.iniciar({ id: 'pet-a', nome: 'Mia' })]);
    expect(a.gravador.snapshot().passeios).toHaveLength(1);
    expect(a.gps.observar).toHaveBeenCalledTimes(1);
    await a.gravador.pausar(); await a.gravador.apagar();
    expect(await a.repo.carregar()).toEqual([]);
  });
});

describe('desenho do trajeto', () => {
  it('separa trechos sem conectar pausas e funciona com somente um ponto', () => {
    const pontos = [{ ...amostra(inicio), trecho: 0 }, { ...amostra(inicio + 10000, -22.7499), trecho: 0 }, { ...amostra(inicio + 20000, -22.74), trecho: 1 }];
    const desenho = desenhoTrajeto(pontos);
    expect(desenho.caminho.match(/M/g)).toHaveLength(2);
    expect(desenho.caminho.match(/L/g)).toHaveLength(1);
    expect(desenho.caminho).not.toMatch(/NaN|Infinity/);
    expect(desenhoTrajeto([]).inicio).toBeNull();
    expect(desenhoTrajeto(pontos.slice(0, 1)).inicio).toEqual({ x: 160, y: 90 });
  });
});
