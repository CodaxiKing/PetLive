import { chaveAnonSupabase, supabase, urlSupabase } from '../lib/supabase'
import type { AtivoFoto } from '../pets/CampoFoto'
import { subirComProgresso } from './envioComProgresso'
import {
  arquivosSemRegistro,
  caminhoAnexo,
  ehErroDeRede,
  mimeAceito,
  ordenarAnexos,
  pastasOrfas,
  TAMANHO_MAXIMO,
  validarArquivo,
  type Anexo,
  type TipoAnexo,
} from './anexosRegras'

const BUCKET = 'anexos'
const CAMPOS = 'id, pet_id, tipo, titulo, data, arquivo_path, mime, criado_em'
const PAGINA = 1000
// Caminhos por consulta `in`: mantém a URL do PostgREST curta.
const LOTE_CONFERENCIA = 100

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
 * apagado: nada fica pela metade. Se apagar também falhar (rede caiu),
 * `limparAnexosOrfaos` leva o arquivo numa abertura do app depois de 24 h.
 * `aoProgresso` recebe a fração já enviada da foto (0 a 1).
 */
export async function enviarAnexo(
  tutorId: string,
  petId: string,
  foto: AtivoFoto,
  dados: DadosAnexo,
  aoProgresso?: (fracao: number) => void,
): Promise<Anexo> {
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
  const { data: sessao } = await supabase.auth.getSession()
  const envio = await subirComProgresso({
    base: urlSupabase.replace(/\/+$/, ''),
    apikey: chaveAnonSupabase,
    token: sessao.session?.access_token ?? chaveAnonSupabase,
    bucket: BUCKET,
    caminho,
    bytes,
    mime,
    aoProgresso,
  })
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

/**
 * Apaga do Storage os arquivos que ficaram sem registro: os de pets já
 * excluídos (a cascata leva só os registros) e, nos pets que existem, os de
 * envios cujo registro e cuja limpeza falharam (ou que subiram direto pela
 * API), passada a folga de `arquivosSemRegistro`. Vale também para arquivos
 * soltos na raiz `<uid>/anexos/`, fora de uma pasta de pet (o app nunca grava
 * ali, mas a API deixa). Roda logo depois de excluir um pet e de novo ao abrir
 * o app: se a rede cair no meio, os arquivos saem na próxima vez. As pastas são
 * listadas antes dos pets, para não pegar a de um pet criado nesse meio-tempo,
 * e os arquivos antes dos registros.
 */
export async function limparAnexosOrfaos(tutorId: string): Promise<void> {
  const raiz = `${tutorId}/anexos`
  const itens = await listarTudo(raiz)
  if (!itens) return
  // Subpasta vem sem id; arquivo vem com id.
  const pastas = itens.filter((i) => i.name && !i.id).map((i) => i.name)
  const soltos = itens.filter((i) => i.name && i.id)
  if (pastas.length === 0 && soltos.length === 0) return

  const { data: pets, error: erroPets } = await supabase.from('pets').select('id')
  if (erroPets || !pets) return
  const orfas = pastasOrfas(pastas, pets.map((p) => (p as { id: string }).id))

  await limparSemRegistro(raiz, pastas.filter((p) => !orfas.includes(p)), soltos)

  for (const pasta of orfas) {
    for (;;) {
      const { data: arquivos, error } = await supabase.storage.from(BUCKET).list(`${raiz}/${pasta}`, { limit: 1000 })
      if (error || !arquivos?.length) break
      const caminhos = arquivos.filter((a) => a.name && a.id).map((a) => `${raiz}/${pasta}/${a.name}`)
      if (caminhos.length === 0) break
      const { error: erroRemover } = await supabase.storage.from(BUCKET).remove(caminhos)
      if (erroRemover) return
    }
  }
}

/**
 * Arquivos sem registro nas pastas de pets que existem e soltos na raiz
 * (melhor esforço). As pastas são lidas página a página; os candidatos
 * (antigos o bastante) são conferidos na tabela em lotes, então nenhum limite
 * de linhas faz um arquivo registrado parecer sobra.
 */
async function limparSemRegistro(
  raiz: string,
  pastas: string[],
  soltos: { name: string; created_at?: string | null }[],
): Promise<void> {
  const candidatos = arquivosSemRegistro(raiz, soltos, [])
  for (const pasta of pastas) {
    const itens = await listarTudo(`${raiz}/${pasta}`)
    if (!itens) return
    candidatos.push(...arquivosSemRegistro(`${raiz}/${pasta}`, itens.filter((a) => a.name && a.id), []))
  }

  for (let i = 0; i < candidatos.length; i += LOTE_CONFERENCIA) {
    const lote = candidatos.slice(i, i + LOTE_CONFERENCIA)
    const { data: registros, error } = await supabase.from('anexos').select('arquivo_path').in('arquivo_path', lote)
    if (error || !registros) return
    const registrados = new Set(registros.map((r) => (r as { arquivo_path: string }).arquivo_path))
    const sobras = lote.filter((c) => !registrados.has(c))
    if (sobras.length > 0) {
      const { error: erroRemover } = await supabase.storage.from(BUCKET).remove(sobras)
      if (erroRemover) return
    }
  }
}

/** Itens de uma pasta do bucket, página a página (o Storage devolve no máximo `PAGINA` por vez). */
async function listarTudo(pasta: string): Promise<{ name: string; id: string | null; created_at?: string | null }[] | null> {
  const itens: { name: string; id: string | null; created_at?: string | null }[] = []
  for (let offset = 0; ; offset += PAGINA) {
    const { data, error } = await supabase.storage.from(BUCKET).list(pasta, { limit: PAGINA, offset })
    if (error) return null
    itens.push(...(data ?? []))
    if (!data || data.length < PAGINA) return itens
  }
}

function erroDeEnvio(mensagem: string): ErroAnexo {
  const m = mensagem.toLowerCase()
  if (ehErroDeRede(m)) return new ErroAnexo('Sem conexão com a internet. O anexo não foi salvo.', true)
  if (m.includes('too large') || m.includes('size')) return new ErroAnexo('A foto passa de 10 MB. Escolha uma imagem menor.')
  if (m.includes('mime')) return new ErroAnexo('Só dá para anexar fotos em JPG, PNG ou HEIC.')
  if (m.includes('row-level security') || m.includes('policy')) return new ErroAnexo('Sem permissão para salvar o anexo. Entre novamente.')
  return new ErroAnexo('Não foi possível salvar o anexo. Tente de novo.', true)
}
