import { describe, expect, it } from 'vitest'
import { ehCategoria, lerCategorias, ROTULO_CATEGORIA } from '../mapa/categorias'

describe('catálogo de categorias do mapa', () => {
  it('mantém todos os filtros sem catálogo, inclusive respostas inválidas', () => {
    for (const dados of [null, undefined, {}, 'erro', [null, { codigo: 'nova', nome: 'Nova', plural: 'Novas' }]]) {
      expect(lerCategorias(dados).nomes).toEqual(ROTULO_CATEGORIA)
    }
    expect(ehCategoria('__proto__')).toBe(false)
    expect(ehCategoria('toString')).toBe(false)
    expect(ehCategoria('clinica')).toBe(true)
  })
  it('atualiza nomes sem perder categorias omitidas ou mudar o padrão', () => {
    const r = lerCategorias([{ codigo: 'clinica', nome: ' Veterinário ', plural: ' Veterinários ' }])
    expect(r.nomes.clinica).toBe('Veterinário')
    expect(r.plurais.clinica).toBe('Veterinários')
    expect(r.nomes.petshop).toBe('Petshop')
    expect(ROTULO_CATEGORIA.clinica).toBe('Clínica')
    expect(Object.keys(r.nomes)).toHaveLength(9)
  })
  it('ignora nomes vazios, tipos errados, códigos desconhecidos e textos excessivos', () => {
    for (const c of [
      { codigo: 'clinica', nome: '', plural: 'Clínicas' },
      { codigo: 'clinica', nome: 'a'.repeat(33), plural: 'Clínicas' },
      { codigo: 'clinica', nome: 'Clínica', plural: 'a'.repeat(41) },
      { codigo: 'clinica', nome: 123, plural: 'Clínicas' },
      { codigo: '__proto__', nome: 'Protótipo', plural: 'Protótipos' },
    ]) expect(lerCategorias([c]).nomes).toEqual(ROTULO_CATEGORIA)
  })
})
