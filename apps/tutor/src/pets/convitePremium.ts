import { router } from 'expo-router'
import type { MotivoConvite } from '../premium/planos'
import { motivoPremiumDoErro } from './limite'

/**
 * Abre a Tela Premium explicando o recurso bloqueado: limite de pets, pet só
 * para consulta, leitura do cartão de vacina por foto ou PDF da linha do tempo.
 */
export function abrirConvitePremium(motivo?: MotivoConvite, petId?: string) {
  if (!motivo) {
    router.push('/premium')
    return
  }
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
