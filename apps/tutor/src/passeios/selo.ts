import { limitesHistorico } from './historico';
import type { Passeio } from './passeio';

/** Quatro semanas civis completas, de segunda a domingo; sem ranking ou meta clínica. */
export function progressoSeloPasseios(passeios: Passeio[], tutorId: string, petId: string, agora: number) {
  if (!Number.isFinite(agora)) throw new Error('Data inválida para conferir o selo.');
  const fim = limitesHistorico(agora).semana;
  const semanas = Array.from({ length: 4 }, (_, i) => {
    const inicio = new Date(fim); inicio.setDate(inicio.getDate() - (4 - i) * 7);
    const limite = new Date(inicio); limite.setDate(limite.getDate() + 7);
    return { inicio: inicio.getTime(), fim: limite.getTime(), quantidade: 0 };
  });
  const vistos = new Set<string>();
  for (const p of passeios) {
    if (p.tutorId !== tutorId || p.petId !== petId || p.status !== 'concluido'
      || p.fim === null || !Number.isFinite(p.fim) || p.fim < p.inicio || p.fim > agora || vistos.has(p.id)) continue;
    const semana = semanas.find((s) => p.fim! >= s.inicio && p.fim! < s.fim);
    if (semana) { semana.quantidade++; vistos.add(p.id); }
  }
  return { semanas, conquistado: semanas.every((s) => s.quantidade >= 3) };
}
