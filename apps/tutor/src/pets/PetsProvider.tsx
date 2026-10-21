import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { mensagemDeErro } from '../lib/cacheOffline'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { enviarFotoPet } from './foto'
import type { Pet, PetForm } from './types'
import { FORM_VAZIO, formParaRegistro } from './types'

interface PetsContextValue {
  pets: Pet[]
  petAtivo: Pet | null
  carregando: boolean
  salvando: boolean
  erro: string | null
  definirPetAtivo: (id: string | null) => void
  criarPet: (form: PetForm) => Promise<Pet | null>
  atualizarPet: (id: string, form: PetForm) => Promise<Pet | null>
  /** Envia a foto para o Storage e grava `foto_url` no pet. */
  salvarFoto: (id: string, foto: { uri: string; mimeType?: string }) => Promise<string | null>
  /** Limpa `foto_url` (o arquivo no bucket fica para o próximo upload substituir). */
  removerFoto: (id: string) => Promise<boolean>
  removerPet: (id: string) => Promise<boolean>
  recarregar: () => Promise<void>
  FORM_VAZIO: PetForm
}

const PetsContext = createContext<PetsContextValue | undefined>(undefined)

export function PetsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const tutorId = session?.user.id ?? null

  const [pets, setPets] = useState<Pet[]>([])
  const [petAtivoId, setPetAtivoId] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(() => {
    // Sem tutor não há consulta; resolve vazio para o estado também passar
    // pela fronteira assíncrona (mesmo motivo do .then() no AuthProvider).
    const consulta = tutorId
      ? supabase.from('pets').select('*').order('criado_em', { ascending: false })
      : Promise.resolve({ data: [] as Pet[], error: null })

    return Promise.resolve(consulta).then(({ data, error }) => {
      if (error) {
        setErro(mensagemDeErro(error.message))
      } else {
        setErro(null)
        setPets((data ?? []) as Pet[])
      }
      setCarregando(false)
    })
  }, [tutorId])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  const criarPet = useCallback(
    async (form: PetForm) => {
      if (!tutorId) return null
      setSalvando(true)
      setErro(null)
      const { data, error } = await supabase
        .from('pets')
        .insert(formParaRegistro(form, tutorId))
        .select()
        .single()
      setSalvando(false)
      if (error) {
        setErro(mensagemDeErro(error.message))
        return null
      }
      const pet = data as Pet
      setPets((atual) => [pet, ...atual])
      setPetAtivoId(pet.id)
      return pet
    },
    [tutorId],
  )

  const atualizarPet = useCallback(async (id: string, form: PetForm) => {
    if (!tutorId) return null
    setSalvando(true)
    setErro(null)
    const { data, error } = await supabase
      .from('pets')
      .update(formParaRegistro(form, tutorId))
      .eq('id', id)
      .select()
      .single()
    setSalvando(false)
    if (error) {
      setErro(mensagemDeErro(error.message))
      return null
    }
    const pet = data as Pet
    setPets((atual) => atual.map((p) => (p.id === id ? pet : p)))
    return pet
  }, [tutorId])

  const salvarFoto = useCallback(
    async (id: string, foto: { uri: string; mimeType?: string }) => {
      if (!tutorId) return null
      setSalvando(true)
      setErro(null)
      const resultado = await enviarFotoPet({
        tutorId,
        petId: id,
        uri: foto.uri,
        mimeType: foto.mimeType,
      })
      if (!resultado.url) {
        setErro(resultado.erro)
        setSalvando(false)
        return null
      }
      const { data, error } = await supabase
        .from('pets')
        .update({ foto_url: resultado.url })
        .eq('id', id)
        .select()
        .single()
      setSalvando(false)
      if (error) {
        setErro(mensagemDeErro(error.message))
        return null
      }
      const pet = data as Pet
      setPets((atual) => atual.map((p) => (p.id === id ? pet : p)))
      return resultado.url
    },
    [tutorId],
  )

  const removerFoto = useCallback(
    async (id: string) => {
      setSalvando(true)
      setErro(null)
      const { data, error } = await supabase
        .from('pets')
        .update({ foto_url: null })
        .eq('id', id)
        .select()
        .single()
      setSalvando(false)
      if (error) {
        setErro(mensagemDeErro(error.message))
        return false
      }
      const pet = data as Pet
      setPets((atual) => atual.map((p) => (p.id === id ? pet : p)))
      return true
    },
    [],
  )

  const removerPet = useCallback(
    async (id: string) => {
      setSalvando(true)
      setErro(null)
      const { error } = await supabase.from('pets').delete().eq('id', id)
      setSalvando(false)
      if (error) {
        setErro(mensagemDeErro(error.message))
        return false
      }
      setPets((atual) => atual.filter((p) => p.id !== id))
      if (petAtivoId === id) setPetAtivoId(null)
      return true
    },
    [petAtivoId],
  )

  // Sem escolha do tutor, o primeiro pet é o ativo (título do Início,
  // vacinas e remédios carregados).
  const petAtivo = useMemo(
    () => pets.find((p) => p.id === petAtivoId) ?? pets[0] ?? null,
    [pets, petAtivoId],
  )

  const value = useMemo<PetsContextValue>(
    () => ({
      pets,
      petAtivo,
      carregando,
      salvando,
      erro,
      definirPetAtivo: setPetAtivoId,
      criarPet,
      atualizarPet,
      salvarFoto,
      removerFoto,
      removerPet,
      recarregar,
      FORM_VAZIO,
    }),
    [pets, petAtivo, carregando, salvando, erro, criarPet, atualizarPet, salvarFoto, removerFoto, removerPet, recarregar],
  )

  return <PetsContext.Provider value={value}>{children}</PetsContext.Provider>
}

export function usePets(): PetsContextValue {
  const ctx = useContext(PetsContext)
  if (!ctx) throw new Error('usePets precisa estar dentro de <PetsProvider>')
  return ctx
}
