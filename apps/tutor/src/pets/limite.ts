import type { Plano } from '../lib/plano'

/**
 * Vários pets com limite por plano (BUSINESS.md 5.13 e 10). A regra vale no
 * servidor (migração limite_de_pets); aqui o app só decide o que mostrar
 * antes de tentar, e reconhece a recusa do servidor.
 */
export const LIMITE_PETS: Record<Plano, number> = { gratis: 1, premium: 20 }

/** Por que o convite Premium abriu (é também o hint do erro PT402). */
export type MotivoPremium = 'limite_pets' | 'somente_leitura'

/** Pets em memória não entram em `ativos` (não contam no limite). */
export function podeCadastrarPet(plano: Plano, ativos: number): boolean {
  return ativos < LIMITE_PETS[plano]
}

/** Reativar do modo memorial com o limite já cheio: o pet volta só para consulta. */
export function reativaSomenteLeitura(plano: Plano, ativos: number): boolean {
  return !podeCadastrarPet(plano, ativos)
}

/** Recusa do servidor por causa do plano (SQLSTATE PT402, HTTP 402). */
export function motivoPremiumDoErro(erro: unknown): MotivoPremium | null {
  if (!erro || typeof erro !== 'object' || (erro as { code?: unknown }).code !== 'PT402') return null
  return (erro as { hint?: unknown }).hint === 'limite_pets' ? 'limite_pets' : 'somente_leitura'
}

/**
 * Erro do Supabase virando exceção sem perder o código: assim quem chama
 * reconhece a recusa do plano (motivoPremiumDoErro) e abre o convite.
 */
export function erroDoServidor(erro: { message: string; code?: string; hint?: string | null }): Error {
  return Object.assign(new Error(erro.message), { code: erro.code, hint: erro.hint })
}
