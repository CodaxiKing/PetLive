import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from './supabase'

export type Plano = 'gratis' | 'premium'

/**
 * Plano do tutor (profiles.plano). Enquanto não carrega, considera grátis:
 * os limites do grátis são o comportamento seguro (BUSINESS.md 10).
 */
export function usePlano(): Plano {
  const { user } = useAuth()
  const [plano, setPlano] = useState<Plano>('gratis')

  useEffect(() => {
    if (!user) return
    let vivo = true
    supabase
      .from('profiles')
      .select('plano')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (vivo && data?.plano === 'premium') setPlano('premium')
      })
    return () => {
      vivo = false
    }
  }, [user])

  return plano
}
