import { supabase } from '../lib/supabase';
export type DestaquesLugares = Record<string, number>;
export function destaqueVigente(destaques: DestaquesLugares, id: string, agora = Date.now()): boolean {
  return Object.hasOwn(destaques, id) && Number.isFinite(destaques[id]) && destaques[id] > agora;
}
/** Prazo local corrigido pela hora do servidor e conservador quanto à latência. */
export function conferirDestaques(valor: unknown, ids: string[], inicioConsulta: number, agora = Date.now()): DestaquesLugares {
  const r = valor as { servidor_em: string; destaques: { lugar_id: string; fim_em: string }[] } | null;
  const servidor = r && typeof r.servidor_em === 'string' ? Date.parse(r.servidor_em) : NaN;
  if (!r || !Number.isFinite(servidor) || !Array.isArray(r.destaques) || r.destaques.length > 200) throw new Error('Destaques indisponíveis.');
  const permitidos = new Set(ids), fim: DestaquesLugares = {};
  for (const item of r.destaques) {
    if (!item || !permitidos.has(item.lugar_id) || typeof item.fim_em !== 'string' || !Number.isFinite(Date.parse(item.fim_em))) throw new Error('Destaques indisponíveis.');
    const prazo = agora + Date.parse(item.fim_em) - servidor - Math.max(0, agora - inicioConsulta);
    if (prazo > agora) fim[item.lugar_id] = Math.max(fim[item.lugar_id] ?? 0, prazo);
  }
  return fim;
}
export async function consultarDestaques(ids: string[]): Promise<DestaquesLugares> {
  const unicos = [...new Set(ids)];
  if (unicos.length > 1000 || unicos.some((i) => !i || i.length > 200)) throw new Error('Lista de lugares inválida.');
  if (!unicos.length) return {};
  const lotes: string[][] = [];
  for (let i = 0; i < unicos.length; i += 200) lotes.push(unicos.slice(i, i + 200));
  const resultados = await Promise.all(lotes.map(async (lote) => {
    const inicio = Date.now();
    const { data, error } = await supabase.rpc('destaques_lugares', { p_ids: lote });
    if (error) throw new Error('Destaques indisponíveis.');
    return conferirDestaques(data, lote, inicio);
  }));
  return Object.assign({}, ...resultados);
}
