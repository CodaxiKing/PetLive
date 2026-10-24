import { describe, expect, it } from 'vitest';
import { novoPasseio, type Passeio } from '../passeios/passeio';
import { progressoSeloPasseios } from '../passeios/selo';

const data = (dia: number, mes = 10, ano = 2026) => new Date(ano, mes - 1, dia, 12).getTime();
const agora = data(24);
function passeio(id: string, fim: number): Passeio {
  return { ...novoPasseio(id, 'tutor', 'pet', 'Luna', fim - 60000), status: 'concluido', fim, ativoDesde: null };
}
const completos = () => [21, 28, 5, 12].flatMap((dia, semana) => Array.from({ length: 3 }, (_, i) =>
  passeio(`${semana}-${i}`, data(dia, semana < 2 ? 9 : 10) + i * 60000)));

describe('selo Passeios em dia', () => {
  it('exige três em cada uma das quatro semanas completas, sem depender de Premium', () => {
    const p = progressoSeloPasseios(completos(), 'tutor', 'pet', agora);
    expect(p.conquistado).toBe(true);
    expect(p.semanas.map((s) => s.quantidade)).toEqual([3, 3, 3, 3]);
    expect(progressoSeloPasseios(completos().slice(1), 'tutor', 'pet', agora).conquistado).toBe(false);
  });
  it('não troca regularidade por total nem conta a semana atual', () => {
    const lista = Array.from({ length: 12 }, (_, i) => passeio(String(i), data(12) + i * 60000));
    lista.push(passeio('atual', data(20)));
    const p = progressoSeloPasseios(lista, 'tutor', 'pet', agora);
    expect(p.conquistado).toBe(false);
    expect(p.semanas.map((s) => s.quantidade)).toEqual([0, 0, 0, 12]);
  });
  it('isola conta e pet e ignora pausados, duplicatas, datas inválidas e futuras', () => {
    const base = passeio('a', data(12));
    const lista = [base, base, { ...base, id: 'b', tutorId: 'outro' }, { ...base, id: 'c', petId: 'outro' },
      { ...base, id: 'd', status: 'pausado' as const }, { ...base, id: 'e', fim: null },
      { ...base, id: 'f', fim: NaN }, { ...base, id: 'g', fim: data(25) }, { ...base, id: 'h', inicio: data(15) }];
    expect(progressoSeloPasseios(lista, 'tutor', 'pet', agora).semanas.map((s) => s.quantidade)).toEqual([0, 0, 0, 1]);
    expect(progressoSeloPasseios([], 'tutor', 'pet', agora).conquistado).toBe(false);
  });
  it('inclui segunda à meia-noite e exclui o início da semana atual', () => {
    const inicio = new Date(2026, 8, 21).getTime(), fim = new Date(2026, 9, 19).getTime();
    const p = progressoSeloPasseios([passeio('antes', inicio - 1), passeio('inicio', inicio),
      passeio('domingo', fim - 1), passeio('segunda', fim)], 'tutor', 'pet', agora);
    expect(p.semanas.map((s) => s.quantidade)).toEqual([1, 0, 0, 1]);
  });
  it('recalcula ao virar a semana ou apagar registros, sem gravar uma conquista permanente', () => {
    expect(progressoSeloPasseios(completos(), 'tutor', 'pet', data(26)).conquistado).toBe(false);
    expect(progressoSeloPasseios([], 'tutor', 'pet', agora).conquistado).toBe(false);
  });
  it('atravessa ano e fevereiro usando datas civis', () => {
    const p = progressoSeloPasseios([], 'tutor', 'pet', data(1, 1, 2027));
    expect(new Date(p.semanas[0].inicio).getFullYear()).toBe(2026);
    const fevereiro = progressoSeloPasseios([], 'tutor', 'pet', data(1, 3, 2028));
    expect(new Date(fevereiro.semanas.at(-1)!.fim).getDate()).toBe(28);
    expect(() => progressoSeloPasseios([], 'tutor', 'pet', NaN)).toThrow();
  });
});
