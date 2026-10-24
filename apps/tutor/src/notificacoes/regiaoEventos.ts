import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

export const RAIOS_EVENTOS = [2, 5, 10, 25, 50] as const;
export type RegiaoEventos = { ativo: boolean; raio_km: number; atualizado_em: string | null; expira_em: string | null };

async function conta(tutorId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== tutorId) throw new Error('Entre novamente nesta conta para configurar os avisos.');
}
async function executar(tutorId: string, nome: string, parametros: Record<string, unknown>) {
  await conta(tutorId);
  const { data, error } = await supabase.rpc(nome, { p_tutor: tutorId, ...parametros });
  if (error) throw new Error('Não foi possível configurar os eventos próximos. Confira a conexão e tente novamente.');
  await conta(tutorId);
  return data as RegiaoEventos;
}
export function carregarRegiaoEventos(tutorId: string) {
  return executar(tutorId, 'eventos_regiao_consultar', {});
}
export async function salvarRaioEventos(tutorId: string, raio: number) {
  if (!RAIOS_EVENTOS.some((r) => r === raio)) throw new Error('Escolha um dos raios disponíveis.');
  return executar(tutorId, 'eventos_regiao_configurar', { p_ativo: true, p_raio: raio, p_lat: null, p_lng: null });
}
export function desligarRegiaoEventos(tutorId: string) {
  return executar(tutorId, 'eventos_regiao_configurar', { p_ativo: false, p_raio: 10, p_lat: null, p_lng: null });
}
export async function usarRegiaoAtualEventos(tutorId: string, raio: number) {
  if (!RAIOS_EVENTOS.some((r) => r === raio)) throw new Error('Escolha um dos raios disponíveis.');
  await conta(tutorId);
  const permissao = await Location.requestForegroundPermissionsAsync();
  if (!permissao.granted) throw new Error('Autorize a localização ao usar o app para escolher sua região.');
  if (!await Location.hasServicesEnabledAsync()) throw new Error('Ative a localização do aparelho e tente novamente.');
  const posicao = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude, accuracy } = posicao.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180
    || accuracy === null || !Number.isFinite(accuracy) || accuracy > 2000 || accuracy < 0
    || !Number.isFinite(posicao.timestamp) || Math.abs(Date.now() - posicao.timestamp) > 120000) {
    throw new Error('Não foi possível localizar sua região com confiança. Tente novamente em um local aberto.');
  }
  // Envia somente a região aproximada, nunca a posição original ou um trajeto.
  return executar(tutorId, 'eventos_regiao_configurar', { p_ativo: true, p_raio: raio,
    p_lat: Math.round(latitude * 100) / 100, p_lng: Math.round(longitude * 100) / 100 });
}
