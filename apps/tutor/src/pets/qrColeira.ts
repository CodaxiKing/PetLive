import { supabase } from '../lib/supabase';

export type QrPet = { pet_id: string; code: string; show_photo: boolean; show_phone: boolean; show_allergies: boolean; active: boolean };
export async function carregarQr(pet: string): Promise<QrPet | null> {
  const { data, error } = await supabase.from('pet_qr_settings').select('*').eq('pet_id', pet).maybeSingle();
  if (error) throw error;
  return data as QrPet | null;
}
export async function salvarQr(pet: string, campos: Pick<QrPet, 'show_photo' | 'show_phone' | 'show_allergies' | 'active'>): Promise<QrPet> {
  const { data, error } = await supabase.rpc('salvar_qr_pet', { p_pet: pet, p_foto: campos.show_photo, p_telefone: campos.show_phone, p_alergias: campos.show_allergies, p_ativo: campos.active });
  if (error) throw new Error(error.message);
  return data as QrPet;
}
export function urlQr(codigo: string): string {
  const site = (process.env.EXPO_PUBLIC_SITE_URL || 'https://petlive.app').replace(/\/$/, '');
  return `${site}/p/${encodeURIComponent(codigo)}`;
}
