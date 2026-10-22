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

  // Os bytes do arquivo, e não FormData com { uri }: o fetch novo do React
  // Native recusa esse item ("Unsupported FormDataPart implementation").
  let conteudo: ArrayBuffer
  try {
    conteudo = await (await fetch(uri)).arrayBuffer()
  } catch {
    return { url: null, erro: 'Não deu para ler a foto escolhida. Tente outra.' }
  }

  const { error } = await supabase.storage.from('pets').upload(caminho, conteudo, {
    contentType: tipo,
    upsert: true,
  })
  if (error) return { url: null, erro: traduzirErroUpload(error.message) }

  // Limpeza best-effort de versões antigas com outra extensão.
  await limparFotosAntigas(tutorId, petId, nome)

  const { data } = supabase.storage.from('pets').getPublicUrl(caminho)
  // O caminho é sempre o mesmo: o ?v= faz a foto nova aparecer em vez da antiga em cache.
  return { url: `${data.publicUrl}?v=${Date.now()}`, erro: null }
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
