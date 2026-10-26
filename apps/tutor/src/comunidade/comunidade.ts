import * as Crypto from 'expo-crypto';
import { supabase } from '../lib/supabase';
import type { Especie } from '../pets/types';

/** Comunidade e perfil público do pet (BUSINESS.md 5.28): chamadas às funções comunidade_*. */

export type Post = {
  id: string;
  pet_id: string;
  pet: string;
  especie: Especie;
  pet_foto: string | null;
  autor: string;
  meu: boolean;
  foto_path: string;
  legenda: string | null;
  criado_em: string;
  curtidas: number;
  curti: boolean;
  comentarios: number;
};

export type PetSeguido = { id: string; nome: string; especie: Especie; foto_url: string | null };
export type Feed = { seguindo: PetSeguido[]; posts: Post[] };

export type PerfilPublico =
  | { disponivel: false }
  | {
      disponivel: true;
      dono: boolean;
      ativo: boolean;
      pet: { id: string; nome: string; especie: Especie; raca: string | null; foto_url: string | null; nascimento: string | null };
      bio: string | null;
      mostrar_cidade: boolean;
      cidade: string | null;
      seguidores: number;
      seguindo: boolean;
      total_posts: number;
      posts: Post[];
    };

export type Comentario = { id: string; autor: string; meu: boolean; texto: string; criado_em: string };
export type PostAberto = { disponivel: false } | { disponivel: true; post: Post; comentarios: Comentario[] };

export const MOTIVOS_DENUNCIA = ['Não é sobre pets', 'Ofensivo ou violento', 'Golpe ou propaganda', 'Maus-tratos a animal'];

async function rpc<T>(nome: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(nome, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const carregarFeed = (antes?: string) => rpc<Feed>('comunidade_feed', { p_antes: antes ?? null, p_limite: 20 });
export const abrirPerfil = (petId: string) => rpc<PerfilPublico>('comunidade_perfil', { p_pet: petId });
export const abrirPost = (postId: string) => rpc<PostAberto>('comunidade_comentarios', { p_post: postId });
export const curtir = (postId: string) => rpc<boolean>('comunidade_curtir', { p_post: postId });
export const seguir = (petId: string) => rpc<boolean>('comunidade_seguir', { p_pet: petId });
export const apagarPost = (postId: string) => rpc<void>('comunidade_apagar_post', { p_post: postId });
export const apagarComentario = (id: string) => rpc<void>('comunidade_apagar_comentario', { p_comentario: id });
export const denunciar = (tipo: 'post' | 'comentario', id: string, motivo: string) =>
  rpc<void>('comunidade_denunciar', { p_tipo: tipo, p_alvo: id, p_motivo: motivo });

export async function comentar(postId: string, texto: string): Promise<void> {
  const limpo = texto.trim();
  if (!limpo) throw new Error('Escreva o comentário.');
  await rpc<string>('comunidade_comentar', { p_post: postId, p_texto: limpo.slice(0, 300) });
}

export const configurarPerfil = (petId: string, ativo: boolean, bio: string, mostrarCidade: boolean) =>
  rpc<void>('comunidade_perfil_configurar', { p_pet: petId, p_ativo: ativo, p_bio: bio.trim() || null, p_mostrar_cidade: mostrarCidade });

/** Envia a foto para a pasta da própria conta e publica o post. */
export async function publicar(userId: string, petId: string, foto: { uri: string; mimeType?: string | null }, legenda: string): Promise<string> {
  const tipo = foto.mimeType ?? 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(tipo)) throw new Error('Escolha uma imagem JPEG, PNG ou WebP.');
  const bytes = await (await fetch(foto.uri)).arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 5 * 1024 * 1024) throw new Error('A foto deve ter até 5 MB.');
  const caminho = `${userId}/${Crypto.randomUUID()}.${tipo === 'image/png' ? 'png' : tipo === 'image/webp' ? 'webp' : 'jpg'}`;
  const { error } = await supabase.storage.from('comunidade').upload(caminho, bytes, { contentType: tipo, upsert: false });
  if (error) throw new Error('Não deu para enviar a foto. Tente de novo.');
  try {
    return await rpc<string>('comunidade_publicar', { p_pet: petId, p_foto_path: caminho, p_legenda: legenda.trim() || null });
  } catch (e) {
    // Post recusado: a foto enviada não fica para trás.
    await supabase.storage.from('comunidade').remove([caminho]);
    throw e;
  }
}

/** Links assinados (1 h) para as fotos dos posts, de uma vez. */
export async function urlsDasFotos(posts: Post[]): Promise<Record<string, string>> {
  const caminhos = [...new Set(posts.map((p) => p.foto_path))];
  if (!caminhos.length) return {};
  const { data, error } = await supabase.storage.from('comunidade').createSignedUrls(caminhos, 3600);
  if (error || !data) return {};
  return Object.fromEntries(data.flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl] as const] : [])));
}

/** Atualiza a curtida na lista sem recarregar. */
export function aplicarCurtida(posts: Post[], postId: string, curti: boolean): Post[] {
  return posts.map((p) => (p.id === postId ? { ...p, curti, curtidas: Math.max(0, p.curtidas + (curti === p.curti ? 0 : curti ? 1 : -1)) } : p));
}

/** "2 anos", "8 meses", "filhote". */
export function idadeTexto(nascimento: string | null, agora = new Date()): string | null {
  if (!nascimento) return null;
  const n = new Date(`${nascimento.slice(0, 10)}T12:00:00`);
  const meses = (agora.getFullYear() - n.getFullYear()) * 12 + agora.getMonth() - n.getMonth() - (agora.getDate() < n.getDate() ? 1 : 0);
  if (meses < 0) return null;
  if (meses < 1) return 'filhote';
  if (meses < 12) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  const anos = Math.floor(meses / 12);
  return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
}
