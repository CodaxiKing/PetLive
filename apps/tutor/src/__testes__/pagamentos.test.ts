import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cpfValido, ErroPix, gerarPix, mascararCpf, tempoRestante, textoCupom } from '../pagamentos/pagamentos'

const m = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: m.rpc, functions: { invoke: m.invoke } } }))

beforeEach(() => vi.clearAllMocks())

describe('pagamentos', () => {
  it('CPF: máscara e dígitos verificadores', () => {
    expect(mascararCpf('52998224725')).toBe('529.982.247-25')
    expect(mascararCpf('5299')).toBe('529.9')
    expect(mascararCpf('529.982.247-2599')).toBe('529.982.247-25')
    expect(cpfValido('529.982.247-25')).toBe(true)
    expect(cpfValido('529.982.247-26')).toBe(false)
    expect(cpfValido('000.000.000-00')).toBe(false)
  })

  it('relógio do Pix não fica negativo', () => {
    const agora = Date.parse('2026-10-30T12:00:00Z')
    expect(tempoRestante('2026-10-30T12:29:41Z', agora)).toBe('29:41')
    expect(tempoRestante('2026-10-30T11:00:00Z', agora)).toBe('00:00')
  })

  it('texto do cupom sem descrição', () => {
    expect(textoCupom({ descricao: null, tipo: 'percentual', valor: 10 })).toBe('10% de desconto')
    expect(textoCupom({ descricao: null, tipo: 'valor', valor: 1500 })).toMatch(/R\$\s15,00 de desconto/)
    expect(textoCupom({ descricao: '10% no primeiro pedido', tipo: 'percentual', valor: 10 })).toBe('10% no primeiro pedido')
  })

  it('gerar Pix devolve o id e traduz o pedido de CPF', async () => {
    m.invoke.mockResolvedValueOnce({ data: { id: 'pg1' }, error: null })
    expect(await gerarPix({ pedido: 'r1' })).toBe('pg1')
    expect(m.invoke).toHaveBeenCalledWith('create-pix-charge', { body: { pedido: 'r1' } })

    const contexto = new Response(JSON.stringify({ erro: 'cpf', mensagem: 'Informe nome e CPF para gerar o Pix.' }), { status: 400 })
    m.invoke.mockResolvedValueOnce({ data: null, error: { message: 'non-2xx', context: contexto } })
    const erro = await gerarPix({ album: 'a1' }, { nome: 'Ana', cpf: '529.982.247-25' }).catch((e) => e)
    expect(erro).toBeInstanceOf(ErroPix)
    expect(erro.codigo).toBe('cpf')
    expect(m.invoke).toHaveBeenLastCalledWith('create-pix-charge', { body: { album: 'a1', nome: 'Ana', cpf: '529.982.247-25' } })

    m.invoke.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } })
    await expect(gerarPix({ pedido: 'r1' })).rejects.toThrow('Confira a internet')
  })
})
