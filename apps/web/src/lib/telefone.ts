/**
 * Utilitários para validação e formatação de telefones brasileiros.
 * Regras:
 * - Celular: 11 dígitos (DDD + 9xxxxxxxx) ou 13 dígitos com +55 (+55 + DDD + 9xxxxxxxx)
 * - Fixo: 10 dígitos (DDD + xxxxxxxx)
 */

const digitos = (texto: string): string => texto.replace(/\D/g, "")

/**
 * Verifica se o telefone é um número de celular brasileiro válido.
 * Considera celular: 11 dígitos (DDD + 9xxxxxxxx) ou 13 dígitos com +55 (+55 + DDD + 9xxxxxxxx)
 */
export function ehCelular(telefone: string): boolean {
  const d = digitos(telefone)
  // 11 dígitos: DDD + 9xxxxxxxx
  if (d.length === 11 && d[2] === "9") return true
  // 13 dígitos com +55: 55 + DDD + 9xxxxxxxx
  if (d.length === 13 && d.startsWith("55") && d[4] === "9") return true
  return false
}

/**
 * Verifica se o telefone é um número válido (celular ou fixo).
 * Considera válido: 10 dígitos (fixo) ou 11 dígitos (celular) ou 12/13 dígitos com +55
 */
export function telefoneValido(telefone: string): boolean {
  const d = digitos(telefone)
  // 10 dígitos: DDD + xxxxxxxx (fixo)
  if (d.length === 10) return true
  // 11 dígitos: DDD + 9xxxxxxxx (celular)
  if (d.length === 11 && d[2] === "9") return true
  // 12 dígitos com +55: 55 + DDD + xxxxxxxx (fixo)
  if (d.length === 12 && d.startsWith("55")) return true
  // 13 dígitos com +55: 55 + DDD + 9xxxxxxxx (celular)
  if (d.length === 13 && d.startsWith("55") && d[4] === "9") return true
  return false
}

/**
 * Limpa o telefone para uso em links (tel: e wa.me:).
 * Retorna apenas dígitos, mantendo o +55 se presente no original.
 * Para wa.me, sempre inclui o 55 (código do país Brasil).
 */
export function limparTelefoneParaLink(telefone: string, paraWhatsApp = false): string {
  const d = digitos(telefone)

  // Se já tem 55 no início (formato +55...), mantém
  if (d.startsWith("55")) {
    return paraWhatsApp ? d : `+${d}`
  }

  // Se tem 10 ou 11 dígitos (formato nacional), adiciona 55
  if (d.length === 10 || d.length === 11) {
    const comPais = `55${d}`
    return paraWhatsApp ? comPais : `+${comPais}`
  }

  // Fallback: retorna como está (com + se não for WhatsApp)
  return paraWhatsApp ? d : `+${d}`
}

/**
 * Formata telefone para exibição: (DD) 9xxxx-xxxx ou (DD) xxxx-xxxx
 */
export function formatarTelefone(telefone: string): string {
  const d = digitos(telefone)
  // Remove +55 se presente
  const nacional = d.startsWith("55") ? d.slice(2) : d
  if (nacional.length === 0) return ""
  if (nacional.length <= 2) return `(${nacional}`
  const ddd = nacional.slice(0, 2)
  const resto = nacional.slice(2)
  if (resto.length <= 4) return `(${ddd}) ${resto}`
  const meio = resto.length === 9 ? 5 : 4
  return `(${ddd}) ${resto.slice(0, meio)}-${resto.slice(meio)}`
}