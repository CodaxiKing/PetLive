export type PontoPasseio = { lat: number; lng: number; instante: number; precisao: number; trecho: number };
export type Passeio = {
  id: string; tutorId: string; petId: string; nomePet: string;
  status: 'gravando' | 'pausado' | 'concluido';
  inicio: number; atualizadoEm: number; fim: number | null;
  ativoDesde: number | null; duracaoMs: number; distanciaM: number;
  trecho: number; pontos: PontoPasseio[];
};
export type AmostraGps = Omit<PontoPasseio, 'trecho'>;

export function novoPasseio(id: string, tutorId: string, petId: string, nomePet: string, agora: number): Passeio {
  return { id, tutorId, petId, nomePet, inicio: agora, atualizadoEm: agora, fim: null,
    status: 'gravando', ativoDesde: agora, duracaoMs: 0, distanciaM: 0, trecho: 0, pontos: [] };
}

export function duracaoPasseio(passeio: Passeio, agora: number) {
  return passeio.duracaoMs + (passeio.ativoDesde === null ? 0 : Math.max(0, agora - passeio.ativoDesde));
}

export function pausarPasseio(passeio: Passeio, agora: number): Passeio {
  if (passeio.status !== 'gravando') return passeio;
  return { ...passeio, status: 'pausado', duracaoMs: duracaoPasseio(passeio, agora), ativoDesde: null, atualizadoEm: agora };
}

export function retomarPasseio(passeio: Passeio, agora: number): Passeio {
  if (passeio.status !== 'pausado') return passeio;
  return { ...passeio, status: 'gravando', ativoDesde: agora, atualizadoEm: agora, trecho: passeio.trecho + 1 };
}

export function concluirPasseio(passeio: Passeio, agora: number): Passeio {
  if (passeio.status === 'concluido') return passeio;
  return { ...pausarPasseio(passeio, agora), status: 'concluido', fim: agora, atualizadoEm: agora };
}

export function distanciaEntre(a: Pick<AmostraGps, 'lat' | 'lng'>, b: Pick<AmostraGps, 'lat' | 'lng'>) {
  const rad = Math.PI / 180;
  const dlat = (b.lat - a.lat) * rad, dlng = (b.lng - a.lng) * rad;
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function amostraValida(ponto: AmostraGps) {
  return [ponto.lat, ponto.lng, ponto.instante, ponto.precisao].every(Number.isFinite)
    && Math.abs(ponto.lat) <= 90 && Math.abs(ponto.lng) <= 180
    && ponto.instante > 0 && ponto.precisao >= 0 && ponto.precisao <= 35;
}

export function registrarPonto(passeio: Passeio, ponto: AmostraGps, agora: number): Passeio {
  if (passeio.status !== 'gravando' || !amostraValida(ponto) || ponto.instante < (passeio.ativoDesde ?? agora)
    || ponto.instante > agora + 10000 || agora - ponto.instante > 30000) return passeio;
  const anterior = passeio.pontos.at(-1);
  if (anterior && ponto.instante <= anterior.instante) return passeio;
  const intervalo = anterior ? ponto.instante - anterior.instante : 0;
  const mesmoTrecho = anterior?.trecho === passeio.trecho && intervalo <= 45000;
  const metros = anterior && mesmoTrecho ? distanciaEntre(anterior, ponto) : 0;
  if (mesmoTrecho && (metros < 3 || metros / (intervalo / 1000) > 12)) return passeio;
  const trecho = anterior && anterior.trecho === passeio.trecho && intervalo > 45000 ? passeio.trecho + 1 : passeio.trecho;
  return { ...passeio, atualizadoEm: agora, trecho, distanciaM: passeio.distanciaM + metros,
    pontos: [...passeio.pontos, { ...ponto, trecho }] };
}
