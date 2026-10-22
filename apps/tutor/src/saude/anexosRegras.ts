/** Regras puras dos anexos de saúde (sem Supabase, para testar). */

export type TipoAnexo = 'vacina' | 'exame'

export type Anexo = {
  id: string
  pet_id: string
  tipo: TipoAnexo
  titulo: string | null
  /** 'YYYY-MM-DD' */
  data: string
  arquivo_path: string
  mime: MimeAnexo
  criado_em: string
}

export const TIPOS_ANEXO: { valor: TipoAnexo; rotulo: string }[] = [
  { valor: 'vacina', rotulo: 'Cartão de vacina' },
  { valor: 'exame', rotulo: 'Exame' },
]

export function rotuloTipo(tipo: TipoAnexo): string {
  return tipo === 'vacina' ? 'Cartão de vacina' : 'Exame'
}

/** Limite do bucket `anexos` (a migração usa o mesmo valor). */
export const TAMANHO_MAXIMO = 10 * 1024 * 1024

export type MimeAnexo = 'image/jpeg' | 'image/png' | 'image/heic'

/**
 * Normaliza o tipo do arquivo a partir do mime ou da extensão da URI.
 * Devolve null quando não é JPG, PNG ou HEIC.
 */
export function mimeAceito(mimeType: string | undefined, uri: string): MimeAnexo | null {
  const m = (mimeType ?? '').toLowerCase()
  if (m === 'image/jpeg' || m === 'image/jpg') return 'image/jpeg'
  if (m === 'image/png') return 'image/png'
  if (m === 'image/heic' || m === 'image/heif') return 'image/heic'
  if (m) return null
  const extensao = uri.split('?')[0].split('.').pop()?.toLowerCase()
  if (extensao === 'jpg' || extensao === 'jpeg') return 'image/jpeg'
  if (extensao === 'png') return 'image/png'
  if (extensao === 'heic' || extensao === 'heif') return 'image/heic'
  return null
}

export function extensaoDoMime(mime: MimeAnexo): string {
  return mime === 'image/png' ? 'png' : mime === 'image/heic' ? 'heic' : 'jpg'
}

/** Motivo para recusar o arquivo, ou null quando ele pode subir. */
export function validarArquivo(mime: MimeAnexo | null, tamanho: number | undefined): string | null {
  if (!mime) return 'Só dá para anexar fotos em JPG, PNG ou HEIC.'
  if (tamanho !== undefined && tamanho > TAMANHO_MAXIMO) {
    return 'A foto passa de 10 MB, mesmo comprimida. Tire outra foto ou escolha uma imagem menor.'
  }
  return null
}

/** Caminho no bucket: a primeira pasta é o uid (policies de storage) e a tabela exige `<uid>/anexos/`. */
export function caminhoAnexo(tutorId: string, petId: string, mime: MimeAnexo, agora = Date.now()): string {
  return `${tutorId}/anexos/${petId}/${agora}.${extensaoDoMime(mime)}`
}

/**
 * Pastas `<uid>/anexos/<pet>` cujo pet não existe mais (o nome da pasta é o
 * id do pet). Os registros saem em cascata com o pet; os arquivos não.
 */
export function pastasOrfas(pastas: string[], petIds: string[]): string[] {
  const existentes = new Set(petIds)
  return pastas.filter((p) => !existentes.has(p))
}

/**
 * Folga antes de tratar um arquivo sem registro como sobra: o envio sobe o
 * arquivo e só depois cria o registro, então um arquivo recente pode ser de
 * um envio ainda em andamento. Passadas 24 h, o arquivo sem registro sai.
 */
export const FOLGA_ARQUIVO_SEM_REGISTRO = 24 * 60 * 60 * 1000

/**
 * Caminhos de `pasta` que nenhum anexo usa e que já passaram da folga: sobra
 * de um envio cujo registro e cuja limpeza falharam, ou arquivo que subiu
 * direto pela API sem passar pelo app. Sem data de criação, não apaga.
 */
export function arquivosSemRegistro(
  pasta: string,
  arquivos: { name: string; created_at?: string | null }[],
  registrados: string[],
  agora = Date.now(),
): string[] {
  const usados = new Set(registrados)
  return arquivos
    .filter((a) => {
      const criado = a.created_at ? Date.parse(a.created_at) : NaN
      return !Number.isNaN(criado) && agora - criado > FOLGA_ARQUIVO_SEM_REGISTRO
    })
    .map((a) => `${pasta}/${a.name}`)
    .filter((caminho) => !usados.has(caminho))
}

/** Do mais recente para o mais antigo (data e, no empate, envio). */
export function ordenarAnexos(anexos: Anexo[]): Anexo[] {
  return [...anexos].sort((a, b) => b.data.localeCompare(a.data) || b.criado_em.localeCompare(a.criado_em))
}

export function filtrarAnexos(anexos: Anexo[], tipo: TipoAnexo | null): Anexo[] {
  return tipo ? anexos.filter((a) => a.tipo === tipo) : anexos
}

/** Título mostrado na lista: o informado ou o nome do tipo. */
export function tituloAnexo(anexo: Pick<Anexo, 'tipo' | 'titulo'>): string {
  return anexo.titulo?.trim() || rotuloTipo(anexo.tipo)
}

/** Erro de envio que vale tentar de novo (rede caiu). */
export function ehErroDeRede(mensagem: string): boolean {
  const m = mensagem.toLowerCase()
  return m.includes('network') || m.includes('fetch') || m.includes('timeout') || m.includes('conex')
}
