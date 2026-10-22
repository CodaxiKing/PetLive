import { useEffect, useSyncExternalStore } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from './supabase'

export type Plano = 'gratis' | 'premium'

// Plano compartilhado por todas as telas: depois da compra confirmada no
// servidor, recarregarPlano libera o Premium em todo o app sem reiniciar.
let atual: Plano = 'gratis'
let carregadoPara: string | null = null
const ouvintes = new Set<() => void>()

function definir(plano: Plano) {
  if (plano === atual) return
  atual = plano
  ouvintes.forEach((o) => o())
}

/** Lê profiles.plano de novo (o servidor é quem muda o plano). */
export async function recarregarPlano(userId: string): Promise<Plano> {
  carregadoPara = userId
  const { data } = await supabase.from('profiles').select('plano').eq('id', userId).maybeSingle()
  definir(data?.plano === 'premium' ? 'premium' : 'gratis')
  return atual
}

/**
 * Plano do tutor (profiles.plano). Enquanto não carrega, considera grátis:
 * os limites do grátis são o comportamento seguro (BUSINESS.md 10).
 */
export function usePlano(): Plano {
  const { user } = useAuth()
  const plano = useSyncExternalStore(
    (ouvir) => {
      ouvintes.add(ouvir)
      return () => ouvintes.delete(ouvir)
    },
    () => atual,
  )

  useEffect(() => {
    if (!user) {
      carregadoPara = null
      definir('gratis')
      return
    }
    if (carregadoPara !== user.id) void recarregarPlano(user.id)
  }, [user])

  return user ? plano : 'gratis'
}
