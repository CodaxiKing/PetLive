import { supabase } from '../lib/supabase';

/**
 * Lugares do mapa (BUSINESS.md 5.15). Duas fontes:
 * - 'google': funções places-nearby e place-details (chave só no servidor,
 *   limite diário por usuário). Exige o mapa do Google na tela (termos do
 *   Google), então só liga com EXPO_PUBLIC_LUGARES_FONTE=google.
 * - 'osm': tabela places, importada do OpenStreetMap (padrão até lá).
 */
export const FONTE_LUGARES: 'google' | 'osm' =
  process.env.EXPO_PUBLIC_LUGARES_FONTE === 'google' ? 'google' : 'osm';

/** Categorias do mapa (batem com places.categoria no banco e com o Google). */
export type CategoriaLugar = 'clinica' | 'banho_tosa' | 'petshop' | 'creche' | 'hotelzinho';

export type FotoLugar = { nome: string; autores: { nome: string; uri: string | null }[] };

export type Lugar = {
  id: string;
  nome: string;
  categoria: CategoriaLugar;
  endereco: string | null;
  telefone: string | null;
  /** Horário: texto do OSM ("Mo-Fr 08:00-22:00") ou linhas do Google. */
  horario: string | null;
  website: string | null;
  lat: number;
  lng: number;
  aberto_24h: boolean;
  /** Só na consulta por perto; a ficha busca direto na tabela places. */
  distancia_km?: number;
  /** Google: nota, se está aberto agora e fotos (com atribuição). */
  nota?: number | null;
  avaliacoes?: number | null;
  aberto_agora?: boolean | null;
  fotos?: FotoLugar[];
  fonte?: 'google' | 'osm';
};

export const ROTULO_CATEGORIA: Record<CategoriaLugar, string> = {
  clinica: 'Clínica',
  banho_tosa: 'Banho e tosa',
  petshop: 'Petshop',
  creche: 'Creche',
  hotelzinho: 'Hotelzinho',
};

/** Cores dos pins por categoria (protótipo Mapa). */
export const COR_CATEGORIA: Record<CategoriaLugar, string> = {
  clinica: '#CFE8FB',
  banho_tosa: '#DDF3E6',
  petshop: '#EBDDFB',
  creche: '#FFF1C9',
  hotelzinho: '#FCE1EF',
};

/** Centro de reserva (Rio de Janeiro) enquanto a localização não chega. */
export const CENTRO_PADRAO = { lat: -22.9068, lng: -43.1729 };

/** Erro de uma função de lugares, com o código que ela devolve. */
async function chamarFuncao<T>(nome: string, corpo: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(nome, { body: corpo });
  if (error) {
    // FunctionsHttpError traz a resposta; o corpo diz o motivo (sem_chave, limite...).
    const contexto = (error as { context?: Response }).context;
    const detalhe = contexto ? await contexto.json().catch(() => null) : null;
    const erro = new Error(detalhe?.mensagem ?? error.message) as Error & { codigo?: string };
    erro.codigo = detalhe?.erro;
    throw erro;
  }
  return data as T;
}

/** Sem chave do Google no servidor: usa o OpenStreetMap até a próxima abertura. */
let googleIndisponivel = false;

const usarGoogle = () => FONTE_LUGARES === 'google' && !googleIndisponivel;

type LugarGoogle = {
  id: string;
  nome: string;
  categoria: CategoriaLugar | '24h';
  lat: number;
  lng: number;
  nota: number | null;
  aberto_agora: boolean | null;
  distancia_km: number;
};

function deGoogle(l: LugarGoogle, aberto24h = false): Lugar {
  return {
    id: l.id,
    nome: l.nome,
    categoria: l.categoria === '24h' ? 'clinica' : l.categoria,
    endereco: null,
    telefone: null,
    horario: null,
    website: null,
    lat: l.lat,
    lng: l.lng,
    aberto_24h: aberto24h || l.categoria === '24h',
    distancia_km: l.distancia_km,
    nota: l.nota,
    aberto_agora: l.aberto_agora,
    fonte: 'google',
  };
}

/**
 * Lugares pet por perto de um ponto: filtro de tipo, busca por nome, 24h e
 * raio, ordenados pela distância.
 */
export async function buscarLugares(opcoes: {
  lat: number;
  lng: number;
  categoria?: CategoriaLugar | null;
  busca?: string | null;
  aberto24h?: boolean | null;
  raioKm?: number;
}): Promise<Lugar[]> {
  if (usarGoogle()) {
    try {
      const categoria = opcoes.aberto24h ? '24h' : (opcoes.categoria ?? 'todos');
      const { lugares } = await chamarFuncao<{ lugares: LugarGoogle[] }>('places-nearby', {
        lat: opcoes.lat,
        lng: opcoes.lng,
        categoria,
        raioKm: opcoes.raioKm ?? 5,
      });
      const termo = opcoes.busca?.trim().toLowerCase();
      return lugares
        .map((l) => deGoogle(l, Boolean(opcoes.aberto24h)))
        .filter((l) => !termo || l.nome.toLowerCase().includes(termo));
    } catch (e) {
      if ((e as { codigo?: string }).codigo !== 'sem_chave') throw e;
      googleIndisponivel = true;
    }
  }

  const { data, error } = await supabase.rpc('lugares_por_perto', {
    p_lat: opcoes.lat,
    p_lng: opcoes.lng,
    p_categoria: opcoes.categoria ?? null,
    p_busca: opcoes.busca?.trim() || null,
    p_aberto_24h: opcoes.aberto24h ?? null,
    p_raio_km: opcoes.raioKm ?? 10,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Lugar[]).map((l) => ({ ...l, fonte: 'osm' as const }));
}

/** O id do OSM é um uuid; o do Google, um place_id. */
export const ehIdGoogle = (id: string) => !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id);

type DetalheGoogle = {
  id: string;
  nome: string;
  lat: number | null;
  lng: number | null;
  endereco: string | null;
  telefone: string | null;
  horario: string[] | null;
  aberto_agora: boolean | null;
  website: string | null;
  nota: number | null;
  avaliacoes: number | null;
  fotos: FotoLugar[];
};

/** Ficha do lugar: detalhe do Google sob demanda, ou a linha do OSM. */
export async function lugarPorId(id: string, categoria?: CategoriaLugar): Promise<Lugar | null> {
  if (ehIdGoogle(id)) {
    const { lugar } = await chamarFuncao<{ lugar: DetalheGoogle }>('place-details', { placeId: id });
    const horario = lugar.horario?.join('\n') ?? null;
    return {
      id: lugar.id,
      nome: lugar.nome,
      categoria: categoria ?? 'clinica',
      endereco: lugar.endereco,
      telefone: lugar.telefone,
      horario,
      website: lugar.website,
      lat: lugar.lat ?? CENTRO_PADRAO.lat,
      lng: lugar.lng ?? CENTRO_PADRAO.lng,
      aberto_24h: /24 horas/i.test(horario ?? ''),
      nota: lugar.nota,
      avaliacoes: lugar.avaliacoes,
      aberto_agora: lugar.aberto_agora,
      fotos: lugar.fotos,
      fonte: 'google',
    };
  }

  const { data, error } = await supabase
    .from('places')
    .select('id, nome, categoria, endereco, telefone, horario, website, lat, lng, aberto_24h')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { ...(data as Lugar), fonte: 'osm' };
}

/** Endereço de uma foto do Google (carregada sob demanda, 5.15). */
export async function enderecoDaFoto(nome: string, larguraPx: number): Promise<string> {
  const { uri } = await chamarFuncao<{ uri: string }>('place-photo', { nome, larguraPx });
  return uri;
}

/** "850 m" / "1,5 km" no padrão pt-BR; null quando não há distância. */
export function formatarDistancia(km?: number): string | null {
  if (km === undefined || Number.isNaN(km)) return null;
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

/** Resumo ao lado da distância no card: "Aberto 24h", "Aberto agora" ou o horário. */
export function resumoStatus(lugar: Lugar): string | null {
  if (lugar.aberto_24h) return 'Aberto 24h';
  if (lugar.aberto_agora === true) return 'Aberto agora';
  if (lugar.aberto_agora === false) return 'Fechado agora';
  return lugar.horario ?? null;
}

/**
 * SOS pelo Google (função nearest-emergency) com o telefone da ficha, que a
 * busca por proximidade não traz. Null = Google indisponível: o SOS segue
 * com a outra fonte.
 */
export async function clinicaEmergenciaGoogle(posicao: {
  lat: number;
  lng: number;
}): Promise<{ lugar: Lugar; confirmada24h: boolean } | null> {
  if (!usarGoogle()) return null;
  try {
    const { clinica, confirmada24h } = await chamarFuncao<{ clinica: LugarGoogle | null; confirmada24h: boolean }>(
      'nearest-emergency',
      posicao,
    );
    if (!clinica) return null;
    const basico = deGoogle(clinica, confirmada24h);
    const ficha = await lugarPorId(clinica.id, 'clinica').catch(() => null);
    const lugar = ficha
      ? { ...ficha, distancia_km: basico.distancia_km, aberto_24h: confirmada24h || ficha.aberto_24h }
      : basico;
    return { lugar, confirmada24h };
  } catch (e) {
    if ((e as { codigo?: string }).codigo === 'sem_chave') googleIndisponivel = true;
    return null;
  }
}

/** Favorito do Google: só nome, posição e endereço (campos básicos, mais baratos). */
export async function lugarSalvoGoogle(placeId: string): Promise<Lugar | null> {
  if (FONTE_LUGARES !== 'google') return null;
  try {
    const { lugar } = await chamarFuncao<{ lugar: DetalheGoogle }>('place-details', { placeId, basico: true });
    if (lugar.lat === null || lugar.lng === null) return null;
    return {
      id: lugar.id,
      nome: lugar.nome,
      categoria: 'clinica',
      endereco: lugar.endereco,
      telefone: null,
      horario: null,
      website: null,
      lat: lugar.lat,
      lng: lugar.lng,
      aberto_24h: false,
      fonte: 'google',
    };
  } catch {
    return null;
  }
}
