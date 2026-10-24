import { supabase } from '../lib/supabase';
import type { Lugar } from './lugares';

const regioes = new Map<string, { expira: number; consulta: Promise<Lugar[]> }>();

/** Busca pública no servidor, independente de a loja ter conta no PetLive. */
export function descobrirLugares(posicao: { lat: number; lng: number }, raioKm: number): Promise<Lugar[]> {
  const lat = Math.round(posicao.lat * 100) / 100;
  const lng = Math.round(posicao.lng * 100) / 100;
  const raio = Math.min(10, Math.max(1, Math.ceil(raioKm)));
  const chave = `${lat}:${lng}:${raio}`;
  const agora = Date.now();
  for (const [id, item] of regioes) if (item.expira <= agora) regioes.delete(id);
  const existente = regioes.get(chave);
  if (existente) return existente.consulta;
  const consulta = (async () => {
    const { data, error } = await supabase.functions.invoke<{ lugares: Lugar[] }>('discover-places', {
      body: { lat, lng, raioKm: raio },
    });
    if (error || !Array.isArray(data?.lugares)) throw new Error('Não foi possível descobrir os lugares desta região. Tente novamente.');
    return data.lugares;
  })();
  if (regioes.size >= 30) regioes.delete(regioes.keys().next().value!);
  regioes.set(chave, { expira: agora + 3_600_000, consulta });
  consulta.catch(() => regioes.delete(chave));
  return consulta;
}

export function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, h)));
}

/** Um mesmo comércio pode estar no Overture e no OSM; preserva lojas distintas. */
export function reunirLugares(listas: Lugar[][]): Lugar[] {
  const resultado: Lugar[] = [];
  const ids = new Set<string>();
  const nome = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const lugar of listas.flat()) {
    if (ids.has(lugar.id) || resultado.some((outro) => outro.categoria === lugar.categoria && nome(outro.nome) === nome(lugar.nome) && distanciaKm(outro, lugar) < 0.05)) continue;
    ids.add(lugar.id);
    resultado.push(lugar);
  }
  return resultado.sort((a, b) => (a.distancia_km ?? Infinity) - (b.distancia_km ?? Infinity));
}
