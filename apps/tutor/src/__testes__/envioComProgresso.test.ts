import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { subirComProgresso, type EnvioStorage } from '../saude/envioComProgresso'

// XMLHttpRequest falso: guarda o pedido e deixa o teste disparar progresso, resposta ou queda de rede.
class XhrFalso {
  static ultimo: XhrFalso
  metodo = ''
  url = ''
  cabecalhos: Record<string, string> = {}
  corpo: unknown
  status = 0
  responseText = ''
  upload: { onprogress: ((e: { loaded: number; total: number }) => void) | null } = { onprogress: null }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  ontimeout: (() => void) | null = null
  constructor() {
    XhrFalso.ultimo = this
  }
  open(metodo: string, url: string) {
    this.metodo = metodo
    this.url = url
  }
  setRequestHeader(nome: string, valor: string) {
    this.cabecalhos[nome] = valor
  }
  send(corpo: unknown) {
    this.corpo = corpo
  }
  responder(status: number, corpo = '') {
    this.status = status
    this.responseText = corpo
    this.onload?.()
  }
}

const bytes = new ArrayBuffer(1000)
const envio = (aoProgresso?: (f: number) => void): EnvioStorage => ({
  base: 'http://127.0.0.1:54321',
  apikey: 'anon',
  token: 'token-do-tutor',
  bucket: 'anexos',
  caminho: 'uid/anexos/pet 1/123.jpg',
  bytes,
  mime: 'image/jpeg',
  aoProgresso,
})

describe('subirComProgresso', () => {
  beforeEach(() => vi.stubGlobal('XMLHttpRequest', XhrFalso))
  afterEach(() => vi.unstubAllGlobals())

  it('envia para o endpoint do Storage com o token do tutor, o tipo e sem sobrescrever', async () => {
    const promessa = subirComProgresso(envio())
    const xhr = XhrFalso.ultimo
    expect(xhr.metodo).toBe('POST')
    expect(xhr.url).toBe('http://127.0.0.1:54321/storage/v1/object/anexos/uid/anexos/pet%201/123.jpg')
    expect(xhr.cabecalhos).toMatchObject({
      Authorization: 'Bearer token-do-tutor',
      apikey: 'anon',
      'Content-Type': 'image/jpeg',
      'x-upsert': 'false',
    })
    expect(xhr.corpo).toBe(bytes)
    xhr.responder(200, '{"Key":"anexos/uid/anexos/pet 1/123.jpg"}')
    await expect(promessa).resolves.toEqual({ error: null })
  })

  it('informa o progresso em fração e termina em 100%', async () => {
    const fracoes: number[] = []
    const promessa = subirComProgresso(envio((f) => fracoes.push(f)))
    const xhr = XhrFalso.ultimo
    xhr.upload.onprogress?.({ loaded: 250, total: 1000 })
    xhr.upload.onprogress?.({ loaded: 600, total: 0 }) // sem total: usa o tamanho dos bytes
    xhr.responder(200)
    await promessa
    expect(fracoes).toEqual([0.25, 0.6, 1])
  })

  it('devolve a mensagem do Storage quando ele recusa (tipo ou tamanho)', async () => {
    const promessa = subirComProgresso(envio())
    XhrFalso.ultimo.responder(415, '{"statusCode":"415","error":"invalid_mime_type","message":"mime type image/gif is not supported"}')
    await expect(promessa).resolves.toEqual({ error: { message: 'mime type image/gif is not supported' } })
  })

  it('queda de rede vira "Network request failed", sem lançar', async () => {
    const promessa = subirComProgresso(envio())
    XhrFalso.ultimo.onerror?.()
    await expect(promessa).resolves.toEqual({ error: { message: 'Network request failed' } })
  })
})
