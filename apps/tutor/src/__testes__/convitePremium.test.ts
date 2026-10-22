import { beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
vi.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => push(...args) } }))

const { conviteSeRecusado } = await import('../pets/convitePremium')
const { erroDoServidor } = await import('../pets/limite')

describe('conviteSeRecusado', () => {
  beforeEach(() => push.mockClear())

  it('recusa do servidor (PT402) abre o convite Premium do pet', () => {
    expect(conviteSeRecusado({ code: 'PT402', hint: 'somente_leitura', message: 'x' }, 'pet-1')).toBe(true)
    expect(push).toHaveBeenCalledWith({ pathname: '/premium', params: { motivo: 'somente_leitura', pet: 'pet-1' } })
  })

  it('reconhece a recusa que chega como exceção (salvarViagem, salvarDespesa, ligarLembrete)', () => {
    expect(conviteSeRecusado(erroDoServidor({ message: 'x', code: 'PT402', hint: 'limite_pets' }))).toBe(true)
    expect(push).toHaveBeenCalledWith({ pathname: '/premium', params: { motivo: 'limite_pets' } })
  })

  it('outro erro não abre nada: a tela mostra a mensagem de sempre', () => {
    expect(conviteSeRecusado(new Error('sem rede'), 'pet-1')).toBe(false)
    expect(conviteSeRecusado({ code: '42501', message: 'x' }, null)).toBe(false)
    expect(push).not.toHaveBeenCalled()
  })
})
