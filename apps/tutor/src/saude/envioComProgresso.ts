export type EnvioStorage = {
  /** URL do projeto Supabase, sem barra no fim. */
  base: string
  apikey: string
  /** Token do tutor logado: é ele que a RLS do bucket confere. */
  token: string
  bucket: string
  caminho: string
  bytes: ArrayBuffer
  mime: string
  /** Fração enviada, de 0 a 1. */
  aoProgresso?: (fracao: number) => void
}

/**
 * Sobe um arquivo para o Storage por XMLHttpRequest, que, ao contrário do
 * `fetch` usado pelo supabase-js, informa o progresso do envio (critério 6).
 * Mesmo endpoint e cabeçalhos do `storage.upload`, sem sobrescrever. Não
 * lança: devolve `{ error }` no formato do supabase-js, com "Network request
 * failed" quando a rede cai, para `erroDeEnvio` oferecer "Tentar novamente".
 */
export function subirComProgresso(envio: EnvioStorage): Promise<{ error: { message: string } | null }> {
  const caminho = envio.caminho.split('/').map(encodeURIComponent).join('/')
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${envio.base}/storage/v1/object/${envio.bucket}/${caminho}`)
    xhr.setRequestHeader('Authorization', `Bearer ${envio.token}`)
    xhr.setRequestHeader('apikey', envio.apikey)
    xhr.setRequestHeader('Content-Type', envio.mime)
    xhr.setRequestHeader('cache-control', 'max-age=3600')
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = (e) => {
      const total = e.total || envio.bytes.byteLength
      if (total > 0) envio.aoProgresso?.(Math.min(1, Math.max(0, e.loaded / total)))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        envio.aoProgresso?.(1)
        resolve({ error: null })
      } else {
        resolve({ error: { message: mensagemDoStorage(xhr.responseText, xhr.status) } })
      }
    }
    xhr.onerror = () => resolve({ error: { message: 'Network request failed' } })
    xhr.ontimeout = () => resolve({ error: { message: 'Network request failed' } })
    xhr.send(envio.bytes)
  })
}

function mensagemDoStorage(corpo: string, status: number): string {
  try {
    const json = JSON.parse(corpo) as { message?: string; error?: string }
    return json.message || json.error || `HTTP ${status}`
  } catch {
    return corpo || `HTTP ${status}`
  }
}
