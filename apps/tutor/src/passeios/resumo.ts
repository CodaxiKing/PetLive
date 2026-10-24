import type { Passeio, PontoPasseio } from './passeio';

export function anotacaoPasseio(texto: string) {
  const valor = texto.trim();
  if (valor.length > 1000) throw new Error('A anotação deve ter até 1.000 caracteres.');
  return valor;
}

export function ritmoPasseio(passeio: Passeio) {
  if (passeio.distanciaM < 10 || passeio.duracaoMs <= 0) return 'Sem distância suficiente';
  const segundos = Math.round(passeio.duracaoMs / 1000 / (passeio.distanciaM / 1000));
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')} min/km`;
}

/** Geometria sem linhas artificiais entre pausas e sem dados pessoais nas propriedades. */
export function geometriaPasseio(pontos: PontoPasseio[]) {
  const trechos: number[][][] = [];
  for (let i = 0; i < pontos.length; i++) {
    if (i === 0 || pontos[i].trecho !== pontos[i - 1].trecho) trechos.push([]);
    const lng = pontos[0].lng + ((pontos[i].lng - pontos[0].lng + 540) % 360 - 180);
    trechos.at(-1)!.push([lng, Math.max(-85, Math.min(85, pontos[i].lat))]);
  }
  return { type: 'Feature' as const, properties: {}, geometry: { type: 'MultiLineString' as const, coordinates: trechos.filter((p) => p.length >= 2) } };
}

export function limitesMapaPasseio(pontos: PontoPasseio[]): [number, number, number, number] | null {
  if (!pontos.length) return null;
  let oeste = Infinity, leste = -Infinity, sul = Infinity, norte = -Infinity;
  // Longitudes contínuas em torno do primeiro ponto também cobrem a linha de data.
  const origem = pontos[0].lng;
  for (const p of pontos) {
    const lng = origem + ((p.lng - origem + 540) % 360 - 180);
    oeste = Math.min(oeste, lng); leste = Math.max(leste, lng);
    const lat = Math.max(-85, Math.min(85, p.lat));
    sul = Math.min(sul, lat); norte = Math.max(norte, lat);
  }
  return [oeste - 0.0002, Math.max(-85, sul - 0.0002), leste + 0.0002, Math.min(85, norte + 0.0002)];
}

export interface FotosPasseio {
  salvar(id: string, origem: string): Promise<void>;
  remover(id: string): Promise<void>;
  apagarTodas(): Promise<void>;
}

export function tipoFotoPasseio(bytes: Uint8Array) {
  if (bytes[0] === 255 && bytes[1] === 216) return 'image/jpeg';
  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return 'image/png';
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return 'application/octet-stream';
}
