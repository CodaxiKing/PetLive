import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import type { Especie } from '../pets/types';

/** Pet perdido (BUSINESS.md 5.29): chamadas às funções perdido_* do banco. */

export const RAIOS_PERDIDO = [1, 2, 5, 10] as const;

export type Alerta =
  | { encontrado: false }
  | { encontrado: true; status: 'encontrado' | 'encerrado' | 'expirado'; id?: undefined }
  | {
      encontrado: true;
      id: string;
      status: 'ativo' | 'encontrado' | 'encerrado' | 'expirado';
      dono: boolean;
      pet: { id: string; nome: string; especie: Especie; raca: string | null; foto_url: string | null; cor: string | null };
      lat: number;
      lng: number;
      raio_km: number;
      visto_em: string;
      mensagem: string | null;
      telefone: string | null;
      criado_em: string;
      expira_em: string;
      avistamentos: number | null;
    };
export type AlertaAberto = Extract<Alerta, { dono: boolean }>;

export type Avistamento = {
  id: string;
  lat: number;
  lng: number;
  visto_em: string;
  mensagem: string | null;
  foto_path: string | null;
  com_a_pessoa: boolean;
  origem: 'app' | 'qr';
  criado_em: string;
};

function falha(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Posição atual, só quando a pessoa toca no botão. */
export async function posicaoAtual(): Promise<{ lat: number; lng: number; precisao: number | null }> {
  const permissao = await Location.requestForegroundPermissionsAsync();
  if (!permissao.granted) throw new Error('Autorize a localização para marcar onde o pet está.');
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy ?? null };
}

export async function alertar(petId: string, lat: number, lng: number, vistoEm: Date, raio: number, mensagem: string, mostrarTelefone: boolean) {
  const { data, error } = await supabase.rpc('perdido_alertar', {
    p_pet_id: petId, p_lat: lat, p_lng: lng, p_visto_em: vistoEm.toISOString(), p_raio: raio,
    p_mensagem: mensagem.trim() || null, p_mostrar_telefone: mostrarTelefone,
  });
  falha(error);
  return data as { id: string; avisados: number };
}

export async function abrirAlerta(id: string): Promise<Alerta> {
  const { data, error } = await supabase.rpc('perdido_alerta', { p_id: id });
  falha(error);
  return data as Alerta;
}

/** Alerta ativo do pet, para o tutor (RLS: só quem cuida do pet vê). */
export async function alertaAtivoDoPet(petId: string): Promise<string | null> {
  const { data, error } = await supabase.from('lost_alerts').select('id').eq('pet_id', petId).eq('status', 'ativo').maybeSingle();
  falha(error);
  return (data as { id: string } | null)?.id ?? null;
}

export async function carregarAvistamentos(alertaId: string): Promise<Avistamento[]> {
  const { data, error } = await supabase
    .from('lost_alert_sightings')
    .select('id, lat, lng, visto_em, mensagem, foto_path, com_a_pessoa, origem, criado_em')
    .eq('alert_id', alertaId)
    .order('criado_em', { ascending: false });
  falha(error);
  return (data ?? []) as Avistamento[];
}

export async function urlFotoAvistamento(caminho: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('avistamentos').createSignedUrl(caminho, 3600);
  return error ? null : (data?.signedUrl ?? null);
}

/** Envia a foto opcional de quem viu para a pasta da própria conta. */
export async function enviarFotoAvistamento(userId: string, foto: { uri: string; mimeType?: string | null }): Promise<string> {
  const tipo = foto.mimeType ?? 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(tipo)) throw new Error('Escolha uma imagem JPEG, PNG ou WebP.');
  const bytes = await (await fetch(foto.uri)).arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 5 * 1024 * 1024) throw new Error('A foto deve ter até 5 MB.');
  const caminho = `${userId}/${Crypto.randomUUID()}.${tipo === 'image/png' ? 'png' : tipo === 'image/webp' ? 'webp' : 'jpg'}`;
  const { error } = await supabase.storage.from('avistamentos').upload(caminho, bytes, { contentType: tipo, upsert: false });
  if (error) throw new Error('Não deu para enviar a foto. Tente sem foto.');
  return caminho;
}

export async function avistar(alertaId: string, lat: number, lng: number, vistoEm: Date, mensagem: string, comAPessoa: boolean, fotoPath: string | null) {
  const { error } = await supabase.rpc('perdido_avistar', {
    p_alert: alertaId, p_lat: lat, p_lng: lng, p_visto_em: vistoEm.toISOString(),
    p_mensagem: mensagem.trim() || null, p_com_a_pessoa: comAPessoa, p_foto_path: fotoPath,
  });
  falha(error);
}

export async function renovarAlerta(id: string) {
  const { error } = await supabase.rpc('perdido_renovar', { p_alert: id });
  falha(error);
}

export async function encerrarAlerta(id: string, encontrado: boolean) {
  const { error } = await supabase.rpc('perdido_encerrar', { p_alert: id, p_encontrado: encontrado });
  falha(error);
}

export type RegiaoPerdidos = { ativo: boolean; expira_em?: string | null };

export async function consultarRegiaoPerdidos(): Promise<RegiaoPerdidos> {
  const { data, error } = await supabase.rpc('perdido_regiao_consultar');
  falha(error);
  return data as RegiaoPerdidos;
}

/** Liga os avisos com a região aproximada de agora (~1 km). Nunca guarda a posição exata. */
export async function ligarRegiaoPerdidos(): Promise<RegiaoPerdidos> {
  const { lat, lng } = await posicaoAtual();
  const { data, error } = await supabase.rpc('perdido_regiao_configurar', {
    p_ativo: true, p_lat: Math.round(lat * 100) / 100, p_lng: Math.round(lng * 100) / 100,
  });
  falha(error);
  return data as RegiaoPerdidos;
}

export async function desligarRegiaoPerdidos(): Promise<RegiaoPerdidos> {
  const { data, error } = await supabase.rpc('perdido_regiao_configurar', { p_ativo: false });
  falha(error);
  return data as RegiaoPerdidos;
}

/** Renova a região ao abrir o app, sem pedir permissão de novo. */
export async function renovarRegiaoPerdidosSeLigada(): Promise<void> {
  const regiao = await consultarRegiaoPerdidos().catch(() => null);
  if (!regiao?.ativo) return;
  const { granted } = await Location.getForegroundPermissionsAsync();
  if (!granted) return;
  const p = await Location.getLastKnownPositionAsync();
  if (!p) return;
  await supabase.rpc('perdido_regiao_configurar', {
    p_ativo: true, p_lat: Math.round(p.coords.latitude * 100) / 100, p_lng: Math.round(p.coords.longitude * 100) / 100,
  });
}

/** Distância em km entre dois pontos. */
export function distanciaKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = (g: number) => (g * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** "a 300 m", "a 1,4 km". */
export function textoDistancia(km: number): string {
  if (km < 1) return `a ${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `a ${km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}

/** "há 15 min", "há 3 h", "há 2 dias". */
export function haQuanto(iso: string, agora = Date.now()): string {
  const min = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60000));
  if (min < 60) return `há ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

/** Abre o ponto no app de mapas. */
export function linkMapa(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
