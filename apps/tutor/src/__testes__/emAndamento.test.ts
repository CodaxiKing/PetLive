import { describe, expect, it, vi } from 'vitest'
import { itensEmAndamento } from '../inicio/emAndamento'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

const loja = { id: 'l1', name: 'Patinhas', phone: null, address: null, lat: null, lng: null, pickup_prepare_min: 30, cancel_until_min: 60 }
const pedido = (id: string, status: string, numero = 1) => ({ id, numero, status, loja, starts_at: null, itens: [{ nome: 'Ração 10 kg', qty: 1, unit_cents: 100, product_id: 'p' }] }) as never

describe('em andamento na tela inicial', () => {
  it('ida à clínica e Pix por pagar vêm primeiro; pedidos encerrados somem', () => {
    const itens = itensEmAndamento(
      [pedido('a', 'confirmada'), pedido('b', 'concluida'), pedido('c', 'aguardando_pagamento', 7)],
      'sos1',
      [{ id: 'al', numero: 3, status: 'pago', ano: 2026, pet_nome: 'Rex' }],
    )
    expect(itens.map((i) => i.titulo)).toEqual(['Indo para a clínica', 'Pedido nº 7: falta o Pix', 'Ração 10 kg · Patinhas'])
    expect(itens[1].destino).toEqual({ pathname: '/pagamento/pix', params: { pedido: 'c' } })
    expect(itens[2].sub).toBe('Confirmada')
  })

  it('mostra no máximo três e inclui álbum esperando o Pix', () => {
    const itens = itensEmAndamento(
      [pedido('a', 'enviada'), pedido('b', 'pronta'), pedido('c', 'confirmada')],
      null,
      [{ id: 'al', numero: 3, status: 'aguardando_pagamento', ano: 2026, pet_nome: 'Rex' }],
    )
    expect(itens).toHaveLength(3)
    expect(itens[0].titulo).toBe('Álbum 2026 de Rex: falta o Pix')
    expect(itensEmAndamento([], null, [])).toEqual([])
  })
})
