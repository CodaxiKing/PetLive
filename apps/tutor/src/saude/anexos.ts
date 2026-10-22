import { supabase } from '../lib/supabase'
import type { AtivoFoto } from '../pets/CampoFoto'
import {
  caminhoAnexo,
  ehErroDeRede,
  mimeAceito,
  ordenarAnexos,
  TAMANHO_MAXIMO,
  validarArquivo,
  type Anexo,
  type TipoAnexo,
} from './anexosRegras'

const BUCKET = 'anexos'
const CAMPOS = 'id, pet_id, tipo, titulo, data, arquivo_path, mime, criado_em'

export type DadosAnexo = { tipo: TipoAnexo; titulo: string | null; data: string }

/** Erro do envio; `tentarDeNovo` quando foi a rede (a tela oferece "Tentar novamente"). */
export class ErroAnexo extends Error {
  tentarDeNovo: boolean
  constructor(mensagem: string, tentarDeNovo = false) {
    super(mensagem)
    this.tentarDeNovo = tentarDeNovo
  }
}

export async function carregarAnexos(petId: string): Promise<Anexo[]> {
  const { data, error } = await supabase.from('anexos').select(CAMPOS).eq('pet_id', petId)
  if (error) throw new Error(error.message)
  return ordenarAnexos((data ?? []) as Anexo[])
}

export async function carregarAnexo(id: string): Promise<Anexo | null> {
  const { data, error } = await supabase.from('anexos').select(CAMPOS).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data as Anexo | null
}

/** Links temporários (1 h): o bucket é privado e só o dono assina. */
export async function urlsAnexos(caminhos: string[]): Promise<Record<string, string>> {
  if (caminhos.length === 0) return {}
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(caminhos, 3600)
  return Object.fromEntries((data ?? []).flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl] as const] : [])))
}

/**
 * Sobe a foto e cria o registro. Se o registro falhar, o arquivo enviado é
 * apagado: nada fica pela metade.
 */
export async function enviarAnexo(tutorId: string, petId: string, foto: AtivoFoto, dados: DadosAnexo): Promise<Anexo> {
  const mime = mimeAceito(foto.mimeType, foto.uri)
  const recusa = validarArquivo(mime, foto.tamanho)
  if (recusa || !mime) throw new ErroAnexo(recusa ?? 'Arquivo não aceito.')

  let bytes: ArrayBuffer
  try {
    bytes = await (await fetch(foto.uri)).arrayBuffer()
  } catch {
    throw new ErroAnexo('Não deu para ler a foto escolhida. Tente outra.')
  }
  if (bytes.byteLength > TAMANHO_MAXIMO) throw new ErroAnexo(validarArquivo(mime, bytes.byteLength) ?? '')

  const caminho = caminhoAnexo(tutorId, petId, mime)
  const envio = await supabase.storage.from(BUCKET).upload(caminho, bytes, { contentType: mime }).catch((e: unknown) => ({
    error: { message: e instanceof Error ? e.message : String(e) },
  }))
  if (envio.error) throw erroDeEnvio(envio.error.message)

  const { data, error } = await supabase
    .from('anexos')
    .insert({ pet_id: petId, tipo: dados.tipo, titulo: dados.titulo, data: dados.data, arquivo_path: caminho, mime })
    .select(CAMPOS)
    .single()
  if (error) {
    await supabase.storage.from(BUCKET).remove([caminho]).catch(() => undefined)
    throw erroDeEnvio(error.message)
  }
  return data as Anexo
}

export async function atualizarAnexo(id: string, dados: DadosAnexo): Promise<void> {
  const { error } = await supabase.from('anexos').update(dados).eq('id', id)
  if (error) throw erroDeEnvio(error.message)
}

/**
 * Apaga o arquivo e depois o registro. Se o registro falhar, tentar de novo
 * funciona (remover um arquivo que já saiu não dá erro).
 */
export async function apagarAnexo(anexo: Anexo): Promise<void> {
  const { error: erroArquivo } = await supabase.storage.from(BUCKET).remove([anexo.arquivo_path])
  if (erroArquivo) throw erroDeEnvio(erroArquivo.message)
  const { error } = await supabase.from('anexos').delete().eq('id', anexo.id)
  if (error) throw erroDeEnvio(error.message)
}

/** Caminhos dos arquivos do pet, lidos antes de excluí-lo (a cascata leva só os registros). */
export async function caminhosAnexosDoPet(petId: string): Promise<string[]> {
  const { data } = await supabase.from('anexos').select('arquivo_path').eq('pet_id', petId)
  return (data ?? []).map((a) => (a as { arquivo_path: string }).arquivo_path)
}

export async function removerArquivosAnexos(caminhos: string[]): Promise<void> {
  if (caminhos.length) await supabase.storage.from(BUCKET).remove(caminhos).catch(() => undefined)
}

function erroDeEnvio(mensagem: string): ErroAnexo {
  const m = mensagem.toLowerCase()
  if (ehErroDeRede(m)) return new ErroAnexo('Sem conexão com a internet. O anexo não foi salvo.', true)
  if (m.includes('too large') || m.includes('size')) return new ErroAnexo('A foto passa de 10 MB. Escolha uma imagem menor.')
  if (m.includes('mime')) return new ErroAnexo('Só dá para anexar fotos em JPG, PNG ou HEIC.')
  if (m.includes('row-level security') || m.includes('policy')) return new ErroAnexo('Sem permissão para salvar o anexo. Entre novamente.')
  return new ErroAnexo('Não foi possível salvar o anexo. Tente de novo.', true)
}
