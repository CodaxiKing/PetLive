import { router } from 'expo-router'
import type { MotivoPremium } from './limite'

/** Abre o convite Premium (tela premium) explicando o limite de pets. */
export function abrirConvitePremium(motivo: MotivoPremium, petId?: string) {
  router.push({ pathname: '/premium', params: petId ? { motivo, pet: petId } : { motivo } })
}
