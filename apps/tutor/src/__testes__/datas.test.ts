import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { diaNoMes, somarMeses } from '../lib/datas';
import { campoParaIso, isoParaCampo, proximaOcorrencia, rotuloProximidade } from '../lembretes/types';
import { dataParaIso, idadeEmAnos } from '../pets/types';
import { diasAte, rotuloDose, somarDias } from '../saude/types';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-21T15:00:00'));
});
afterEach(() => vi.useRealTimers());

describe('próxima ocorrência do lembrete', () => {
  it('soma dia, semana, mês, ano ou o intervalo e mantém a hora', () => {
    expect(proximaOcorrencia('2026-10-21T09:30:00', 'diario', 0)).toBe('2026-10-22T09:30:00');
    expect(proximaOcorrencia('2026-10-28T09:30:00', 'semanal', 0)).toBe('2026-11-04T09:30:00');
    expect(proximaOcorrencia('2026-10-21T09:30:00', 'mensal', 0)).toBe('2026-11-21T09:30:00');
    expect(proximaOcorrencia('2026-10-21T09:30:00', 'anual', 0)).toBe('2027-10-21T09:30:00');
    expect(proximaOcorrencia('2026-10-21T09:30:00', 'customizado', 90)).toBe('2027-01-19T09:30:00');
  });

  it('mensal no dia 31 cai no último dia do mês seguinte (não pula para março)', () => {
    expect(proximaOcorrencia('2027-01-31T08:00:00', 'mensal', 0)).toBe('2027-02-28T08:00:00');
    expect(proximaOcorrencia('2028-01-31T08:00:00', 'mensal', 0)).toBe('2028-02-29T08:00:00');
    expect(proximaOcorrencia('2026-10-31T08:00:00', 'mensal', 0)).toBe('2026-11-30T08:00:00');
  });

  it('anual em 29 de fevereiro cai em 28 de fevereiro', () => {
    expect(proximaOcorrencia('2028-02-29T08:00:00', 'anual', 0)).toBe('2029-02-28T08:00:00');
  });

  it('sem repetição devolve a mesma data', () => {
    expect(proximaOcorrencia('2026-10-21T09:30:00', 'nao', 0)).toBe('2026-10-21T09:30:00');
  });
});

describe('datas dos formulários', () => {
  it('campo DD/MM/AAAA + hora vira ISO local e volta', () => {
    expect(campoParaIso('25/12/2026', '8:05')).toBe('2026-12-25T08:05:00');
    expect(campoParaIso('25/12', '08:00')).toBeNull();
    expect(isoParaCampo('2026-12-25T08:05:00')).toEqual({ data: '25/12/2026', hora: '08:05' });
  });

  it('data do pet: recusa dia ou mês fora do calendário', () => {
    expect(dataParaIso('05/03/2021')).toBe('2021-03-05');
    expect(dataParaIso('32/01/2021')).toBeNull();
    expect(dataParaIso('10/13/2021')).toBeNull();
  });

  it('idade do pet por extenso', () => {
    expect(idadeEmAnos('2023-10-21')).toBe('3 anos');
    expect(idadeEmAnos('2025-10-20')).toBe('1 ano');
    expect(idadeEmAnos('2026-07-10')).toBe('3 meses');
    expect(idadeEmAnos('2026-10-01')).toBe('menos de 1 mês');
  });
});

describe('vacinas e lembretes: quanto falta', () => {
  it('dias até a próxima dose e o rótulo de urgência', () => {
    expect(diasAte('2026-10-26')).toBe(5);
    expect(diasAte('2026-09-16')).toBe(-35);
    expect(rotuloDose('2026-09-16')).toEqual({ texto: 'vencida há 35d', urgencia: 'vencida' });
    expect(rotuloDose('2026-10-21')).toEqual({ texto: 'hoje', urgencia: 'hoje' });
    expect(rotuloDose('2026-11-05')).toEqual({ texto: 'em 15 dias', urgencia: 'perto' });
    expect(rotuloDose('2026-11-06').urgencia).toBe('ok');
    expect(rotuloDose(null).urgencia).toBe('nenhuma');
  });

  it('rótulo de proximidade do lembrete', () => {
    expect(rotuloProximidade('2026-10-20T09:00:00').urgencia).toBe('vencido');
    expect(rotuloProximidade('2026-10-22T09:00:00').texto).toBe('amanhã');
    expect(rotuloProximidade('2026-11-10T09:00:00').urgencia).toBe('mes');
  });

  it('somar dias atravessa mês e ano', () => {
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02');
  });
});

describe('dia no mês (sem estourar para o mês seguinte)', () => {
  it('31 num mês de 30 dias cai no dia 30, e dezembro + 1 vira janeiro', () => {
    expect(diaNoMes(2026, 10, 31).getDate()).toBe(30);
    expect(diaNoMes(2026, 12, 31).getMonth()).toBe(0);
    expect(diaNoMes(2026, 12, 31).getFullYear()).toBe(2027);
  });

  it('somar meses mantém a hora', () => {
    const data = somarMeses(new Date(2027, 0, 31, 8, 30), 1);
    expect([data.getMonth(), data.getDate(), data.getHours(), data.getMinutes()]).toEqual([1, 28, 8, 30]);
  });
});
