import { supabase } from '../lib/supabase'

export type TipoDocumentoSaude = 'cartao_vacina' | 'exame'

export type DocumentoSaude = {
  id: string
  pet_id: string
  tutor_id: string
  tipo: TipoDocumentoSaude
  titulo: string
  realizado_em: string
  arquivo_path: string
  criado_em: string
}

export async function carregarDocumentosSaude(petId: string): Promise<DocumentoSaude[]> {
  const { data, error } = await supabase
    .from('documentos_saude')
    .select('id, pet_id, tutor_id, tipo, titulo, realizado_em, arquivo_path, criado_em')
    .eq('pet_id', petId)
    .order('realizado_em', { ascending: false })
    .order('criado_em', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as DocumentoSaude[]
}

export async function enviarDocumentoSaude(
  tutorId: string,
  petId: string,
  uri: string,
  mimeType?: string,
): Promise<string> {
  const extensao = mimeType?.includes('png') ? 'png' : mimeType?.includes('webp') ? 'webp' : 'jpg'
  const caminho = `${tutorId}/saude/${petId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensao}`
  const bytes = await (await fetch(uri)).arrayBuffer()
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 10 MB.')
  const { error } = await supabase.storage.from('anexos').upload(caminho, bytes, {
    contentType: mimeType ?? `image/${extensao === 'jpg' ? 'jpeg' : extensao}`,
  })
  if (error) throw new Error('Não foi possível enviar a imagem. Tente novamente.')
  return caminho
}

export async function salvarDocumentoSaude(
  documento: Omit<DocumentoSaude, 'id' | 'criado_em'>,
): Promise<void> {
  const { error } = await supabase.from('documentos_saude').insert(documento)
  if (error) throw new Error(error.message)
}

export async function urlDocumentoSaude(caminho: string): Promise<string> {
  const { data, error } = await supabase.storage.from('anexos').createSignedUrl(caminho, 600)
  if (error || !data?.signedUrl) throw new Error('Não foi possível abrir este documento.')
  return data.signedUrl
}

export async function apagarDocumentoSaude(documento: DocumentoSaude): Promise<void> {
  const { error } = await supabase.from('documentos_saude').delete().eq('id', documento.id)
  if (error) throw new Error('Não foi possível remover este documento.')
  await supabase.storage.from('anexos').remove([documento.arquivo_path]).catch(() => undefined)
}
