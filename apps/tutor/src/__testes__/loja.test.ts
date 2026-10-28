import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adicionarAoCarrinho, enviarSolicitacao, esvaziarCarrinho, horarioDeHoje, lerCarrinho, lojaDoLugar, mudarQuantidade, podeCancelar, subtotalCarrinho, taxaEntrega } from '../loja/loja'

const m = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: m.rpc } }))

const racao = { id: 'p1', name: 'Ração', price_cents: 15000, photo_url: null }
const bolinha = { id: 'p2', name: 'Bolinha', price_cents: 1500, photo_url: null }

beforeEach(() => {
  vi.clearAllMocks()
  esvaziarCarrinho()
})

describe('loja', () => {
  it('carrinho soma quantidades e fica numa loja só', () => {
    expect(adicionarAoCarrinho('loja1', racao, 1)).toBe('ok')
    adicionarAoCarrinho('loja1', racao, 2)
    adicionarAoCarrinho('loja1', bolinha, 1)
    expect(lerCarrinho().itens.map((i) => i.qty)).toEqual([3, 1])
    expect(subtotalCarrinho(lerCarrinho())).toBe(46500)
    expect(adicionarAoCarrinho('loja2', bolinha, 1)).toBe('outra_loja')
    mudarQuantidade('p1', 0)
    mudarQuantidade('p2', 0)
    expect(lerCarrinho()).toEqual({ lojaId: null, itens: [] })
  })

  it('taxa de entrega com mínimo e frete grátis', () => {
    const loja = { delivery_fee_cents: 800, delivery_min_order_cents: 2000, delivery_free_over_cents: 20000 }
    expect(taxaEntrega(loja, 1500)).toEqual({ ok: false, taxa: 0, falta: 500 })
    expect(taxaEntrega(loja, 5000)).toEqual({ ok: true, taxa: 800, falta: 0 })
    expect(taxaEntrega(loja, 20000)).toEqual({ ok: true, taxa: 0, falta: 0 })
    expect(taxaEntrega({ ...loja, delivery_free_over_cents: null }, 90000).taxa).toBe(800)
  })

  it('envia endereço só na entrega e mostra o erro do banco', async () => {
    m.rpc.mockResolvedValue({ data: { id: 's1', status: 'enviada', total_cents: 15000 }, error: null })
    await enviarSolicitacao('loja1', [{ product_id: 'p1', qty: 1 }], 'retirada', '  oi ', 'end1')
    expect(m.rpc).toHaveBeenCalledWith('solicitacao_criar', expect.objectContaining({ p_fulfillment: 'retirada', p_message: 'oi', p_address_id: null, p_pay_method: 'na_loja' }))
    m.rpc.mockResolvedValue({ data: null, error: { message: 'Antibiótico é vendido só na loja, com receita.' } })
    await expect(enviarSolicitacao('loja1', [{ product_id: 'p3', qty: 1 }], 'entrega', '', 'end1')).rejects.toThrow('receita')
    await expect(enviarSolicitacao('loja1', [], 'retirada', '', null)).rejects.toThrow('ao menos')
  })

  it('só procura loja para lugar do PetLive', async () => {
    expect(await lojaDoLugar('ChIJ-google-place')).toBeNull()
    expect(m.rpc).not.toHaveBeenCalled()
    m.rpc.mockResolvedValue({ data: 'loja9', error: null })
    expect(await lojaDoLugar('81000000-0000-4000-8000-000000000001')).toBe('loja9')
  })

  it('cancelar e horário de hoje', () => {
    expect(podeCancelar({ status: 'enviada' })).toBe(true)
    expect(podeCancelar({ status: 'pronta' })).toBe(false)
    const segunda = new Date(2026, 9, 26, 10)
    expect(horarioDeHoje({ horarios: [{ weekday: 1, opens: '08:00', closes: '18:00' }] }, segunda)).toBe('Hoje 08:00 às 18:00')
    expect(horarioDeHoje({ horarios: [{ weekday: 2, opens: '08:00', closes: '18:00' }] }, segunda)).toBe('Fechada hoje')
    expect(horarioDeHoje({ horarios: [] }, segunda)).toBeNull()
  })
})

describe('chat', () => {
  it('junta mensagens sem repetir e em ordem', async () => {
    const { juntarMensagens } = await import('../loja/chat')
    const a = { id: 1, da_loja: false, body: 'oi', at: '2026-10-28T10:00:00Z', lida: false }
    const b = { id: 2, da_loja: true, body: 'olá', at: '2026-10-28T10:01:00Z', lida: false }
    expect(juntarMensagens([b], [a, b, { ...a, lida: true }]).map((m) => [m.id, m.lida])).toEqual([[1, true], [2, false]])
  })
})

describe('reservas', () => {
  it('dias, duração e link da agenda', async () => {
    const { diaIso, duracaoTexto, linkAgenda, proximosDias } = await import('../loja/reservas')
    const dias = proximosDias(3, new Date(2026, 9, 30, 15))
    expect(dias.map(diaIso)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
    expect(duracaoTexto(90)).toBe('1h30')
    expect(duracaoTexto(120)).toBe('2h')
    expect(duracaoTexto(45)).toBe('45 min')
    const link = linkAgenda('Banho · Loja', '2026-10-30T12:00:00.000Z', '2026-10-30T13:30:00.000Z', 'Rua A')
    expect(link).toContain('dates=20261030T120000Z%2F20261030T133000Z')
    expect(link.startsWith('https://calendar.google.com/')).toBe(true)
  })

  it('reserva manda o horário e o pet', async () => {
    const { reservar } = await import('../loja/reservas')
    m.rpc.mockResolvedValue({ data: { id: 'r1', status: 'enviada' }, error: null })
    await reservar('s1', '2026-10-30T12:00:00Z', 'pet1', ' ')
    expect(m.rpc).toHaveBeenCalledWith('servico_reservar', { p_service: 's1', p_inicio: '2026-10-30T12:00:00Z', p_pet: 'pet1', p_message: null, p_vagas: 1 })
  })
})
