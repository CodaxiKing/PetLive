import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { sincronizarDoses } from '../notificacoes/doses'
import { usePets } from '../pets/PetsProvider'
import type { Remedio, RemedioForm } from './types'
import { REMEDIO_FORM_VAZIO, formParaRegistro, normalizarHorarios } from './types'

interface RemediosContextValue {
  /** Remédios ativos do pet selecionado. */
  remedios: Remedio[]
  carregando: boolean
  salvando: boolean
  erro: string | null
  criarRemedio: (form: RemedioForm) => Promise<Remedio | null>
  encerrarRemedio: (id: string) => Promise<boolean>
  removerRemedio: (id: string) => Promise<boolean>
  recarregar: () => Promise<void>
  FORM_VAZIO: RemedioForm
}

const RemediosContext = createContext<RemediosContextValue | undefined>(undefined)

export function RemediosProvider({ children }: { children: ReactNode }) {
  const { petAtivo } = usePets()
  const petId = petAtivo?.id ?? null

  const [remedios, setRemedios] = useState<Remedio[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(() => {
    // Sem pet não há consulta; resolve vazio para o estado passar pela
    // fronteira assíncrona (mesmo motivo do .then() no AuthProvider).
    const consulta = petId
      ? supabase
          .from('medications')
          .select('*')
          .eq('pet_id', petId)
          .eq('ativo', true)
          .order('inicio', { ascending: false })
      : Promise.resolve({ data: [] as Remedio[], error: null })

    return Promise.resolve(consulta).then(({ data, error }) => {
      if (error) {
        setErro(error.message)
      } else {
        setErro(null)
        // O PostgREST devolve time[] como '08:00:00'; normaliza para 'HH:MM'.
        setRemedios(
          ((data ?? []) as (Omit<Remedio, 'horarios'> & { horarios: (string | number)[] | null })[]).map(
            (linha) => ({
              ...linha,
              horarios: normalizarHorarios(linha.horarios),
            }),
          ),
        )
      }
      setCarregando(false)
    })
  }, [petId])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  // Notificações das doses (com Dei e Adiar) acompanham os remédios.
  useEffect(() => {
    if (carregando) return
    sincronizarDoses().catch(() => undefined)
  }, [remedios, carregando])

  const criarRemedio = useCallback(
    (form: RemedioForm) => {
      if (!petId) return Promise.resolve(null)
      setSalvando(true)
      setErro(null)

      return Promise.resolve(
        supabase
          .from('medications')
          .insert(formParaRegistro(form, petId))
          .select()
          .single(),
      ).then(({ data, error }) => {
        setSalvando(false)
        if (error) {
          setErro(error.message)
          return null
        }
        // O PostgREST devolve time[] como '08:00:00'; normaliza para 'HH:MM'.
        const registro = data as unknown as Omit<Remedio, 'horarios'> & {
          horarios: (string | number)[] | null
        }
        const normalizado: Remedio = {
          ...registro,
          horarios: normalizarHorarios(registro.horarios),
        }
        setRemedios((atual) => [normalizado, ...atual])
        return normalizado
      })
    },
    [petId],
  )

  /** Só marca como inativo, mantendo o histórico. */
  const encerrarRemedio = useCallback((id: string) => {
    setSalvando(true)

    return Promise.resolve(
      supabase.from('medications').update({ ativo: false }).eq('id', id),
    ).then(({ error }) => {
      setSalvando(false)
      if (error) {
        setErro(error.message)
        return false
      }
      setRemedios((atual) => atual.filter((r) => r.id !== id))
      return true
    })
  }, [])

  const removerRemedio = useCallback((id: string) => {
    setSalvando(true)
    setErro(null)

    return Promise.resolve(supabase.from('medications').delete().eq('id', id)).then(({ error }) => {
      setSalvando(false)
      if (error) {
        setErro(error.message)
        return false
      }
      setRemedios((atual) => atual.filter((r) => r.id !== id))
      return true
    })
  }, [])

  const value = useMemo<RemediosContextValue>(
    () => ({
      remedios,
      carregando,
      salvando,
      erro,
      criarRemedio,
      encerrarRemedio,
      removerRemedio,
      recarregar,
      FORM_VAZIO: REMEDIO_FORM_VAZIO,
    }),
    [
      remedios,
      carregando,
      salvando,
      erro,
      criarRemedio,
      encerrarRemedio,
      removerRemedio,
      recarregar,
    ],
  )

  return <RemediosContext.Provider value={value}>{children}</RemediosContext.Provider>
}

export function useRemedios(): RemediosContextValue {
  const ctx = useContext(RemediosContext)
  if (!ctx) throw new Error('useRemedios precisa estar dentro de <RemediosProvider>')
  return ctx
}
