import { beforeEach, describe, expect, it, vi } from 'vitest'
import { carregarPetsConta, criarCargaPets, type ColecaoPets } from '../pets/carregarPetsConta'
const m = vi.hoisted(() => ({ sessao: vi.fn(), criar: vi.fn(), from: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: m.sessao } }, criarClienteTemporario: m.criar }))
const sessao = (id = 'a') => ({ data: { session: { user: { id }, access_token: `token-${id}` } }, error: null })
const pets = [{ id: 'pet-a', tutor_id: 'a' }]
function consulta(resultado: unknown) {
  const q = { select: () => q, order: () => q, then: (resolve: (r: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(resultado).then(resolve, reject) }
  return q
}
beforeEach(() => {
  vi.resetAllMocks()
  m.sessao.mockResolvedValue(sessao())
  m.criar.mockReturnValue({ from: m.from })
  m.from.mockImplementation(tabela => consulta({ data: tabela === 'pets' ? pets : [{ pet_id: 'pet-a' }], error: null }))
})
describe('pets vinculados à conta', () => {
  it('captura a credencial, mantém cache offline e confere a conta após buscar', async () => {
    expect(await carregarPetsConta('a')).toEqual({ pets, seniores: new Set(['pet-a']) })
    expect(m.criar).toHaveBeenCalledWith('token-a', true)
    expect(m.sessao).toHaveBeenCalledTimes(2)
  })
  it('recusa outra conta, logout e falha de sessão antes da consulta', async () => {
    await expect(carregarPetsConta('b')).rejects.toThrow('conta mudou')
    m.sessao.mockResolvedValue({ data: { session: null }, error: null })
    await expect(carregarPetsConta('a')).rejects.toThrow('conta mudou')
    m.sessao.mockResolvedValue({ data: {}, error: new Error('falha') })
    await expect(carregarPetsConta('a')).rejects.toThrow('conta mudou')
    expect(m.from).not.toHaveBeenCalled()
  })
  it('descarta resposta que chegou depois de mudar a conta', async () => {
    m.sessao.mockResolvedValueOnce(sessao()).mockResolvedValue(sessao('b'))
    await expect(carregarPetsConta('a')).rejects.toThrow('conta mudou')
  })
  it('não trata resposta incompleta, falha de rede ou erro do servidor como lista vazia', async () => {
    for (const resultado of [{ data: null, error: null }, { data: null, error: { message: 'falha SQL' } }, Promise.reject(new Error('Network request failed'))]) {
      m.from.mockImplementation(tabela => consulta(tabela === 'pets' ? resultado : { data: [] }))
      await expect(carregarPetsConta('a')).rejects.toThrow()
    }
  })
  it('lista vazia é válida e falha do sênior não apaga etiquetas nem impede a lista', async () => {
    for (const resultado of [{ data: null, error: { message: 'indisponível' } }, Promise.reject(new Error('sem rede'))]) {
      m.from.mockImplementation(tabela => consulta(tabela === 'pets' ? { data: [] } : resultado))
      expect(await carregarPetsConta('a')).toEqual({ pets: [], seniores: null })
    }
  })
})

function adiar<T>() {
  let resolver!: (valor: T) => void
  let rejeitar!: (erro: Error) => void
  const promessa = new Promise<T>((resolve, reject) => { resolver = resolve; rejeitar = reject })
  return { promessa, resolver, rejeitar }
}
const colecao = (id: string) => ({ pets: [{ id }], seniores: new Set<string>() }) as ColecaoPets
describe('atualização concorrente da lista', () => {
  it('uma consulta antiga não sobrescreve a nova, mesmo chegando depois', async () => {
    const antiga = adiar<ColecaoPets>(), nova = adiar<ColecaoPets>()
    const publicar = vi.fn(), falhar = vi.fn()
    const carga = criarCargaPets(vi.fn().mockReturnValueOnce(antiga.promessa).mockReturnValueOnce(nova.promessa), publicar, falhar)
    const a = carga.recarregar(), b = carga.recarregar()
    nova.resolver(colecao('novo')); await b
    antiga.resolver(colecao('antigo')); await a
    expect(publicar.mock.calls).toEqual([[colecao('novo')]])
    expect(falhar).not.toHaveBeenCalled()
  })
  it('erro antigo não substitui o sucesso atual', async () => {
    const antiga = adiar<ColecaoPets>()
    const publicar = vi.fn(), falhar = vi.fn()
    const carga = criarCargaPets(vi.fn().mockReturnValueOnce(antiga.promessa).mockResolvedValue(colecao('novo')), publicar, falhar)
    const a = carga.recarregar(); await carga.recarregar()
    antiga.rejeitar(new Error('antigo')); await a
    expect(falhar).not.toHaveBeenCalled()
    expect(publicar).toHaveBeenCalledTimes(1)
  })
  it('invalida uma consulta ao desmontar e permite novo ciclo após cleanup', async () => {
    const antiga = adiar<ColecaoPets>()
    const publicar = vi.fn(), falhar = vi.fn()
    const carga = criarCargaPets(vi.fn().mockReturnValueOnce(antiga.promessa).mockResolvedValue(colecao('novo')), publicar, falhar)
    const a = carga.recarregar(); carga.invalidar()
    antiga.resolver(colecao('antigo')); await a
    expect(publicar).not.toHaveBeenCalled()
    await carga.recarregar()
    expect(publicar).toHaveBeenCalledWith(colecao('novo'))
  })
  it('falha atual é tratada e uma nova tentativa pode recuperar', async () => {
    const publicar = vi.fn(), falhar = vi.fn(), erro = new Error('sem rede')
    const carga = criarCargaPets(vi.fn().mockRejectedValueOnce(erro).mockResolvedValue(colecao('novo')), publicar, falhar)
    await expect(carga.recarregar()).resolves.toBeUndefined()
    expect(falhar).toHaveBeenCalledWith(erro)
    await carga.recarregar()
    expect(publicar).toHaveBeenCalledWith(colecao('novo'))
  })
})
