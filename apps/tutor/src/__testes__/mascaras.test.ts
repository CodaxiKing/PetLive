import { describe, expect, it } from 'vitest'
import { mascaraData, mascaraHora, mascaraTelefone, telefoneValido } from '../lib/mascaras'

describe('mascaraData', () => {
  it('põe as barras sozinha enquanto o tutor digita', () => {
    expect(mascaraData('1')).toBe('1')
    expect(mascaraData('12')).toBe('12')
    expect(mascaraData('120')).toBe('12/0')
    expect(mascaraData('1203')).toBe('12/03')
    expect(mascaraData('12032')).toBe('12/03/2')
    expect(mascaraData('12032024')).toBe('12/03/2024')
  })
  it('aceita quem digita a barra e corta o excesso', () => {
    expect(mascaraData('12/03/2024')).toBe('12/03/2024')
    expect(mascaraData('120320241')).toBe('12/03/2024')
  })
  it('apagar continua natural', () => {
    expect(mascaraData('12/0')).toBe('12/0')
    expect(mascaraData('12/')).toBe('12')
  })
})

describe('mascaraTelefone', () => {
  it('formata celular e fixo', () => {
    expect(mascaraTelefone('21998765432')).toBe('(21) 99876-5432')
    expect(mascaraTelefone('2133334444')).toBe('(21) 3333-4444')
  })
  it('vai formatando aos poucos', () => {
    expect(mascaraTelefone('2')).toBe('(2')
    expect(mascaraTelefone('219')).toBe('(21) 9')
    expect(mascaraTelefone('2199876')).toBe('(21) 9987-6')
  })
  it('tira o +55 colado', () => {
    expect(mascaraTelefone('+55 21 99876-5432')).toBe('(21) 99876-5432')
  })
  it('valida celular e fixo completos', () => {
    expect(telefoneValido('(21) 99876-5432')).toBe(true)
    expect(telefoneValido('(21) 3333-4444')).toBe(true)
    expect(telefoneValido('(21) 9987')).toBe(false)
  })
})

describe('mascaraHora', () => {
  it('põe os dois pontos', () => {
    expect(mascaraHora('0930')).toBe('09:30')
    expect(mascaraHora('9')).toBe('9')
  })
})
