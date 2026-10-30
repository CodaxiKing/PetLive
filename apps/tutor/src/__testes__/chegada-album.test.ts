import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enderecoPostalCompleto, linhaEndereco, mascararCep, pedirAlbum } from '../pets/albumPedido'
import { avisarClinica, haQuanto, minutosAte, textoChego } from '../sos/chegada'

const m = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: m.rpc } }))
vi.mock('react-native', () => ({ Linking: {}, Share: {} }))
vi.mock('../pets/linkCarteirinha', () => ({ gerarLink: vi.fn(async () => ({ codigo: 'FICHA123', expira_em: '' })) }))

beforeEach(() => {
  vi.clearAllMocks()
  m.rpc.mockResolvedValue({ data: 'aviso1', error: null })
})

describe('SOS pré-chegada', () => {
  it('tempo de carro com limites', () => {
    expect(minutosAte(3.6)).toBe(9)
    expect(minutosAte(0.2)).toBe(3)
    expect(minutosAte(500)).toBe(120)
  })

  it('contagem até chegar e há quanto tempo', () => {
    const agora = Date.parse('2026-10-30T12:00:00Z')
    expect(textoChego('2026-10-30T12:09:00Z', agora)).toBe('Chego em 9 min')
    expect(textoChego('2026-10-30T11:59:00Z', agora)).toBe('Chegando')
    expect(haQuanto('2026-10-30T11:59:40Z', agora)).toBe('agora')
    expect(haQuanto('2026-10-30T11:57:00Z', agora)).toBe('há 3 min')
    expect(haQuanto('2026-10-30T10:00:00Z', agora)).toBe('há 2 h')
  })

  it('gera a ficha de emergência e avisa a clínica com ela', async () => {
    expect(await avisarClinica('pet1', 'clin1', 9)).toBe('aviso1')
    expect(m.rpc).toHaveBeenCalledWith('sos_chegada_criar', { p_store: 'clin1', p_pet: 'pet1', p_codigo: 'FICHA123', p_eta_min: 9 })
  })
})

describe('pedido do álbum', () => {
  it('CEP e endereço postal', () => {
    expect(mascararCep('20510060')).toBe('20510-060')
    expect(mascararCep('205')).toBe('205')
    expect(enderecoPostalCompleto({ street: 'Rua Uruguai', cep: '20510060', city: 'Rio de Janeiro' })).toBe(true)
    expect(enderecoPostalCompleto({ street: 'Rua Uruguai', cep: null, city: 'Rio de Janeiro' })).toBe(false)
    expect(enderecoPostalCompleto({ street: 'Rua Uruguai', cep: '20510060', city: null })).toBe(false)
    expect(linhaEndereco({ street: 'Rua Uruguai', number: '380', neighborhood: 'Tijuca' })).toBe('Rua Uruguai, 380 · Tijuca')
  })

  it('envia a seleção na ordem do álbum', async () => {
    m.rpc.mockResolvedValueOnce({ data: { id: 'alb1', total_cents: 16750 }, error: null })
    expect((await pedirAlbum('pet1', 2026, 'capa_dura_21x28', ['a', 'b'], 'end1')).id).toBe('alb1')
    expect(m.rpc).toHaveBeenCalledWith('album_pedido_criar', { p_pet: 'pet1', p_ano: 2026, p_formato: 'capa_dura_21x28', p_itens: ['a', 'b'], p_address: 'end1' })
  })
})
