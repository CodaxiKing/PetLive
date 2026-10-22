import { beforeEach, describe, expect, it, vi } from 'vitest'

// O bucket `anexos` também guarda recibos de despesas e fotos da linha do
// tempo, e só aceita JPG, PNG e HEIC. O app recusa os outros formatos antes de
// enviar, com uma mensagem clara, em vez de deixar o storage devolver erro.
const envios: { caminho: string; contentType: string }[] = []

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: async (caminho: string, _bytes: ArrayBuffer, opcoes: { contentType: string }) => {
          envios.push({ caminho, contentType: opcoes.contentType })
          return { data: { path: caminho }, error: null }
        },
      }),
    },
  },
}))

const { enviarRecibo } = await import('../despesas/despesas')
const { enviarFotoMarco } = await import('../pets/linhaDoTempo')

const envia = [
  ['recibo', enviarRecibo, 'despesas'],
  ['foto do marco', enviarFotoMarco, 'marcos'],
] as const

describe.each(envia)('%s no bucket anexos', (_nome, enviar, pasta) => {
  beforeEach(() => {
    envios.length = 0
    vi.stubGlobal('fetch', async () => ({ arrayBuffer: async () => new ArrayBuffer(3) }))
  })

  it.each(['image/webp', 'image/gif'])('recusa %s sem chamar o storage', async (mime) => {
    await expect(enviar('u', 'file:///foto.webp', mime)).rejects.toThrow('Só dá para enviar fotos em JPG, PNG ou HEIC.')
    expect(envios).toEqual([])
  })

  it('HEIC do iPhone sobe como image/heic', async () => {
    const caminho = await enviar('u', 'file:///IMG_0001.HEIC', 'image/heif')
    expect(caminho).toMatch(new RegExp(`^u/${pasta}/\\d+\\.heic$`))
    expect(envios).toEqual([{ caminho, contentType: 'image/heic' }])
  })

  it('sem mime, usa a extensão do arquivo', async () => {
    const caminho = await enviar('u', 'file:///foto.jpeg')
    expect(envios).toEqual([{ caminho, contentType: 'image/jpeg' }])
  })
})
