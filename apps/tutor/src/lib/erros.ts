/**
 * Erro para a tela, em português simples. As mensagens que o banco já escreve
 * para o tutor ("Este horário acabou de ser ocupado.") passam como estão; o
 * que é técnico (em inglês, código do servidor, rede) vira uma frase clara.
 */
export const ERRO_GENERICO = 'Algo deu errado do nosso lado. Tente de novo em instantes.'
export const ERRO_SEM_INTERNET = 'Sem internet. Confira a conexão e tente de novo.'

const REDE = /network request failed|failed to fetch|fetch failed|networkerror|ConnectException|UnknownHost|timed? ?out|aborted/i
const SESSAO = /jwt|refresh token|invalid claim|not authenticated|auth session missing/i
const TECNICO =
  /could not find|schema cache|relation .* does not exist|column .* does not exist|function .* does not exist|permission denied|violates|duplicate key|null value|invalid input|syntax error|PGRST|non-2xx|status code|unexpected|undefined|cannot read|TypeError|native module|is not a function|edge function/i

function textoBruto(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') return (e as { message: string }).message
  return ''
}

/** Parece escrito para gente em português (acentos ou palavras comuns), não um erro de sistema. */
function emPortugues(m: string): boolean {
  return /[ãõçáéíóúâêô]/i.test(m) || /\b(não|nao|tente|escolha|informe|este|esta|você|seu|sua|para|pedido|conta)\b/i.test(m)
}

export function textoDeErro(e: unknown, padrao: string = ERRO_GENERICO): string {
  const m = textoBruto(e).trim()
  if (!m) return padrao
  if (REDE.test(m)) return ERRO_SEM_INTERNET
  if (SESSAO.test(m)) return 'Sua sessão expirou. Entre de novo na conta.'
  if (TECNICO.test(m) || !emPortugues(m)) return padrao
  return m
}
