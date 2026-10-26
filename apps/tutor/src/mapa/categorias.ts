import type { CategoriaLugar } from './lugares'

export const ROTULO_CATEGORIA: Record<CategoriaLugar, string> = {
  clinica: 'Clínica', banho_tosa: 'Banho e tosa', petshop: 'Petshop', creche: 'Creche',
  hotelzinho: 'Hotelzinho', parque: 'Parque', praia: 'Praia', restaurante: 'Restaurante', hotel: 'Hotel',
}
export const PLURAL_CATEGORIA: Record<CategoriaLugar, string> = {
  clinica: 'Clínicas', banho_tosa: 'Banho e tosa', petshop: 'Petshops', creche: 'Creches',
  hotelzinho: 'Hotelzinhos', parque: 'Parques', praia: 'Praias', restaurante: 'Restaurantes', hotel: 'Hotéis',
}
export function ehCategoria(valor: string): valor is CategoriaLugar {
  return Object.hasOwn(ROTULO_CATEGORIA, valor)
}
export function lerCategorias(dados: unknown) {
  const nomes = { ...ROTULO_CATEGORIA }, plurais = { ...PLURAL_CATEGORIA }
  if (Array.isArray(dados)) for (const item of dados) {
    if (!item || typeof item !== 'object') continue
    const c = item as Record<string, unknown>
    if (typeof c.codigo !== 'string' || !ehCategoria(c.codigo) ||
      typeof c.nome !== 'string' || typeof c.plural !== 'string' ||
      c.nome.trim().length < 2 || c.nome.trim().length > 32 || c.plural.trim().length < 2 || c.plural.trim().length > 40) continue
    nomes[c.codigo] = c.nome.trim(); plurais[c.codigo] = c.plural.trim()
  }
  return { nomes, plurais }
}
