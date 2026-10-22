import { describe, expect, it } from 'vitest'
import { erroDoServidor, LIMITE_PETS, motivoPremiumDoErro, podeCadastrarPet, reativaSomenteLeitura } from '../pets/limite'

describe('podeCadastrarPet', () => {
  it('no grátis é 1 pet ativo', () => {
    expect(podeCadastrarPet('gratis', 0)).toBe(true)
    expect(podeCadastrarPet('gratis', 1)).toBe(false)
    expect(podeCadastrarPet('gratis', 3)).toBe(false)
  })
  it('no Premium cadastra vários, até o limite da seção 10', () => {
    expect(podeCadastrarPet('premium', 1)).toBe(true)
    expect(podeCadastrarPet('premium', 5)).toBe(true)
    expect(podeCadastrarPet('premium', LIMITE_PETS.premium)).toBe(false)
  })
})

describe('reativaSomenteLeitura', () => {
  it('no grátis, quem volta da memória com outro pet ativo fica só para consulta', () => {
    expect(reativaSomenteLeitura('gratis', 1)).toBe(true)
    expect(reativaSomenteLeitura('gratis', 0)).toBe(false)
  })
  it('no Premium volta editável', () => {
    expect(reativaSomenteLeitura('premium', 2)).toBe(false)
  })
})

describe('motivoPremiumDoErro', () => {
  it('reconhece a recusa do servidor pelo SQLSTATE PT402', () => {
    expect(motivoPremiumDoErro({ code: 'PT402', hint: 'limite_pets' })).toBe('limite_pets')
    expect(motivoPremiumDoErro({ code: 'PT402', hint: 'somente_leitura' })).toBe('somente_leitura')
    expect(motivoPremiumDoErro({ code: 'PT402' })).toBe('somente_leitura')
  })
  it('outros erros seguem o caminho de sempre', () => {
    expect(motivoPremiumDoErro({ code: '42501' })).toBeNull()
    expect(motivoPremiumDoErro(null)).toBeNull()
  })
})

describe('erroDoServidor', () => {
  it('vira exceção sem perder a recusa do plano', () => {
    const erro = erroDoServidor({ message: 'Este pet está só para consulta.', code: 'PT402', hint: 'somente_leitura' })
    expect(erro).toBeInstanceOf(Error)
    expect(erro.message).toBe('Este pet está só para consulta.')
    expect(motivoPremiumDoErro(erro)).toBe('somente_leitura')
  })
  it('erro comum continua comum', () => {
    expect(motivoPremiumDoErro(erroDoServidor({ message: 'falhou', code: '23505' }))).toBeNull()
    expect(motivoPremiumDoErro(new Error('rede'))).toBeNull()
  })
})
