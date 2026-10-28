import * as Crypto from 'expo-crypto'
import { supabase } from '../lib/supabase'

/** Avaliações das lojas (BUSINESS.md 5.11): só pedido concluído, uma vez por pedido. */
export type Tag = 'atendimento' | 'pontualidade' | 'preco' | 'cuidado' | 'limpeza'
export const TAGS: { valor: Tag; rotulo: string }[] = [
  { valor: 'atendimento', rotulo: 'Atendimento' },
  { valor: 'pontualidade', rotulo: 'Pontualidade' },
  { valor: 'preco', rotulo: 'Preço' },
  { valor: 'cuidado', rotulo: 'Cuidado com o pet' },
  { valor: 'limpeza', rotulo: 'Limpeza' },
]
export const TEXTO_NOTA = ['', 'Ruim', 'Fraco', 'Ok', 'Muito bom', 'Excelente']

export type Avaliacao = { id: string; rating: number; tags: Tag[]; text: string | null; photo_path: string | null; autor: string; criado_em: string; reply_text: string | null; replied_at: string | null }
export type AvaliacoesLoja = { media: number | null; total: number; itens: Avaliacao[] }

export async function avaliacoesDaLoja(lojaId: string): Promise<AvaliacoesLoja | null> {
  const { data, error } = await supabase.rpc('loja_avaliacoes', { p_store: lojaId })
  if (error) throw new Error(error.message)
  return data as AvaliacoesLoja | null
}

export async function avaliacaoDoPedido(pedidoId: string): Promise<{ rating: number } | null> {
  const { data, error } = await supabase.rpc('avaliacao_do_pedido', { p_request: pedidoId })
  if (error) throw new Error(error.message)
  return data as { rating: number } | null
}

export async function enviarAvaliacao(userId: string, pedidoId: string, nota: number, tags: Tag[], texto: string, foto: { uri: string; mimeType?: string | null } | null) {
  if (nota < 1 || nota > 5) throw new Error('Escolha de 1 a 5 estrelas.')
  let caminho: string | null = null
  if (foto) {
    const tipo = foto.mimeType ?? 'image/jpeg'
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(tipo)) throw new Error('Escolha uma imagem JPEG, PNG ou WebP.')
    const bytes = await (await fetch(foto.uri)).arrayBuffer()
    if (!bytes.byteLength || bytes.byteLength > 5 * 1024 * 1024) throw new Error('A foto deve ter até 5 MB.')
    caminho = `${userId}/${Crypto.randomUUID()}.${tipo === 'image/png' ? 'png' : tipo === 'image/webp' ? 'webp' : 'jpg'}`
    const { error } = await supabase.storage.from('avaliacoes').upload(caminho, bytes, { contentType: tipo, upsert: false })
    if (error) throw new Error('Não deu para enviar a foto. Tente sem foto.')
  }
  const { error } = await supabase.rpc('avaliacao_enviar', { p_request: pedidoId, p_nota: nota, p_tags: tags, p_texto: texto.trim() || null, p_foto_path: caminho })
  if (error) {
    if (caminho) await supabase.storage.from('avaliacoes').remove([caminho])
    throw new Error(error.message)
  }
}
