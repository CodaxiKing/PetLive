import { atualizarWidget } from '../widget/tarefaWidget'
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
import { supabase } from '../lib/supabase'
import { usePets } from '../pets/PetsProvider'
import type { Pet } from '../pets/types'
import type { SugestaoVacina, Vacina, VacinaForm } from './types'
import { VACINA_FORM_VAZIO, formParaRegistro, somarDias } from './types'

interface VacinasContextValue {
  /** Vacinas já aplicadas do pet ativo, da mais recente para a mais antiga. */
  vacinas: Vacina[]
  /** Calendário sugerido da espécie do pet ativo. */
  sugeridas: SugestaoVacina[]
  carregando: boolean
  salvando: boolean
  erro: string | null
  registrarVacina: (form: VacinaForm) => Promise<Vacina | null>
  removerVacina: (id: string) => Promise<boolean>
  recarregar: () => Promise<void>
  /** Sugestão de próxima dose a partir do calendário, em 'YYYY-MM-DD'. */
  sugerirProximaDose: (nome: string, aplicadaEmIso: string) => string | null
  FORM_VAZIO: VacinaForm
}

const VacinasContext = createContext<VacinasContextValue | undefined>(undefined)

export function VacinasProvider({ children }: { children: ReactNode }) {
  const { petAtivo } = usePets()
  const pet: Pet | null = petAtivo

  const [vacinas, setVacinas] = useState<Vacina[]>([])
  const [sugeridas, setSugeridas] = useState<SugestaoVacina[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Widget da tela inicial: a próxima vacina muda quando as vacinas mudam.
  useEffect(() => {
    atualizarWidget()
  }, [vacinas])

  const petId = pet?.id ?? null
  const especie = pet?.especie ?? null

  const recarregar = useCallback(() => {
    // Sem pet não há consulta; resolve vazio para o estado passar pela
    // fronteira assíncrona (mesmo motivo do .then() no AuthProvider).
    const doPet = petId
      ? supabase
          .from('vaccinations')
          .select('*')
          .eq('pet_id', petId)
          .order('aplicada_em', { ascending: false })
      : Promise.resolve({ data: [] as Vacina[], error: null })

    const calendario = especie
      ? supabase
          .from('vaccine_schedule')
          .select('*')
          .eq('especie', especie)
          .order('ordem', { ascending: true })
      : Promise.resolve({ data: [] as SugestaoVacina[], error: null })

    return Promise.all([Promise.resolve(doPet), Promise.resolve(calendario)]).then(
      ([resVacinas, resCalendario]) => {
        const falha = resVacinas.error ?? resCalendario.error
        setErro(falha ? falha.message : null)
        setVacinas((resVacinas.data ?? []) as Vacina[])
        setSugeridas(
          ((resCalendario.data ?? []) as Record<string, unknown>[]).map((linha) => ({
            id: String(linha.id),
            especie: linha.especie as 'cao' | 'gato',
            nome: String(linha.nome),
            primeira_dose_dias: Number(linha.primeira_dose_meses),
            reforco_dias: linha.reforco_meses == null ? null : Number(linha.reforco_meses),
            descricao: (linha.descricao as string | null) ?? null,
            ordem: Number(linha.ordem ?? 0),
          })),
        )
        setCarregando(false)
      },
    )
  }, [petId, especie])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  const registrarVacina = useCallback(
    (form: VacinaForm) => {
      if (!petId) return Promise.resolve(null)
      setSalvando(true)
      setErro(null)

      return Promise.resolve(
        supabase
          .from('vaccinations')
          .insert(formParaRegistro(form, petId))
          .select()
          .single(),
      ).then(({ data, error }) => {
        setSalvando(false)
        if (error) {
          setErro(mensagemDeErro(error.message))
          return null
        }
        const vacina = data as Vacina
        setVacinas((atual) => [vacina, ...atual])
        return vacina
      })
    },
    [petId],
  )

  const removerVacina = useCallback((id: string) => {
    setSalvando(true)
    setErro(null)

    return Promise.resolve(supabase.from('vaccinations').delete().eq('id', id)).then(
      ({ error }) => {
        setSalvando(false)
        if (error) {
          setErro(mensagemDeErro(error.message))
          return false
        }
        setVacinas((atual) => atual.filter((v) => v.id !== id))
        return true
      },
    )
  }, [])

  const sugerirProximaDose = useCallback(
    (nome: string, aplicadaEmIso: string) => {
      const chave = nome.trim().toLowerCase()
      const sugestao = sugeridas.find((s) => s.nome.trim().toLowerCase() === chave)
      if (!sugestao || !sugestao.reforco_dias) return null
      return somarDias(aplicadaEmIso, sugestao.reforco_dias)
    },
    [sugeridas],
  )

  const value = useMemo<VacinasContextValue>(
    () => ({
      vacinas,
      sugeridas,
      carregando,
      salvando,
      erro,
      registrarVacina,
      removerVacina,
      recarregar,
      sugerirProximaDose,
      FORM_VAZIO: VACINA_FORM_VAZIO,
    }),
    [
      vacinas,
      sugeridas,
      carregando,
      salvando,
      erro,
      registrarVacina,
      removerVacina,
      recarregar,
      sugerirProximaDose,
    ],
  )

  return <VacinasContext.Provider value={value}>{children}</VacinasContext.Provider>
}

export function useVacinas(): VacinasContextValue {
  const ctx = useContext(VacinasContext)
  if (!ctx) throw new Error('useVacinas precisa estar dentro de <VacinasProvider>')
  return ctx
}
