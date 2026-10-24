import type { Passeio } from './passeio';

export type PeriodoHistorico = 'semana' | 'mes' | 'todos';

/** Limites civis do aparelho, inclusive em semanas que atravessam mudança de horário. */
export function limitesHistorico(agora: number) {
  const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0);
  const semana = new Date(hoje); semana.setDate(semana.getDate() - (semana.getDay() + 6) % 7);
  const mes = new Date(hoje); mes.setDate(1);
  const gratis = new Date(hoje); gratis.setDate(gratis.getDate() - 29);
  return { semana: semana.getTime(), mes: mes.getTime(), gratis: gratis.getTime() };
}

export function passeiosVisiveis(passeios: Passeio[], tutorId: string, agora: number, premiumConfirmado: boolean) {
  const minimo = premiumConfirmado ? 0 : limitesHistorico(agora).gratis;
  return passeios.filter((p) => p.tutorId === tutorId && p.status === 'concluido' && p.fim !== null
    && Number.isFinite(p.fim) && p.fim >= minimo && p.fim <= agora)
    .sort((a, b) => b.fim! - a.fim! || b.inicio - a.inicio || a.id.localeCompare(b.id));
}

export function filtrarHistorico(passeios: Passeio[], periodo: PeriodoHistorico, petId: string | null, agora: number) {
  const limites = limitesHistorico(agora);
  const minimo = periodo === 'todos' ? 0 : limites[periodo];
  return passeios.filter((p) => p.fim !== null && p.fim >= minimo && (!petId || p.petId === petId));
}

export function totaisPasseios(passeios: Passeio[]) {
  return passeios.reduce((total, p) => ({ quantidade: total.quantidade + 1,
    distanciaM: total.distanciaM + p.distanciaM, duracaoMs: total.duracaoMs + p.duracaoMs }),
  { quantidade: 0, distanciaM: 0, duracaoMs: 0 });
}

export function progressoMeta(distanciaM: number, metaKm: number | null) {
  return metaKm && metaKm > 0 ? Math.min(100, Math.max(0, distanciaM / (metaKm * 1000) * 100)) : 0;
}

export function formatarTempoPasseio(ms: number) {
  const minutos = Math.floor(Math.max(0, ms) / 60000);
  return minutos >= 60 ? `${Math.floor(minutos / 60)} h ${minutos % 60} min` : `${minutos} min`;
}
