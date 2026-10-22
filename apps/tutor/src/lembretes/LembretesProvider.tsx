import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { mensagemDeErro } from '../lib/cacheOffline'
import { registrarEvento } from '../lib/eventos'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { agendarUmLembrete, cancelarLembrete } from '../notificacoes/sincronizarLembretes'
import { conviteSeRecusado } from '../pets/convitePremium'
import type { Lembrete, LembreteForm } from './types'
import { LEMBRETE_FORM_VAZIO, formParaRegistro, proximaOcorrencia } from './types'

interface LembretesContextValue {
  lembretes: Lembrete[]
  carregando: boolean
  salvando: boolean
  erro: string | null
  criarLembrete: (form: LembreteForm) => Promise<Lembrete | null>
  /**
   * false: não deu para salvar. null: o pet está só para consulta, o
   * servidor recusou (PT402) e o convite Premium já abriu.
   */
  concluirLembrete: (lembrete: Lembrete) => Promise<boolean | null>
  removerLembrete: (lembrete: Lembrete) => Promise<boolean | null>
  recarregar: () => Promise<void>
  FORM_VAZIO: LembreteForm
}

const LembretesContext = createContext<LembretesContextValue | undefined>(undefined)

export function LembretesProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const tutorId = session?.user.id ?? null

  const [lembretes, setLembretes] = useState<Lembrete[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(() => {
    // Sem tutor não há consulta; resolve vazio para o estado passar pela
    // fronteira assíncrona (mesmo motivo do .then() no AuthProvider).
    const consulta = tutorId
      ? supabase
          .from('reminders')
          .select('*')
          .eq('ativo', true)
          .order('proxima_em', { ascending: true })
      : Promise.resolve({ data: [] as Lembrete[], error: null })

    return Promise.resolve(consulta).then(({ data, error }) => {
      if (error) {
        setErro(mensagemDeErro(error.message))
      } else {
        setErro(null)
        setLembretes((data ?? []) as Lembrete[])
      }
      setCarregando(false)
    })
  }, [tutorId])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  const criarLembrete = useCallback(
    (form: LembreteForm) => {
      if (!tutorId) return Promise.resolve(null)
      setSalvando(true)
      setErro(null)

      return Promise.resolve(
        supabase
          .from('reminders')
          .insert(formParaRegistro(form, tutorId))
          .select()
          .single(),
      ).then(({ data, error }) => {
        setSalvando(false)
        if (error) {
          // Pet só para consulta: o convite Premium no lugar do erro genérico.
          if (!conviteSeRecusado(error, form.pet_id)) setErro(mensagemDeErro(error.message))
          return null
        }
        const lembrete = data as Lembrete
        setLembretes((atual) =>
          [...atual, lembrete].sort((a, b) => a.proxima_em.localeCompare(b.proxima_em)),
        )
        // Notificação local é efeito colateral: não pode falhar o cadastro.
        agendarUmLembrete(lembrete).catch(() => {})
        return lembrete
      })
    },
    [tutorId],
  )

  /**
   * Marca como visto: se repete, agenda a próxima ocorrência; senão, inativa.
   * É o botão "feito" da tela de lembretes.
   */
  const concluirLembrete = useCallback((lembrete: Lembrete) => {
    setSalvando(true)

    const repete = lembrete.repetir && lembrete.repetir !== 'nao'
    const proxima = repete
      ? proximaOcorrencia(lembrete.proxima_em, lembrete.repetir!, lembrete.intervalo_dias ?? 0)
      : null

    const atualizacao = repete
      ? supabase
          .from('reminders')
          .update({ proxima_em: proxima, ultimo_aviso_em: new Date().toISOString() })
          .eq('id', lembrete.id)
      : supabase
          .from('reminders')
          .update({ ativo: false, ultimo_aviso_em: new Date().toISOString() })
          .eq('id', lembrete.id)

    return Promise.resolve(atualizacao).then(({ error }) => {
      setSalvando(false)
      if (error) {
        if (conviteSeRecusado(error, lembrete.pet_id)) return null
        setErro(mensagemDeErro(error.message))
        return false
      }
      registrarEvento('lembrete_concluido', { tipo: lembrete.tipo })
      setLembretes((atual) => {
        const restantes = atual.filter((l) => l.id !== lembrete.id)
        if (repete) {
          const agendado = { ...lembrete, proxima_em: proxima! }
          return [...restantes, agendado].sort((a, b) =>
            a.proxima_em.localeCompare(b.proxima_em),
          )
        }
        return restantes
      })
      // Reagenda a próxima ocorrência (ou cancela, se não repete).
      agendarUmLembrete({
        ...lembrete,
        proxima_em: proxima ?? lembrete.proxima_em,
        ativo: Boolean(repete),
      }).catch(() => {})
      return true
    })
  }, [])

  const removerLembrete = useCallback((lembrete: Lembrete) => {
    setSalvando(true)
    setErro(null)

    return Promise.resolve(supabase.from('reminders').delete().eq('id', lembrete.id)).then(({ error }) => {
      setSalvando(false)
      if (error) {
        if (conviteSeRecusado(error, lembrete.pet_id)) return null
        setErro(mensagemDeErro(error.message))
        return false
      }
      setLembretes((atual) => atual.filter((l) => l.id !== lembrete.id))
      cancelarLembrete(lembrete.id).catch(() => {})
      return true
    })
  }, [])

  const value = useMemo<LembretesContextValue>(
    () => ({
      lembretes,
      carregando,
      salvando,
      erro,
      criarLembrete,
      concluirLembrete,
      removerLembrete,
      recarregar,
      FORM_VAZIO: LEMBRETE_FORM_VAZIO,
    }),
    [
      lembretes,
      carregando,
      salvando,
      erro,
      criarLembrete,
      concluirLembrete,
      removerLembrete,
      recarregar,
    ],
  )

  return <LembretesContext.Provider value={value}>{children}</LembretesContext.Provider>
}

export function useLembretes(): LembretesContextValue {
  const ctx = useContext(LembretesContext)
  if (!ctx) throw new Error('useLembretes precisa estar dentro de <LembretesProvider>')
  return ctx
}
