import { describe, expect, it } from 'vitest'
import { ERRO_GENERICO, ERRO_SEM_INTERNET, textoDeErro } from '../lib/erros'

describe('textoDeErro', () => {
  it('mantém as mensagens escritas para o tutor', () => {
    expect(textoDeErro(new Error('Este horário acabou de ser ocupado. Escolha outro.'))).toBe('Este horário acabou de ser ocupado. Escolha outro.')
    expect(textoDeErro('Você já usou este cupom.')).toBe('Você já usou este cupom.')
  })

  it('troca erros técnicos e em inglês por uma frase clara', () => {
    expect(textoDeErro(new Error('Could not find the function public.selos_do_pet(p_pet) in the schema cache'))).toBe(ERRO_GENERICO)
    expect(textoDeErro(new Error('permission denied for table pets'))).toBe(ERRO_GENERICO)
    expect(textoDeErro(new Error('Edge Function returned a non-2xx status code'))).toBe(ERRO_GENERICO)
    expect(textoDeErro(new Error('Something went wrong'))).toBe(ERRO_GENERICO)
    expect(textoDeErro({ message: 'duplicate key value violates unique constraint' })).toBe(ERRO_GENERICO)
  })

  it('rede, sessão e erro vazio', () => {
    expect(textoDeErro(new TypeError('Network request failed'))).toBe(ERRO_SEM_INTERNET)
    expect(textoDeErro(new Error('JWT expired'))).toBe('Sua sessão expirou. Entre de novo na conta.')
    expect(textoDeErro(undefined, 'Tente novamente.')).toBe('Tente novamente.')
    expect(textoDeErro(new Error('boom'), 'Não foi possível salvar.')).toBe('Não foi possível salvar.')
  })
})
