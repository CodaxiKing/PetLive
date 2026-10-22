import { router } from 'expo-router'
import { motivoPremiumDoErro, type MotivoPremium } from './limite'

/** Abre o convite Premium (tela premium) explicando o limite de pets. */
export function abrirConvitePremium(motivo: MotivoPremium, petId?: string) {
  router.push({ pathname: '/premium', params: petId ? { motivo, pet: petId } : { motivo } })
}

/**
 * O servidor recusou pelo plano (PT402)? Abre o convite no lugar da mensagem
 * de erro e devolve true; qualquer outro erro devolve false.
 */
export function conviteSeRecusado(erro: unknown, petId?: string | null): boolean {
  const motivo = motivoPremiumDoErro(erro)
  if (!motivo) return false
  abrirConvitePremium(motivo, petId ?? undefined)
  return true
}
