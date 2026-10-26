import { criarClienteTemporario } from '../lib/supabase'
import { conferirContaPet } from './conta'

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
 * (primeira pasta = uid do dono). Não apaga versões de outro formato antes
 * de o chamador confirmar o vínculo da nova foto no banco.
 */
export async function enviarFotoPet({ tutorId, petId, uri, mimeType }: EnvioFoto): Promise<ResultadoFoto> {
  if (![tutorId, petId].every(id => /^[a-zA-Z0-9_-]+$/.test(id))) return { url: null, erro: 'Pet inválido. Atualize a lista.' }
  try {
    const sessao = await conferirContaPet(tutorId)
    const cliente = criarClienteTemporario(sessao.access_token)
    const extensao = extensaoDe(mimeType)
    const tipo = mimeType ?? `image/${extensao === 'jpg' ? 'jpeg' : extensao}`
    const nome = `${petId}.${extensao}`
    const caminho = `${tutorId}/${nome}`

    // Bytes do arquivo: o fetch nativo não aceita FormData com { uri }.
    let conteudo: ArrayBuffer
    try {
      conteudo = await (await fetch(uri)).arrayBuffer()
    } catch {
      return { url: null, erro: 'Não deu para ler a foto escolhida. Tente outra.' }
    }
    if (!conteudo.byteLength) return { url: null, erro: 'A foto está vazia. Escolha outra imagem.' }
    await conferirContaPet(tutorId)

    const { error } = await cliente.storage.from('pets').upload(caminho, conteudo, {
      contentType: tipo,
      upsert: true,
    })
    if (error) return { url: null, erro: traduzirErroUpload(error.message) }

    await conferirContaPet(tutorId)
    const { data } = cliente.storage.from('pets').getPublicUrl(caminho)
    if (typeof data?.publicUrl !== 'string' || !data.publicUrl) return { url: null, erro: 'Não foi possível confirmar o endereço da foto. Atualize o pet antes de tentar novamente.' }
    // O caminho é sempre o mesmo: o ?v= evita reapresentar a foto anterior do cache.
    return { url: `${data.publicUrl}?v=${Date.now()}`, erro: null }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : ''
    return { url: null, erro: mensagem.includes('A conta mudou') ? mensagem : traduzirErroUpload(mensagem) }
  }
}

function extensaoDe(mimeType?: string): string {
  if (mimeType?.includes('png')) return 'png'
  if (mimeType?.includes('webp')) return 'webp'
  if (mimeType?.includes('heic')) return 'heic'
  return 'jpg'
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
