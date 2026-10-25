import * as Crypto from 'expo-crypto';
import { supabase } from '../lib/supabase';

const BUCKET = 'perfis';
const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Foto do tutor no bucket privado `perfis`. O perfil guarda só o caminho
 * (`<uid>/<uuid>.jpg`); cada troca grava um arquivo novo e apaga o anterior,
 * então a foto nova não fica presa no cache.
 */
export async function enviarFotoPerfil(
  tutorId: string,
  foto: { uri: string; mimeType?: string | null },
  caminhoAnterior: string | null,
): Promise<string> {
  const tipo = foto.mimeType ?? 'image/jpeg';
  if (!TIPOS.includes(tipo)) throw new Error('Escolha uma imagem JPEG, PNG ou WebP.');
  let bytes: ArrayBuffer;
  try {
    bytes = await (await fetch(foto.uri)).arrayBuffer();
  } catch {
    throw new Error('Não deu para ler a foto escolhida. Tente outra.');
  }
  if (!bytes.byteLength || bytes.byteLength > 5 * 1024 * 1024) throw new Error('A foto deve ter até 5 MB.');
  const extensao = tipo === 'image/png' ? 'png' : tipo === 'image/webp' ? 'webp' : 'jpg';
  const caminho = `${tutorId}/${Crypto.randomUUID()}.${extensao}`;

  const { error } = await supabase.storage.from(BUCKET).upload(caminho, bytes, { contentType: tipo, upsert: false });
  if (error) throw new Error('Não foi possível enviar a foto. Confira sua conexão e tente novamente.');

  const { error: erroPerfil } = await supabase.from('profiles').update({ avatar_url: caminho }).eq('id', tutorId);
  if (erroPerfil) {
    await supabase.storage.from(BUCKET).remove([caminho]).catch(() => undefined);
    throw new Error('Não foi possível salvar a foto no perfil. Tente novamente.');
  }
  if (caminhoAnterior) await supabase.storage.from(BUCKET).remove([caminhoAnterior]).catch(() => undefined);
  return caminho;
}

/** Tira a foto do perfil e apaga o arquivo. */
export async function removerFotoPerfil(tutorId: string, caminho: string | null): Promise<void> {
  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', tutorId);
  if (error) throw new Error('Não foi possível remover a foto. Tente novamente.');
  if (caminho) await supabase.storage.from(BUCKET).remove([caminho]).catch(() => undefined);
}

/** URL temporária para mostrar a foto; null quando não há foto ou o link falha. */
export async function urlFotoPerfil(caminho: string | null | undefined): Promise<string | null> {
  if (!caminho) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 3600);
  return error ? null : (data?.signedUrl ?? null);
}
