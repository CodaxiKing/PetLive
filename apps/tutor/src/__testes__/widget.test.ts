import { describe, expect, it, vi } from 'vitest';
import { escolherProximo, textoData, textoHorario } from '../widget/proximo';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));
vi.mock('../lib/supabase', () => ({ supabase: {} }));

const agora = new Date(2026, 9, 25, 13, 0);
const remedio = (horarios: string[], p: Record<string, unknown> = {}) => ({
  id: 'm1', pet_id: 'pet', nome: 'Amoxicilina', dose: '1 comprimido', horarios, inicio: '2026-10-01', fim: null, pets: { nome: 'Rex' }, ...p,
});
const vacina = (nome: string, proxima_dose: string) => ({ pet_id: 'pet', nome, proxima_dose, pets: { nome: 'Rex' } });

describe('widget: próxima dose ou vacina', () => {
  it('mantém a dose de ontem dentro de duas horas, inclusive no último dia do tratamento', () => {
    const madrugada = new Date(2026, 9, 26, 0, 30);
    const p = escolherProximo([remedio(['23:30'], { fim: '2026-10-25' })], new Set(), [], madrugada);
    expect(p).toMatchObject({ tipo: 'dose', prevista_para: new Date(2026, 9, 25, 23, 30).toISOString() });
    expect(escolherProximo([remedio(['21:00'], { fim: '2026-10-25' })], new Set(), [], madrugada)).toEqual({ tipo: 'nada' });
  });
  it('mostra a dose atrasada há menos de 2 horas antes da próxima', () => {
    const p = escolherProximo([remedio(['12:00', '20:00'])], new Set(), [], agora);
    expect(p).toMatchObject({ tipo: 'dose', remedio: 'Amoxicilina' });
    expect(p.tipo === 'dose' && new Date(p.prevista_para).getHours()).toBe(12);
  });

  it('pula a dose já dada', () => {
    const dada = new Date(2026, 9, 25, 12, 0).getTime();
    const p = escolherProximo([remedio(['12:00', '20:00'])], new Set([`m1@${dada}`]), [], agora);
    expect(p.tipo === 'dose' && new Date(p.prevista_para).getHours()).toBe(20);
  });

  it('sem dose em 24 h, mostra a próxima vacina', () => {
    const p = escolherProximo([remedio(['08:00'], { fim: '2026-10-24' })], new Set(), [vacina('V10', '2026-11-02'), vacina('Raiva', '2026-10-30')], agora);
    expect(p).toMatchObject({ tipo: 'vacina', vacina: 'Raiva' });
  });

  it('sem nada, fica em dia', () => {
    expect(escolherProximo([], new Set(), [vacina('V10', '2026-10-01')], agora)).toEqual({ tipo: 'nada' });
  });

  it('escreve horário e data', () => {
    expect(textoHorario(new Date(2026, 9, 25, 20, 0).toISOString(), agora)).toBe('às 20:00');
    expect(textoHorario(new Date(2026, 9, 26, 8, 5).toISOString(), agora)).toBe('amanhã às 08:05');
    expect(textoHorario(new Date(2026, 9, 25, 12, 0).toISOString(), agora)).toBe('atrasada (12:00)');
    expect(textoData('2026-10-26', agora)).toBe('amanhã');
    expect(textoData('2026-10-30', agora)).toBe('em 5 dias');
    expect(textoData('2027-01-10', agora)).toBe('em 10/01');
  });
});
