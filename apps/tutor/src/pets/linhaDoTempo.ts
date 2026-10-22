import { supabase } from '../lib/supabase'
import { extensaoDoMime, mimeAceito } from '../saude/anexosRegras'

/** Item da linha do tempo (função linha_do_tempo): marco manual ou automático. */
export type ItemLinha = {
  id: string
  tipo: 'marco' | 'chegada' | 'nascimento' | 'aniversario' | 'vacina' | 'consulta' | 'peso'
  data: string
  titulo: string
  descricao: string | null
  foto_path: string | null
  manual: boolean
}

export type Marco = { id: string; pet_id: string; data: string; titulo: string; descricao: string | null; foto_path: string | null }

export async function carregarLinha(petId: string): Promise<ItemLinha[]> {
  const { data, error } = await supabase.rpc('linha_do_tempo', { p_pet: petId })
  if (error) throw new Error(error.message)
  return (data ?? []) as ItemLinha[]
}

/** Links temporários (1 h) das fotos: o bucket `anexos` é privado. */
export async function urlsFotos(caminhos: string[]): Promise<Record<string, string>> {
  if (caminhos.length === 0) return {}
  const { data } = await supabase.storage.from('anexos').createSignedUrls(caminhos, 3600)
  return Object.fromEntries((data ?? []).flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl] as const] : [])))
}

export async function carregarMarco(id: string): Promise<Marco | null> {
  const { data, error } = await supabase.from('marcos').select('id, pet_id, data, titulo, descricao, foto_path').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data as Marco | null
}

export async function salvarMarco(id: string | null, marco: Omit<Marco, 'id'>): Promise<void> {
  const { error } = id ? await supabase.from('marcos').update(marco).eq('id', id) : await supabase.from('marcos').insert(marco)
  if (error) throw new Error(error.message)
}

/** Tira do armazenamento a foto que o marco deixou de usar. */
export async function removerFotoMarco(caminho: string): Promise<void> {
  await supabase.storage.from('anexos').remove([caminho]).catch(() => undefined)
}

export async function apagarMarco(marco: Marco): Promise<void> {
  const { error } = await supabase.from('marcos').delete().eq('id', marco.id)
  if (error) throw new Error(error.message)
  if (marco.foto_path) await supabase.storage.from('anexos').remove([marco.foto_path]).catch(() => undefined)
}

/** Foto do marco na pasta do tutor no bucket privado (envia os bytes). */
export async function enviarFotoMarco(tutorId: string, uri: string, mimeType?: string): Promise<string> {
  // O bucket só aceita JPG, PNG e HEIC.
  const mime = mimeAceito(mimeType, uri)
  if (!mime) throw new Error('Só dá para enviar fotos em JPG, PNG ou HEIC.')
  const caminho = `${tutorId}/marcos/${Date.now()}.${extensaoDoMime(mime)}`
  const bytes = await (await fetch(uri)).arrayBuffer()
  const { error } = await supabase.storage.from('anexos').upload(caminho, bytes, { contentType: mime })
  if (error) throw new Error('Não deu para enviar a foto.')
  return caminho
}
