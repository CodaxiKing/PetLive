import { supabase } from '../lib/supabase';
import { ehIdGoogle, lugarSalvoGoogle, type Lugar } from './lugares';

/** Favoritos do Google buscados por vez no filtro "Salvos" (cada um é uma chamada). */
const MAX_SALVOS_GOOGLE = 10;

/**
 * Lugares salvos (tabela saved_places): o coração da ficha do lugar e o
 * filtro "Salvos" do mapa. Só o tutor logado vê os próprios (RLS). Do
 * Google só se guarda o place_id (BUSINESS.md 5.15); o resto vem na hora.
 */
export async function lugaresSalvos(): Promise<Lugar[]> {
  const { data, error } = await supabase
    .from('saved_places')
    .select('google_place_id, places(id, nome, categoria, endereco, telefone, horario, website, lat, lng, aberto_24h, fonte)')
    .order('saved_at', { ascending: false });
  if (error) throw new Error(error.message);

  const linhas = (data ?? []) as unknown as { google_place_id: string | null; places: Lugar | null }[];
  const doOsm = linhas.map((l) => l.places).filter((l): l is Lugar => l !== null);
  const idsGoogle = linhas
    .map((l) => l.google_place_id)
    .filter((id): id is string => Boolean(id))
    .slice(0, MAX_SALVOS_GOOGLE);
  const doGoogle = (await Promise.all(idsGoogle.map(lugarSalvoGoogle))).filter((l): l is Lugar => l !== null);
  return [...doGoogle, ...doOsm];
}

/** Coluna do favorito: place_id do Google ou id do lugar do OSM. */
const coluna = (id: string) => (ehIdGoogle(id) ? 'google_place_id' : 'place_id');

export async function estaSalvo(id: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('saved_places')
    .select('id', { count: 'exact', head: true })
    .eq(coluna(id), id);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/** Liga ou desliga o favorito; devolve o novo estado. */
export async function alternarSalvo(id: string, salvo: boolean): Promise<boolean> {
  if (salvo) {
    const { error } = await supabase.from('saved_places').delete().eq(coluna(id), id);
    if (error) throw new Error(error.message);
    return false;
  }
  const google = ehIdGoogle(id);
  const linha: { place_id: string | null; google_place_id: string | null } = {
    place_id: google ? null : id,
    google_place_id: google ? id : null,
  };
  const { error } = await supabase.from('saved_places').insert(linha);
  // Já salvo (duplo toque): continua salvo.
  if (error && error.code !== '23505') throw new Error(error.message);
  return true;
}
