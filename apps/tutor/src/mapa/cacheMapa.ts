import AsyncStorage from '@react-native-async-storage/async-storage';
import { distanciaKm } from './descoberta';
import { ROTULO_CATEGORIA, type Lugar } from './lugares';

export type ConsultaMapa = { usuario: string; lat: number; lng: number; raioKm: number; categoria: string; busca: string };
type Copia = { chave: string; quando: string; lugares: Lugar[] };
const MAX_COPIAS = 12;
const VALIDADE_MS = 7 * 86_400_000;
let escrita = Promise.resolve();
const arquivo = (usuario: string) => `petlive-cache:mapa-v2:${usuario}`;
const chave = (q: ConsultaMapa) => JSON.stringify([q.lat.toFixed(2), q.lng.toFixed(2), q.raioKm, q.categoria, q.busca.trim().toLocaleLowerCase('pt-BR')]);

function decodificar(texto: string | null): Copia[] {
  try {
    const dados: unknown = JSON.parse(texto ?? '[]');
    return Array.isArray(dados) ? dados.filter((c): c is Copia =>
      typeof c?.chave === 'string' && typeof c?.quando === 'string' &&
      Number.isFinite(Date.parse(c.quando)) && Date.parse(c.quando) <= Date.now() &&
      Date.now() - Date.parse(c.quando) <= VALIDADE_MS && Array.isArray(c?.lugares) &&
      c.lugares.every((l: Lugar) => l && typeof l.id === 'string' && typeof l.nome === 'string' &&
        Object.hasOwn(ROTULO_CATEGORIA, l.categoria) && Number.isFinite(l.lat) && Math.abs(l.lat) <= 90 &&
        Number.isFinite(l.lng) && Math.abs(l.lng) <= 180 && l.fonte !== 'google')).slice(0, MAX_COPIAS) : [];
  } catch { return []; }
}

/** Guarda somente dados abertos; favoritos dependem da conta e seguem outra consulta. */
export function guardarMapa(q: ConsultaMapa, lugares: Lugar[]): Promise<void> {
  if (!q.usuario || q.categoria === 'salvos' || lugares.some((l) => l.fonte === 'google')) return Promise.resolve();
  escrita = escrita.then(async () => {
    const copias = decodificar(await AsyncStorage.getItem(arquivo(q.usuario)));
    const nova = { chave: chave(q), quando: new Date().toISOString(), lugares: lugares.slice(0, 200) };
    await AsyncStorage.setItem(arquivo(q.usuario), JSON.stringify([nova, ...copias.filter((c) => c.chave !== nova.chave)].slice(0, MAX_COPIAS)));
  }).catch(() => undefined);
  return escrita;
}

export async function lerMapa(q: ConsultaMapa): Promise<{ quando: Date; lugares: Lugar[] } | null> {
  if (!q.usuario || q.categoria === 'salvos') return null;
  const copias = decodificar(await AsyncStorage.getItem(arquivo(q.usuario)).catch(() => null));
  const copia = copias.find((c) => c.chave === chave(q));
  if (!copia) return null;
  const lugares = copia.lugares.map((l) => ({ ...l, distancia_km: distanciaKm(q, l) }))
    .filter((l) => l.distancia_km <= q.raioKm).sort((a, b) => a.distancia_km - b.distancia_km);
  return { quando: new Date(copia.quando), lugares };
}
