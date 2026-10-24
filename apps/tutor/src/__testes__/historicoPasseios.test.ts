import { describe, expect, it, vi } from 'vitest';
import { concluirPasseio, novoPasseio, type Passeio } from '../passeios/passeio';
import { filtrarHistorico, formatarTempoPasseio, limitesHistorico, passeiosVisiveis, progressoMeta, totaisPasseios } from '../passeios/historico';
import { interpretarMeta, RepositorioMetaPasseios } from '../passeios/meta';

const data = (ano: number, mes: number, dia: number, hora = 12) => new Date(ano, mes - 1, dia, hora).getTime();
const agora = data(2026, 10, 26); // Segunda-feira.
function passeio(id: string, fim: number, petId = 'pet-a', tutorId = 'tutor-a'): Passeio {
  return { ...concluirPasseio(novoPasseio(id, tutorId, petId, petId, fim - 600000), fim), distanciaM: 1000 };
}

describe('histórico e totais de passeios', () => {
  it('só inclui concluídos da conta, ordena por finalização e não altera os registros originais', () => {
    const lista = [passeio('ontem', agora - 86400000), passeio('hoje', agora), passeio('futuro', agora + 1000),
      passeio('outra-conta', agora, 'pet-a', 'tutor-b'), novoPasseio('ativo', 'tutor-a', 'pet-a', 'Mia', agora),
      { ...passeio('sem-fim', agora), fim: null }];
    expect(passeiosVisiveis(lista, 'tutor-a', agora, true).map((p) => p.id)).toEqual(['hoje', 'ontem']);
    expect(lista[0].id).toBe('ontem');
  });
  it('limita grátis a hoje mais 29 dias civis, sem apagar o histórico antigo', () => {
    const limite = limitesHistorico(agora).gratis;
    const lista = [passeio('limite', limite), passeio('antigo', limite - 1), passeio('hoje', agora)];
    expect(passeiosVisiveis(lista, 'tutor-a', agora, false).map((p) => p.id)).toEqual(['hoje', 'limite']);
    expect(passeiosVisiveis(lista, 'tutor-a', agora, true)).toHaveLength(3);
    expect(lista).toHaveLength(3);
  });
  it('trata segunda-feira, domingo e virada de ano sem misturar semanas ou meses', () => {
    const segunda = limitesHistorico(agora).semana;
    expect(segunda).toBe(data(2026, 10, 26, 0));
    expect(limitesHistorico(data(2026, 11, 1)).semana).toBe(segunda);
    expect(limitesHistorico(data(2026, 1, 1)).semana).toBe(data(2025, 12, 29, 0));
    expect(limitesHistorico(data(2026, 1, 1)).mes).toBe(data(2026, 1, 1, 0));
    const lista = [passeio('domingo', segunda - 1), passeio('segunda', segunda), passeio('inicio-mes', data(2026, 10, 1, 0))];
    expect(filtrarHistorico(lista, 'semana', null, agora).map((p) => p.id)).toEqual(['segunda']);
    expect(filtrarHistorico(lista, 'mes', null, agora)).toHaveLength(3);
  });
  it('soma tempo ativo e distância só do filtro, mantendo a meta global da conta', () => {
    const lista = passeiosVisiveis([passeio('a', agora), passeio('b', agora, 'pet-b')], 'tutor-a', agora, false);
    const doPet = totaisPasseios(filtrarHistorico(lista, 'semana', 'pet-a', agora));
    expect(doPet).toEqual({ quantidade: 1, distanciaM: 1000, duracaoMs: 600000 });
    expect(progressoMeta(totaisPasseios(lista).distanciaM, 5)).toBe(40);
    expect(progressoMeta(6000, 5)).toBe(100);
    expect(progressoMeta(1000, null)).toBe(0);
    expect(totaisPasseios([])).toEqual({ quantidade: 0, distanciaM: 0, duracaoMs: 0 });
    expect(formatarTempoPasseio(65 * 60000)).toBe('1 h 5 min');
  });
  it('reaplica o limite grátis quando Premium deixa de estar confirmado', () => {
    const lista = [passeio('antigo', data(2026, 8, 1)), passeio('recente', agora)];
    expect(passeiosVisiveis(lista, 'tutor-a', agora, true)).toHaveLength(2);
    expect(passeiosVisiveis(lista, 'tutor-a', agora, false).map((p) => p.id)).toEqual(['recente']);
  });
});

describe('meta semanal local', () => {
  it('aceita vírgula ou ponto, permite remover e recusa valores inválidos', () => {
    expect(interpretarMeta(' 2,5 ')).toBe(2.5);
    expect(interpretarMeta('2.5')).toBe(2.5);
    expect(interpretarMeta('')).toBeNull();
    for (const valor of ['0', '-1', '1000', '1e2', '2,55', 'NaN', 'Infinity', ',5']) expect(() => interpretarMeta(valor)).toThrow();
  });
  it('persiste por conta e não perde a meta anterior quando falha ao salvar', async () => {
    const dados = new Map<string, string>();
    const storage = { getItem: vi.fn(async (chave: string) => dados.get(chave) ?? null), setItem: vi.fn(async (chave: string, valor: string) => { dados.set(chave, valor); }) };
    const a = new RepositorioMetaPasseios('tutor-a', storage), b = new RepositorioMetaPasseios('tutor-b', storage);
    await a.salvar(5); expect(await a.carregar()).toBe(5); expect(await b.carregar()).toBeNull();
    storage.setItem.mockRejectedValueOnce(new Error('Sem espaço'));
    await expect(a.salvar(10)).rejects.toThrow('Sem espaço');
    expect(await a.carregar()).toBe(5);
    await a.salvar(null); expect(await a.carregar()).toBeNull();
  });
  it('preserva configuração ilegível e não grava dados inválidos', async () => {
    const storage = { getItem: vi.fn(async () => '{corrompido'), setItem: vi.fn() };
    const repo = new RepositorioMetaPasseios('tutor-a', storage);
    await expect(repo.carregar()).rejects.toThrow();
    await expect(repo.salvar(Number.NaN)).rejects.toThrow('inválida');
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
