import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from './supabase'

import { confirmarConsultaPlano, estadoPlanoDaConta, type ConsultaPlano } from './estadoPlano'
export type { Plano } from './estadoPlano'

/**
 * Plano do tutor (profiles.plano). Enquanto não carrega, considera grátis:
 * os limites do grátis são o comportamento seguro (BUSINESS.md 10).
 */
export function useEstadoPlano() {
  const { user } = useAuth()
  const tutorId = user?.id
  const [consulta, setConsulta] = useState<ConsultaPlano | null>(null)
  const [tentativa, setTentativa] = useState(0)

  useFocusEffect(useCallback(() => {
    if (!tutorId) return
    let vivo = true
    setConsulta({ tutorId, plano: 'gratis', erro: false, carregando: true })
    Promise.resolve(supabase
      .from('profiles')
      .select('plano')
      .eq('id', tutorId)
      .maybeSingle())
      .then(({ data, error }) => {
        if (vivo) setConsulta(confirmarConsultaPlano(tutorId, data?.plano, Boolean(error)))
      })
      .catch(() => { if (vivo) setConsulta({ tutorId, plano: 'gratis', erro: true }) })
    return () => {
      vivo = false
    }
  // A tentativa repete a consulta quando o tutor solicita.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorId, tentativa]))

  return { ...estadoPlanoDaConta(tutorId, consulta), recarregar: () => setTentativa((n) => n + 1) }
}

export function usePlano() { return useEstadoPlano().plano }
