import { describe, expect, it, vi } from 'vitest'
import { camposPdfIniciais, htmlCarteirinha } from '../pets/carteirinhaPdf'
import type { Pet } from '../pets/types'
import type { Vacina } from '../saude/types'
import type { Remedio } from '../remedios/types'

vi.mock('../lib/pdf', () => ({ escaparHtml: (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }))

const pet = { nome: '<Mia>', especie: 'gato', nascimento: null, alergias: 'ALERGIA_PRIVADA', veterinario: 'VET_PRIVADO', observacoes: 'NOTA_PRIVADA' } as Pet
const vacinas = [{ nome: 'VACINA_PRIVADA', aplicada_em: '2026-01-01', proxima_dose: null }] as Vacina[]
const remedios = [{ nome: 'REMEDIO_PRIVADO', dose: '1 ml', frequencia: 'diária' }] as Remedio[]

describe('seleção de dados do PDF', () => {
  it('omite os campos desmarcados do arquivo, não apenas da interface', () => {
    const nenhum = Object.fromEntries(Object.keys(camposPdfIniciais).map((k) => [k, false])) as typeof camposPdfIniciais
    const html = htmlCarteirinha(pet, 'TUTOR_PRIVADO', vacinas, remedios, nenhum)
    for (const texto of ['ALERGIA_PRIVADA', 'VET_PRIVADO', 'NOTA_PRIVADA', 'TUTOR_PRIVADO', 'VACINA_PRIVADA', 'REMEDIO_PRIVADO']) expect(html).not.toContain(texto)
    expect(html).toContain('&lt;Mia&gt;')
  })
  it('inclui os campos escolhidos e mantém contatos e notas fora por padrão', () => {
    const html = htmlCarteirinha(pet, 'TUTOR_PRIVADO', vacinas, remedios)
    for (const texto of ['ALERGIA_PRIVADA', 'VACINA_PRIVADA', 'REMEDIO_PRIVADO']) expect(html).toContain(texto)
    for (const texto of ['VET_PRIVADO', 'NOTA_PRIVADA', 'TUTOR_PRIVADO']) expect(html).not.toContain(texto)
    expect(htmlCarteirinha(pet, 'TUTOR_PRIVADO', [], [], { ...camposPdfIniciais, tutor: true, veterinario: true, observacoes: true })).toContain('TUTOR_PRIVADO')
  })
})
