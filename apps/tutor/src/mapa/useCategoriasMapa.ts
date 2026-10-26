import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { supabase } from '../lib/supabase'
import { lerCategorias } from './categorias'

/** Catálogo opcional: falhas nunca bloqueiam mapa, favoritos ou detalhes. */
export function useCategoriasMapa() {
  const [catalogo, setCatalogo] = useState(() => lerCategorias(null))
  useFocusEffect(useCallback(() => {
    let atual = true
    void supabase.rpc('categorias_mapa').then(({ data, error }) => {
      if (atual) setCatalogo(lerCategorias(error ? null : data))
    }, () => { if (atual) setCatalogo(lerCategorias(null)) })
    return () => { atual = false }
  }, []))
  return catalogo
}
