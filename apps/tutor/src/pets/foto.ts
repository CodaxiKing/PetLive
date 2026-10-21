import { supabase } from '../lib/supabase'

export type ResultadoFoto =
  | { url: string; erro: null }
  | { url: null; erro: string }

type EnvioFoto = {
  tutorId: string
  petId: string
  /** URI local (file://) vinda do seletor da galeria ou da câmera. */
  uri: string
  mimeType?: string
}

/**
 * Envia a foto do pet para o bucket `pets` e devolve a URL pública.
 * O caminho é `<tutorId>/<petId>.<ext>`, que atende às policies de storage
 * (primeira pasta = uid do dono) e mantém um arquivo por pet.
 */
export async function enviarFotoPet({ tutorId, petId, uri, mimeType }: EnvioFoto): Promise<ResultadoFoto> {
  const extensao = extensaoDe(mimeType)
  const tipo = mimeType ?? `image/${extensao === 'jpg' ? 'jpeg' : extensao}`
  const nome = `${petId}.${extensao}`
  const caminho = `${tutorId}/${nome}`

  const conteudo = new FormData()
  // No React Native o item de upload é { uri, name, type }, que não existe no
  // FormData do DOM — por isso o cast (é o formato aceito pelo fetch nativo).
  conteudo.append('file', { uri, name: nome, type: tipo } as unknown as Blob)

  const { error } = await supabase.storage.from('pets').upload(caminho, conteudo, {
    contentType: tipo,
    upsert: true,
  })
  if (error) return { url: null, erro: traduzirErroUpload(error.message) }

  // Limpeza best-effort de versões antigas com outra extensão.
  await limparFotosAntigas(tutorId, petId, nome)

  const { data } = supabase.storage.from('pets').getPublicUrl(caminho)
  return { url: data.publicUrl, erro: null }
}

function extensaoDe(mimeType?: string): string {
  if (mimeType?.includes('png')) return 'png'
  if (mimeType?.includes('webp')) return 'webp'
  if (mimeType?.includes('heic')) return 'heic'
  return 'jpg'
}

async function limparFotosAntigas(tutorId: string, petId: string, manter: string) {
  try {
    const { data } = await supabase.storage.from('pets').list(tutorId, { search: `${petId}.` })
    const antigas = (data ?? []).filter((f) => f.name !== manter).map((f) => `${tutorId}/${f.name}`)
    if (antigas.length) await supabase.storage.from('pets').remove(antigas)
  } catch {
    // A limpeza é opcional: falha aqui não pode impedir o cadastro.
  }
}

function traduzirErroUpload(mensagem: string): string {
  const m = mensagem.toLowerCase()
  if (m.includes('row-level security') || m.includes('policy')) {
    return 'Sem permissão para enviar a foto. Entre novamente.'
  }
  if (m.includes('too large')) {
    return 'A imagem está muito grande. Escolha uma foto menor.'
  }
  if (m.includes('fetch') || m.includes('network')) {
    return 'Sem conexão com o servidor. A foto não foi enviada.'
  }
  return 'Não foi possível enviar a foto. Tente de novo.'
}
