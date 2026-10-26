import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ehErroDeRede, mensagemDeErro } from '../lib/cacheOffline'
import { useAuth } from '../auth/AuthProvider'
import { enviarFotoPet } from './foto'
import { cadastrarPet } from './cadastrarPet'
import { carregarPetsConta, criarCargaPets } from './carregarPetsConta'
import { escreverPet, excluirPet } from './escreverPet'
import type { Pet, PetForm } from './types'
import { FORM_VAZIO, formParaRegistro } from './types'

interface PetsContextValue {
  /** Pets ativos (sem os que estão em memória). */
  pets: Pet[]
  /** Pets com a partida registrada (modo memorial). */
  petsMemoria: Pet[]
  /** Ids dos pets sênior (faixa na tela do pet e etiqueta Sênior). */
  seniores: Set<string>
  /** O pet acabou de virar sênior (checado ao abrir a tela dele). */
  marcarSenior: (id: string) => void
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

  const [todos, setPets] = useState<Pet[]>([])
  const pets = useMemo(() => todos.filter((p) => !p.em_memoria), [todos])
  const petsMemoria = useMemo(() => todos.filter((p) => p.em_memoria), [todos])
  const [seniores, setSeniores] = useState<Set<string>>(new Set())
  const marcarSenior = useCallback((id: string) => setSeniores((atual) => (atual.has(id) ? atual : new Set(atual).add(id))), [])
  const [petAtivoId, setPetAtivoId] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carga = useMemo(() => criarCargaPets(
    () => tutorId ? carregarPetsConta(tutorId) : Promise.resolve({ pets: [], seniores: new Set<string>() }),
    ({ pets, seniores }) => {
      setErro(null)
      setPets(pets)
      if (seniores) setSeniores(seniores)
      setCarregando(false)
    },
    (erro) => {
      const mensagem = erro instanceof Error ? erro.message : 'Não foi possível carregar seus pets. Tente novamente.'
      setErro(ehErroDeRede(mensagem) ? 'Sem internet: não foi possível atualizar seus pets. Tente novamente quando a conexão voltar.' : mensagem)
      setCarregando(false)
    },
  ), [tutorId])
  const recarregar = carga.recarregar

  useEffect(() => {
    recarregar()
    return carga.invalidar
  }, [carga, recarregar])

  const criarPet = useCallback(
    async (form: PetForm) => {
      if (!tutorId) {
        setErro('Sua sessão expirou. Entre novamente para salvar o pet.')
        return null
      }
      setSalvando(true)
      setErro(null)
      try {
        const pet = await cadastrarPet(form, tutorId)
        carga.invalidar()
        setCarregando(false)
        setPets((atual) => [pet, ...atual])
        setPetAtivoId(pet.id)
        return pet
      } catch (e) {
        setErro(mensagemDeErro(e instanceof Error ? e.message : 'Não foi possível salvar o pet. Tente novamente.'))
        return null
      } finally {
        setSalvando(false)
      }
    },
    [tutorId, carga],
  )

  const atualizarPet = useCallback(async (id: string, form: PetForm) => {
    if (!tutorId) return null
    setSalvando(true)
    setErro(null)
    try {
      const { tutor_id: _tutorIdNaoAlterado, ...dadosPet } = formParaRegistro(form, tutorId)
      const pet = await escreverPet(tutorId, id, dadosPet)
      carga.invalidar()
      setCarregando(false)
      setPets((atual) => atual.map((p) => (p.id === id ? pet : p)))
      return pet
    } catch (e) {
      setErro(mensagemDeErro(e instanceof Error ? e.message : 'Não foi possível salvar o pet. Tente novamente.'))
      return null
    } finally { setSalvando(false) }
  }, [tutorId, carga])

  const salvarFoto = useCallback(
    async (id: string, foto: { uri: string; mimeType?: string }) => {
      if (!tutorId) return null
      setSalvando(true)
      setErro(null)
      try {
        const resultado = await enviarFotoPet({
          tutorId,
          petId: id,
          uri: foto.uri,
          mimeType: foto.mimeType,
        })
        if (!resultado.url) {
          setErro(resultado.erro)
          return null
        }
        const pet = await escreverPet(tutorId, id, { foto_url: resultado.url })
        carga.invalidar()
        setCarregando(false)
        setPets((atual) => atual.map((p) => (p.id === id ? pet : p)))
        return resultado.url
      } catch (e) {
        setErro(mensagemDeErro(e instanceof Error ? e.message : 'Não foi possível enviar a foto. Tente novamente.'))
        return null
      } finally { setSalvando(false) }
    },
    [tutorId, carga],
  )

  const removerFoto = useCallback(
    async (id: string) => {
      if (!tutorId) return false
      setSalvando(true)
      setErro(null)
      try {
        const pet = await escreverPet(tutorId, id, { foto_url: null })
        carga.invalidar()
        setCarregando(false)
        setPets((atual) => atual.map((p) => (p.id === id ? pet : p)))
        return true
      } catch (e) {
        setErro(mensagemDeErro(e instanceof Error ? e.message : 'Não foi possível remover a foto. Tente novamente.'))
        return false
      } finally { setSalvando(false) }
    },
    [tutorId, carga],
  )

  const removerPet = useCallback(
    async (id: string) => {
      if (!tutorId) return false
      setSalvando(true)
      setErro(null)
      try {
        await excluirPet(tutorId, id)
        carga.invalidar()
        setCarregando(false)
        setPets((atual) => atual.filter((p) => p.id !== id))
        if (petAtivoId === id) setPetAtivoId(null)
        return true
      } catch (e) {
        setErro(mensagemDeErro(e instanceof Error ? e.message : 'Não foi possível excluir o pet. Tente novamente.'))
        return false
      } finally { setSalvando(false) }
    },
    [petAtivoId, tutorId, carga],
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
      petsMemoria,
      seniores,
      marcarSenior,
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
    [pets, petsMemoria, seniores, marcarSenior, petAtivo, carregando, salvando, erro, criarPet, atualizarPet, salvarFoto, removerFoto, removerPet, recarregar],
  )

  return <PetsContext.Provider value={value}>{children}</PetsContext.Provider>
}

export function usePets(): PetsContextValue {
  const ctx = useContext(PetsContext)
  if (!ctx) throw new Error('usePets precisa estar dentro de <PetsProvider>')
  return ctx
}
