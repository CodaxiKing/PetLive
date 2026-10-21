import { supabase } from '../lib/supabase';
import type { Lugar } from './lugares';

/**
 * Lugares salvos (tabela saved_places): o coração da ficha do lugar e o
 * filtro "Salvos" do mapa. Só o tutor logado vê os próprios (RLS).
 */
export async function lugaresSalvos(): Promise<Lugar[]> {
  const { data, error } = await supabase
    .from('saved_places')
    .select('places(id, nome, categoria, endereco, telefone, horario, website, lat, lng, aberto_24h)')
    .not('place_id', 'is', null)
    .order('saved_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((linha) => (linha as unknown as { places: Lugar | null }).places)
    .filter((lugar): lugar is Lugar => lugar !== null);
}

export async function estaSalvo(placeId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('saved_places')
    .select('id', { count: 'exact', head: true })
    .eq('place_id', placeId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/** Liga ou desliga o favorito; devolve o novo estado. */
export async function alternarSalvo(placeId: string, salvo: boolean): Promise<boolean> {
  if (salvo) {
    const { error } = await supabase.from('saved_places').delete().eq('place_id', placeId);
    if (error) throw new Error(error.message);
    return false;
  }
  const { error } = await supabase.from('saved_places').insert({ place_id: placeId });
  // Já salvo (duplo toque): continua salvo.
  if (error && error.code !== '23505') throw new Error(error.message);
  return true;
}
