// PetLive: base comum das funções de lugares (Google Places API New).
// BUSINESS.md 5.15, 5.17 e 5.19: a chave fica só no servidor, cada chamada
// passa pelo limite diário do usuário e pede só os campos necessários.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

/** Pode ser trocada em teste por um servidor que imita o Google. */
const BASE = Deno.env.get('GOOGLE_PLACES_BASE_URL') ?? 'https://places.googleapis.com/v1';
const CHAVE = Deno.env.get('GOOGLE_PLACES_KEY') ?? '';

export type Categoria =
  | 'todos'
  | 'clinica'
  | 'petshop'
  | 'banho_tosa'
  | 'creche'
  | 'hotelzinho'
  | '24h'
  | 'parque'
  | 'praia'
  | 'restaurante'
  | 'hotel';

/**
 * Como cada categoria é buscada: por tipo do Google (busca por proximidade)
 * ou por texto fixo, quando o Google não tem tipo próprio (5.15).
 */
const BUSCA: Record<Categoria, { tipos?: string[]; texto?: string; petFriendly?: boolean }> = {
  // Clínicas e petshops numa chamada só; cada lugar é classificado pelo tipo.
  todos: { tipos: ['veterinary_care', 'pet_store'] },
  clinica: { tipos: ['veterinary_care'] },
  petshop: { tipos: ['pet_store'] },
  banho_tosa: { texto: 'banho e tosa pet shop' },
  creche: { texto: 'creche para cães' },
  hotelzinho: { texto: 'hotel para cães hospedagem pet' },
  '24h': { texto: 'clínica veterinária 24 horas' },
  parque: { tipos: ['dog_park', 'park'], petFriendly: true },
  praia: { tipos: ['beach'], petFriendly: true },
  restaurante: { texto: 'restaurante pet friendly', petFriendly: true },
  hotel: { texto: 'hotel pet friendly aceita cachorro', petFriendly: true },
};

export const CATEGORIAS = Object.keys(BUSCA) as Categoria[];

/** Campos da busca: nome, posição, tipo, nota e se está aberto (5.15). */
const CAMPOS_BUSCA = [
  'places.id',
  'places.displayName',
  'places.location',
  'places.types',
  'places.rating',
  'places.currentOpeningHours.openNow',
];

export type LugarGoogle = {
  id: string;
  nome: string;
  categoria: Categoria;
  lat: number;
  lng: number;
  nota: number | null;
  aberto_agora: boolean | null;
  /** Só quando o Google informa (pet friendly, 5.19). */
  aceita_caes: boolean | null;
  /** Parque com área própria para cães (tipo dog_park do Google). */
  area_caes: boolean;
  distancia_km: number;
  fonte: 'google';
};

export class ErroLugares extends Error {
  constructor(public codigo: 'sem_chave' | 'sem_sessao' | 'limite' | 'google' | 'pedido', mensagem: string) {
    super(mensagem);
  }
}

export function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export function respostaDeErro(e: unknown): Response {
  if (e instanceof ErroLugares) {
    const status = { sem_chave: 503, sem_sessao: 401, limite: 429, google: 502, pedido: 400 }[e.codigo];
    return resposta({ erro: e.codigo, mensagem: e.message }, status);
  }
  return resposta({ erro: 'interno', mensagem: e instanceof Error ? e.message : String(e) }, 500);
}

/** Cliente com a sessão de quem chamou (RLS e auth.uid() valem). */
export function clienteDoUsuario(req: Request): SupabaseClient {
  const auth = req.headers.get('Authorization');
  if (!auth) throw new ErroLugares('sem_sessao', 'Entre na sua conta para buscar lugares.');
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
}

/** Conta a chamada no limite diário; recusa quando passou. */
export async function consumirCota(cliente: SupabaseClient, tipo: 'nearby' | 'detail' | 'photo'): Promise<void> {
  const { data, error } = await cliente.rpc('consumir_cota_lugares', { p_tipo: tipo });
  if (error) throw new ErroLugares('sem_sessao', error.message);
  if (data !== true) throw new ErroLugares('limite', 'Você chegou ao limite de buscas de hoje. Tente amanhã.');
}

function exigirChave() {
  if (!CHAVE) throw new ErroLugares('sem_chave', 'Busca de lugares do Google ainda não configurada.');
}

async function chamarGoogle(caminho: string, campos: string[], init: RequestInit = {}): Promise<Record<string, unknown>> {
  exigirChave();
  const resp = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': CHAVE,
      ...(campos.length ? { 'X-Goog-FieldMask': campos.join(',') } : {}),
      ...(init.headers ?? {}),
    },
  });
  const corpo = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new ErroLugares('google', `Google respondeu ${resp.status}: ${JSON.stringify(corpo).slice(0, 200)}`);
  }
  return corpo as Record<string, unknown>;
}

/** Distância em km entre dois pontos (haversine). */
export function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)) * 100) / 100;
}

type PlaceBruto = {
  id: string;
  types?: string[];
  displayName?: { text?: string };
  location?: { latitude: number; longitude: number };
  rating?: number;
  currentOpeningHours?: { openNow?: boolean };
  allowsDogs?: boolean;
};

/** Lugares por perto de uma categoria, ordenados pela distância. */
export async function buscarPorPerto(opcoes: {
  categoria: Categoria;
  lat: number;
  lng: number;
  raioKm: number;
  abertoAgora?: boolean;
}): Promise<LugarGoogle[]> {
  const busca = BUSCA[opcoes.categoria];
  const raio = Math.min(Math.max(opcoes.raioKm, 0.5), 50) * 1000;
  const circulo = { circle: { center: { latitude: opcoes.lat, longitude: opcoes.lng }, radius: raio } };
  // "Aceita cães" só nas categorias pet friendly: o campo é de outro SKU.
  const campos = busca.petFriendly ? [...CAMPOS_BUSCA, 'places.allowsDogs'] : CAMPOS_BUSCA;

  const corpo = busca.tipos
    ? await chamarGoogle('/places:searchNearby', campos, {
        method: 'POST',
        body: JSON.stringify({
          includedTypes: busca.tipos,
          maxResultCount: 20,
          rankPreference: 'DISTANCE',
          locationRestriction: circulo,
          languageCode: 'pt-BR',
          regionCode: 'BR',
        }),
      })
    : await chamarGoogle('/places:searchText', campos, {
        method: 'POST',
        body: JSON.stringify({
          textQuery: busca.texto,
          pageSize: 20,
          rankPreference: 'DISTANCE',
          locationBias: circulo,
          openNow: opcoes.abertoAgora ?? false,
          languageCode: 'pt-BR',
          regionCode: 'BR',
        }),
      });

  const centro = { lat: opcoes.lat, lng: opcoes.lng };
  const lugares = ((corpo.places as PlaceBruto[] | undefined) ?? [])
    .filter((p) => p.location)
    .map((p) => {
      const lugar = { lat: p.location!.latitude, lng: p.location!.longitude };
      return {
        id: p.id,
        nome: p.displayName?.text ?? 'Lugar sem nome',
        categoria:
          opcoes.categoria === 'todos'
            ? ((p.types ?? []).includes('veterinary_care') ? 'clinica' : 'petshop')
            : opcoes.categoria,
        ...lugar,
        nota: p.rating ?? null,
        aberto_agora: p.currentOpeningHours?.openNow ?? null,
        aceita_caes: p.allowsDogs ?? null,
        area_caes: (p.types ?? []).includes('dog_park'),
        distancia_km: distanciaKm(centro, lugar),
        fonte: 'google' as const,
      };
    })
    // A busca por texto só "prefere" o círculo; aqui fica só o que está dentro.
    .filter((l) => l.distancia_km <= raio / 1000)
    .filter((l) => !opcoes.abertoAgora || l.aberto_agora !== false)
    // Pet friendly: fora o que o próprio Google diz que não aceita cães (5.19).
    .filter((l) => !busca.petFriendly || l.aceita_caes !== false);

  return lugares.sort((a, b) => a.distancia_km - b.distancia_km);
}

export type DetalheGoogle = {
  id: string;
  nome: string;
  lat: number | null;
  lng: number | null;
  endereco: string | null;
  telefone: string | null;
  telefone_internacional: string | null;
  horario: string[] | null;
  aberto_agora: boolean | null;
  website: string | null;
  nota: number | null;
  avaliacoes: number | null;
  google_maps: string | null;
  fotos: { nome: string; autores: { nome: string; uri: string | null }[] }[];
  fonte: 'google';
};

/** Campos da ficha: só ao tocar no lugar (5.15). "basico" serve aos favoritos. */
const CAMPOS_DETALHE = [
  'id',
  'displayName',
  'location',
  'formattedAddress',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'regularOpeningHours.weekdayDescriptions',
  'currentOpeningHours.openNow',
  'websiteUri',
  'rating',
  'userRatingCount',
  'googleMapsUri',
  'photos',
];
const CAMPOS_BASICOS = ['id', 'displayName', 'location', 'formattedAddress'];

export async function detalhar(placeId: string, basico = false): Promise<DetalheGoogle> {
  if (!/^[\w-]{10,300}$/.test(placeId)) throw new ErroLugares('pedido', 'place_id inválido.');
  const p = (await chamarGoogle(
    `/places/${encodeURIComponent(placeId)}?languageCode=pt-BR&regionCode=BR`,
    basico ? CAMPOS_BASICOS : CAMPOS_DETALHE,
  )) as Record<string, any>;

  return {
    id: p.id,
    nome: p.displayName?.text ?? 'Lugar sem nome',
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    endereco: p.formattedAddress ?? null,
    telefone: p.nationalPhoneNumber ?? null,
    telefone_internacional: p.internationalPhoneNumber ?? null,
    horario: p.regularOpeningHours?.weekdayDescriptions ?? null,
    aberto_agora: p.currentOpeningHours?.openNow ?? null,
    website: p.websiteUri ?? null,
    nota: p.rating ?? null,
    avaliacoes: p.userRatingCount ?? null,
    google_maps: p.googleMapsUri ?? null,
    // Até 5 fotos, com a atribuição que o Google exige mostrar.
    fotos: ((p.photos as any[] | undefined) ?? []).slice(0, 5).map((f) => ({
      nome: f.name,
      autores: ((f.authorAttributions as any[] | undefined) ?? []).map((a) => ({
        nome: a.displayName ?? '',
        uri: a.uri ?? null,
      })),
    })),
    fonte: 'google',
  };
}

/** Endereço da imagem de uma foto (o app carrega direto do Google). */
export async function enderecoDaFoto(nomeFoto: string, larguraPx: number): Promise<string> {
  if (!/^places\/[\w-]+\/photos\/[\w-]+$/.test(nomeFoto)) throw new ErroLugares('pedido', 'Foto inválida.');
  const largura = Math.min(Math.max(Math.round(larguraPx), 100), 1600);
  const corpo = await chamarGoogle(`/${nomeFoto}/media?maxWidthPx=${largura}&skipHttpRedirect=true`, [], {
    method: 'GET',
  });
  const uri = corpo.photoUri;
  if (typeof uri !== 'string') throw new ErroLugares('google', 'Foto sem endereço.');
  return uri;
}

/** Lê o JSON do pedido; erro claro se vier quebrado. */
export async function lerCorpo<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ErroLugares('pedido', 'Pedido sem JSON válido.');
  }
}

export function numero(valor: unknown, nome: string): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) throw new ErroLugares('pedido', `${nome} inválido.`);
  return valor;
}
