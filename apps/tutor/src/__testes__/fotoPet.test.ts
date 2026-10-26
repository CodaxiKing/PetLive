import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enviarFotoPet } from '../pets/foto'
const m = vi.hoisted(() => ({ sessao: vi.fn(), criar: vi.fn(), upload: vi.fn(), url: vi.fn(), remove: vi.fn(), list: vi.fn(), fetch: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: m.sessao } }, criarClienteTemporario: m.criar }))
const sessao = (id = 'a') => ({ data: { session: { user: { id }, access_token: `token-${id}` } }, error: null })
const foto = { tutorId: 'a', petId: 'p', uri: 'file://foto.png', mimeType: 'image/png' }
beforeEach(() => {
  vi.resetAllMocks()
  m.sessao.mockResolvedValue(sessao())
  m.criar.mockReturnValue({ storage: { from: () => ({ upload: m.upload, getPublicUrl: m.url, remove: m.remove, list: m.list }) } })
  m.upload.mockResolvedValue({ error: null })
  m.url.mockReturnValue({ data: { publicUrl: 'https://petlive.test/pets/a/p.png' } })
  m.fetch.mockResolvedValue({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer })
  vi.stubGlobal('fetch', m.fetch)
})
afterEach(() => vi.unstubAllGlobals())
describe('foto do pet vinculada à conta', () => {
  it('envia bytes com a credencial capturada sem apagar versões anteriores', async () => {
    expect(await enviarFotoPet(foto)).toMatchObject({ url: expect.stringContaining('https://petlive.test/pets/a/p.png?v='), erro: null })
    expect(m.criar).toHaveBeenCalledWith('token-a')
    expect(m.upload).toHaveBeenCalledWith('a/p.png', expect.any(ArrayBuffer), { contentType: 'image/png', upsert: true })
    expect(m.sessao).toHaveBeenCalledTimes(3)
    expect(m.list).not.toHaveBeenCalled(); expect(m.remove).not.toHaveBeenCalled()
  })
  it('recusa conta diferente e caminhos inválidos antes de ler/enviar', async () => {
    m.sessao.mockResolvedValueOnce(sessao('b'))
    expect(await enviarFotoPet(foto)).toMatchObject({ url: null, erro: expect.stringContaining('conta mudou') })
    for (const petId of ['', '../p', 'p/outro', 'p\\outro']) expect(await enviarFotoPet({ ...foto, petId })).toMatchObject({ url: null })
    expect(m.fetch).not.toHaveBeenCalled(); expect(m.upload).not.toHaveBeenCalled()
  })
  it('não envia se a conta mudou durante a leitura local', async () => {
    m.sessao.mockResolvedValueOnce(sessao()).mockResolvedValue(sessao('b'))
    expect(await enviarFotoPet(foto)).toMatchObject({ url: null, erro: expect.stringContaining('conta mudou') })
    expect(m.upload).not.toHaveBeenCalled()
  })
  it('não confirma na conta nova um upload iniciado pela antiga', async () => {
    m.sessao.mockResolvedValueOnce(sessao()).mockResolvedValueOnce(sessao()).mockResolvedValue(sessao('b'))
    expect(await enviarFotoPet(foto)).toMatchObject({ url: null, erro: expect.stringContaining('conta mudou') })
    expect(m.url).not.toHaveBeenCalled()
  })
  it('falha local ou foto vazia não chegam ao Storage', async () => {
    m.fetch.mockRejectedValueOnce(new Error('arquivo ausente'))
    expect(await enviarFotoPet(foto)).toMatchObject({ url: null, erro: expect.stringContaining('ler a foto') })
    m.fetch.mockResolvedValueOnce({ arrayBuffer: async () => new ArrayBuffer(0) })
    expect(await enviarFotoPet(foto)).toMatchObject({ url: null, erro: expect.stringContaining('vazia') })
    expect(m.upload).not.toHaveBeenCalled()
  })
  it('propaga falha de upload com mensagem clara e não limpa fotos', async () => {
    for (const [message, esperado] of [['new row violates row-level security policy', 'permissão'], ['too large', 'grande'], ['Network request failed', 'conexão']]) {
      m.upload.mockResolvedValueOnce({ error: { message } })
      expect(await enviarFotoPet(foto)).toMatchObject({ url: null, erro: expect.stringContaining(esperado) })
    }
    m.upload.mockRejectedValueOnce(new Error('Network request failed'))
    expect(await enviarFotoPet(foto)).toMatchObject({ url: null, erro: expect.stringContaining('conexão') })
    expect(m.list).not.toHaveBeenCalled(); expect(m.remove).not.toHaveBeenCalled()
  })
  it('recusa URL incompleta após upload em vez de gerar endereço inválido', async () => {
    m.url.mockReturnValueOnce({ data: {} })
    expect(await enviarFotoPet(foto)).toMatchObject({ url: null, erro: expect.stringContaining('endereço da foto') })
  })
})
