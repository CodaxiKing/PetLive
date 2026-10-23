import * as Crypto from 'expo-crypto';
import { supabase } from '../lib/supabase';

export async function enviarFotoEvento(tutorId: string, foto: { uri: string; mimeType?: string | null }) {
  const tipo = foto.mimeType ?? 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(tipo)) throw new Error('Escolha uma imagem JPEG, PNG ou WebP.');
  const bytes = await (await fetch(foto.uri)).arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 5 * 1024 * 1024) throw new Error('A foto deve ter até 5 MB.');
  const extensao = tipo === 'image/png' ? 'png' : tipo === 'image/webp' ? 'webp' : 'jpg';
  const caminho = `${tutorId}/${Crypto.randomUUID()}.${extensao}`;
  const { error } = await supabase.storage.from('eventos').upload(caminho, bytes, { contentType: tipo, upsert: false });
  if (error) throw new Error('Não foi possível enviar a foto. Confira sua conexão e tente novamente.');
  const { data } = supabase.storage.from('eventos').getPublicUrl(caminho);
  return { caminho, url: data.publicUrl };
}
