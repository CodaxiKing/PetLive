import { supabase } from '../lib/supabase';

/** Categorias do mapa (batem com places.categoria no banco). */
export type CategoriaLugar = 'clinica' | 'banho_tosa' | 'petshop';

export type Lugar = {
  id: string;
  nome: string;
  categoria: CategoriaLugar;
  endereco: string | null;
  telefone: string | null;
  /** opening_hours cru do OpenStreetMap, ex.: "Mo-Fr 08:00-22:00". */
  horario: string | null;
  website: string | null;
  lat: number;
  lng: number;
  aberto_24h: boolean;
  /** Só na consulta por perto; a ficha busca direto na tabela places. */
  distancia_km?: number;
};

export const ROTULO_CATEGORIA: Record<CategoriaLugar, string> = {
  clinica: 'Clínica',
  banho_tosa: 'Banho e tosa',
  petshop: 'Petshop',
};

/** Cores dos pins por categoria (protótipo Mapa). */
export const COR_CATEGORIA: Record<CategoriaLugar, string> = {
  clinica: '#CFE8FB',
  banho_tosa: '#DDF3E6',
  petshop: '#EBDDFB',
};

/** Centro de reserva (Rio de Janeiro) enquanto a localização não chega. */
export const CENTRO_PADRAO = { lat: -22.9068, lng: -43.1729 };

/**
 * Lugares pet por perto de um ponto (RPC lugares_por_perto): filtro de
 * tipo, busca por nome, 24h e raio — ordenados pela distância.
 */
export async function buscarLugares(opcoes: {
  lat: number;
  lng: number;
  categoria?: CategoriaLugar | null;
  busca?: string | null;
  aberto24h?: boolean | null;
  raioKm?: number;
}): Promise<Lugar[]> {
  const { data, error } = await supabase.rpc('lugares_por_perto', {
    p_lat: opcoes.lat,
    p_lng: opcoes.lng,
    p_categoria: opcoes.categoria ?? null,
    p_busca: opcoes.busca?.trim() || null,
    p_aberto_24h: opcoes.aberto24h ?? null,
    p_raio_km: opcoes.raioKm ?? 10,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as Lugar[];
}

/** Ficha do lugar: busca direta na tabela places (leitura pública). */
export async function lugarPorId(id: string): Promise<Lugar | null> {
  const { data, error } = await supabase
    .from('places')
    .select('id, nome, categoria, endereco, telefone, horario, website, lat, lng, aberto_24h')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as Lugar;
}

/** "850 m" / "1,5 km" no padrão pt-BR; null quando não há distância. */
export function formatarDistancia(km?: number): string | null {
  if (km === undefined || Number.isNaN(km)) return null;
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

/** Resumo ao lado da distância no card: "Aberto 24h" ou o horário do OSM. */
export function resumoStatus(lugar: Lugar): string | null {
  if (lugar.aberto_24h) return 'Aberto 24h';
  return lugar.horario ?? null;
}
