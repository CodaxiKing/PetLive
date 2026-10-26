import { beforeEach, describe, expect, it, vi } from 'vitest'
import { escreverPet, excluirPet } from '../pets/escreverPet'
const m = vi.hoisted(() => ({ sessao: vi.fn(), criar: vi.fn(), from: vi.fn(), update: vi.fn(), delete: vi.fn(), single: vi.fn(), maybeSingle: vi.fn(), docs: vi.fn(), remove: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: m.sessao } }, criarClienteTemporario: m.criar }))
const sessao = (id = 'a') => ({ data: { session: { user: { id }, access_token: `token-${id}` } }, error: null })
beforeEach(() => {
  vi.resetAllMocks()
  m.sessao.mockResolvedValue(sessao())
  m.criar.mockReturnValue({ from: m.from, storage: { from: () => ({ remove: m.remove }) } })
  m.single.mockResolvedValue({ data: { id: 'p', nome: 'Mia' }, error: null })
  m.maybeSingle.mockResolvedValue({ data: { id: 'p' }, error: null })
  m.docs.mockResolvedValue({ data: [], error: null })
  m.remove.mockResolvedValue({ error: null })
  m.from.mockImplementation(tabela => {
    if (tabela === 'documentos_saude') return { select: () => ({ eq: m.docs }) }
    const q = { update: m.update, delete: m.delete, eq: () => q, select: () => q, single: m.single, maybeSingle: m.maybeSingle }
    m.update.mockReturnValue(q); m.delete.mockReturnValue(q)
    return q
  })
})
describe('edição e remoção vinculadas à conta', () => {
  it('edita com credencial capturada e confirmação da própria linha', async () => {
    expect(await escreverPet('a', 'p', { nome: 'Mia' })).toMatchObject({ id: 'p', nome: 'Mia' })
    expect(m.criar).toHaveBeenCalledWith('token-a')
    expect(m.update).toHaveBeenCalledWith({ nome: 'Mia' })
    expect(m.sessao).toHaveBeenCalledTimes(2)
  })
  it('recusa conta diferente, logout e ID vazio antes de escrever', async () => {
    await expect(escreverPet('b', 'p', {})).rejects.toThrow('conta mudou')
    await expect(excluirPet('b', 'p')).rejects.toThrow('conta mudou')
    m.sessao.mockResolvedValue({ data: { session: null } })
    await expect(escreverPet('a', 'p', {})).rejects.toThrow('conta mudou')
    await expect(excluirPet('a', '')).rejects.toThrow('Pet inválido')
    expect(m.from).not.toHaveBeenCalled()
  })
  it('não apresenta confirmação de uma conta que mudou durante a edição', async () => {
    m.sessao.mockResolvedValueOnce(sessao()).mockResolvedValue(sessao('b'))
    await expect(escreverPet('a', 'p', { foto_url: null })).rejects.toThrow('conta mudou')
  })
  it('propaga erro de rede/servidor e recusa resposta ausente ou de outro pet', async () => {
    m.single.mockRejectedValueOnce(new Error('Network request failed'))
    await expect(escreverPet('a', 'p', {})).rejects.toThrow('Network request failed')
    for (const resultado of [{ data: null, error: { message: 'somente leitura' } }, { data: null }, { data: { id: 'outro' } }]) {
      m.single.mockResolvedValueOnce(resultado)
      await expect(escreverPet('a', 'p', {})).rejects.toThrow()
    }
  })
  it('só limpa documentos do pet/titular após exclusão confirmada', async () => {
    m.docs.mockResolvedValue({ data: [
      { arquivo_path: 'a/saude/p/exame.pdf' }, { arquivo_path: 'b/saude/p/exame.pdf' },
      { arquivo_path: 'a/saude/outro/exame.pdf' }, { arquivo_path: 'a/saude/p/../outro.pdf' },
      { arquivo_path: 'a/saude/p/..\\outro.pdf' }, { arquivo_path: 'a/saude/p/' }, { arquivo_path: null },
    ] })
    await excluirPet('a', 'p')
    expect(m.remove).toHaveBeenCalledWith(['a/saude/p/exame.pdf'])
    expect(m.maybeSingle.mock.invocationCallOrder[0]).toBeLessThan(m.remove.mock.invocationCallOrder[0])
  })
  it('zero linhas removidas, erro ou falha de rede não viram exclusão concluída', async () => {
    m.docs.mockResolvedValue({ data: [{ arquivo_path: 'a/saude/p/exame.pdf' }] })
    for (const resultado of [{ data: null }, { data: { id: 'outro' } }, { error: { message: 'negado' } }]) {
      m.maybeSingle.mockResolvedValueOnce(resultado)
      await expect(excluirPet('a', 'p')).rejects.toThrow()
    }
    m.maybeSingle.mockRejectedValueOnce(new Error('sem rede'))
    await expect(excluirPet('a', 'p')).rejects.toThrow('sem rede')
    expect(m.remove).not.toHaveBeenCalled()
  })
  it('não apaga o pet se a conta mudou enquanto carregava os documentos', async () => {
    m.sessao.mockResolvedValueOnce(sessao()).mockResolvedValue(sessao('b'))
    await expect(excluirPet('a', 'p')).rejects.toThrow('conta mudou')
    expect(m.delete).not.toHaveBeenCalled()
  })
  it('inventário indisponível não impede a exclusão e limpeza falha não desfaz sucesso', async () => {
    m.docs.mockRejectedValueOnce(new Error('tabela indisponível'))
    await expect(excluirPet('a', 'p')).resolves.toBeUndefined()
    expect(m.remove).not.toHaveBeenCalled()
    m.docs.mockResolvedValue({ data: [{ arquivo_path: 'a/saude/p/exame.pdf' }] })
    m.remove.mockRejectedValueOnce(new Error('sem Storage'))
    await expect(excluirPet('a', 'p')).resolves.toBeUndefined()
  })
})
