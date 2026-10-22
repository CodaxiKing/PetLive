import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import { router } from 'expo-router'
import { mensagemDeErro } from '../lib/cacheOffline'
import type { Plano } from '../lib/plano'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { caminhosAnexosDoPet, removerArquivosAnexos } from '../saude/anexos'
import { abrirConvitePremium } from './convitePremium'
import { enviarFotoPet } from './foto'
import { motivoPremiumDoErro, podeCadastrarPet } from './limite'
import { petsSenior } from './senior'
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
  /** Plano do tutor (profiles.plano), relido junto com os pets. */
  plano: Plano
  /** Cabe mais um pet ativo no plano (BUSINESS.md 10). */
  podeCadastrar: boolean
  /** Todo botão de novo pet passa aqui: cadastro ou convite Premium. */
  adicionarPet: () => void
  /**
   * Toda tentativa de edição de um pet passa aqui: se ele está só para
   * consulta, abre o convite Premium em vez de seguir.
   */
  editarPet: (id: string, acao: () => void) => void
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
  const [plano, setPlano] = useState<Plano>('gratis')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(() => {
    // Sem tutor não há consulta; resolve vazio para o estado também passar
    // pela fronteira assíncrona (mesmo motivo do .then() no AuthProvider).
    // somente_leitura é calculado no servidor a cada leitura (limite do plano).
    const consulta = tutorId
      ? supabase.from('pets').select('*, somente_leitura').order('criado_em', { ascending: false })
      : Promise.resolve({ data: [] as Pet[], error: null })

    if (tutorId) {
      petsSenior().then(setSeniores, () => undefined)
      supabase
        .from('profiles')
        .select('plano')
        .eq('id', tutorId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setPlano(data.plano === 'premium' ? 'premium' : 'gratis')
        })
    }

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

  // O plano pode ter mudado fora do app (assinatura, cobrança): ao voltar
  // para o app, relê e os pets voltam a ser editáveis na hora.
  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') recarregar()
    })
    return () => assinatura.remove()
  }, [recarregar])

  /** Recusa do servidor pelo plano: relê os pets e abre o convite. */
  const recusaDoPlano = useCallback(
    (error: { code?: string; hint?: string | null }, petId?: string) => {
      const motivo = motivoPremiumDoErro(error)
      if (!motivo) return false
      recarregar()
      abrirConvitePremium(motivo, petId)
      return true
    },
    [recarregar],
  )

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
        if (!recusaDoPlano(error)) setErro(mensagemDeErro(error.message))
        return null
      }
      const pet = data as Pet
      setPets((atual) => [pet, ...atual])
      setPetAtivoId(pet.id)
      return pet
    },
    [tutorId, recusaDoPlano],
  )

  const atualizarPet = useCallback(async (id: string, form: PetForm) => {
    if (!tutorId) return null
    setSalvando(true)
    setErro(null)
    const { data, error } = await supabase
      .from('pets')
      .update(formParaRegistro(form, tutorId))
      .eq('id', id)
      .select('*, somente_leitura')
      .single()
    setSalvando(false)
    if (error) {
      if (!recusaDoPlano(error, id)) setErro(mensagemDeErro(error.message))
      return null
    }
    const pet = data as Pet
    setPets((atual) => atual.map((p) => (p.id === id ? pet : p)))
    return pet
  }, [tutorId, recusaDoPlano])

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
        .select('*, somente_leitura')
        .single()
      setSalvando(false)
      if (error) {
        if (!recusaDoPlano(error, id)) setErro(mensagemDeErro(error.message))
        return null
      }
      const pet = data as Pet
      setPets((atual) => atual.map((p) => (p.id === id ? pet : p)))
      return resultado.url
    },
    [tutorId, recusaDoPlano],
  )

  const removerFoto = useCallback(
    async (id: string) => {
      setSalvando(true)
      setErro(null)
      const { data, error } = await supabase
        .from('pets')
        .update({ foto_url: null })
        .eq('id', id)
        .select('*, somente_leitura')
        .single()
      setSalvando(false)
      if (error) {
        if (!recusaDoPlano(error, id)) setErro(mensagemDeErro(error.message))
        return false
      }
      const pet = data as Pet
      setPets((atual) => atual.map((p) => (p.id === id ? pet : p)))
      return true
    },
    [recusaDoPlano],
  )

  const removerPet = useCallback(
    async (id: string) => {
      setSalvando(true)
      setErro(null)
      // A cascata apaga os registros dos anexos; os arquivos saem do Storage depois.
      const arquivos = await caminhosAnexosDoPet(id).catch(() => [])
      const { error } = await supabase.from('pets').delete().eq('id', id)
      setSalvando(false)
      if (error) {
        setErro(mensagemDeErro(error.message))
        return false
      }
      await removerArquivosAnexos(arquivos)
      setPets((atual) => atual.filter((p) => p.id !== id))
      // Sem ele, outro pet pode deixar de estar só para consulta.
      recarregar()
      if (petAtivoId === id) setPetAtivoId(null)
      return true
    },
    [petAtivoId, recarregar],
  )

  const podeCadastrar = podeCadastrarPet(plano, pets.length)

  const adicionarPet = useCallback(() => {
    if (podeCadastrar) router.push('/pet/novo')
    else abrirConvitePremium('limite_pets')
  }, [podeCadastrar])

  const editarPet = useCallback(
    (id: string, acao: () => void) => {
      if (todos.find((p) => p.id === id)?.somente_leitura) abrirConvitePremium('somente_leitura', id)
      else acao()
    },
    [todos],
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
      plano,
      podeCadastrar,
      adicionarPet,
      editarPet,
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
    [pets, petsMemoria, seniores, marcarSenior, petAtivo, plano, podeCadastrar, adicionarPet, editarPet, carregando, salvando, erro, criarPet, atualizarPet, salvarFoto, removerFoto, removerPet, recarregar],
  )

  return <PetsContext.Provider value={value}>{children}</PetsContext.Provider>
}

export function usePets(): PetsContextValue {
  const ctx = useContext(PetsContext)
  if (!ctx) throw new Error('usePets precisa estar dentro de <PetsProvider>')
  return ctx
}
