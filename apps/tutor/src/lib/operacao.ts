import { useEffect, useSyncExternalStore } from 'react'
import { AppState } from 'react-native'

/**
 * A API do PetLive está no ar? Consulta leve (status_publico) ao abrir, ao
 * voltar para o app e de tempos em tempos. Com internet no aparelho e o
 * servidor sem responder duas vezes seguidas, o app mostra a tela de
 * manutenção. A manutenção planejada (ligada pela equipe no painel) também
 * aparece aqui. Sem internet não é manutenção: vale o aviso de offline.
 */
export type Manutencao = { mensagem: string | null; previsao: string | null }
export type EstadoOperacao =
  | { tipo: 'ok' }
  | { tipo: 'manutencao'; planejada: boolean; detalhes: Manutencao }
  | { tipo: 'sem_internet' }

type Resultado = 'ok' | 'fora' | 'sem_internet' | { planejada: Manutencao }

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''
/** Endereço que só confirma que há internet (resposta 204, sem conteúdo). */
const TESTE_INTERNET = 'https://clients3.google.com/generate_204'
const FALHAS_PARA_MANUTENCAO = 2

async function comLimite(url: string, init: RequestInit, ms: number, buscar: typeof fetch): Promise<Response> {
  const controle = new AbortController()
  const t = setTimeout(() => controle.abort(), ms)
  try {
    return await buscar(url, { ...init, signal: controle.signal })
  } finally {
    clearTimeout(t)
  }
}

/** Uma consulta: o servidor respondeu, está fora, ou o aparelho está sem internet. */
export async function consultarOperacao(buscar: typeof fetch = fetch): Promise<Resultado> {
  try {
    const r = await comLimite(`${URL}/rest/v1/rpc/status_publico`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
      body: '{}',
    }, 8000, buscar)
    // 4xx é problema de versão ou de chave, não queda: o app segue e os erros aparecem nas telas.
    if (r.status < 500) {
      const corpo = r.ok ? await r.json().catch(() => null) : null
      const m = corpo?.manutencao
      return m?.ativa ? { planejada: { mensagem: m.mensagem ?? null, previsao: m.previsao ?? null } } : 'ok'
    }
  } catch {
    // Cai para a conferência da internet abaixo.
  }
  try {
    const r = await comLimite(TESTE_INTERNET, { method: 'GET' }, 5000, buscar)
    return r.status < 500 ? 'fora' : 'sem_internet'
  } catch {
    return 'sem_internet'
  }
}

// ---------- Estado compartilhado ----------
let estado: EstadoOperacao = { tipo: 'ok' }
let falhas = 0
let consultando = false
const ouvintes = new Set<() => void>()
const definir = (novo: EstadoOperacao) => {
  estado = novo
  ouvintes.forEach((o) => o())
}

/** Confere agora e atualiza a tela. Duas falhas seguidas viram manutenção. */
export async function conferirOperacao(buscar: typeof fetch = fetch): Promise<EstadoOperacao> {
  if (consultando) return estado
  consultando = true
  try {
    const r = await consultarOperacao(buscar)
    if (r === 'ok') {
      falhas = 0
      definir({ tipo: 'ok' })
    } else if (r === 'sem_internet') {
      falhas = 0
      definir({ tipo: 'sem_internet' })
    } else if (r === 'fora') {
      falhas++
      if (falhas >= FALHAS_PARA_MANUTENCAO) definir({ tipo: 'manutencao', planejada: false, detalhes: { mensagem: null, previsao: null } })
    } else {
      falhas = 0
      definir({ tipo: 'manutencao', planejada: true, detalhes: r.planejada })
    }
    return estado
  } finally {
    consultando = false
  }
}

/** Para testes. */
export function reiniciarOperacao() {
  estado = { tipo: 'ok' }
  falhas = 0
  consultando = false
}

/** Estado da operação com a vigia ligada: confere ao abrir, ao voltar e a cada 1 min (fora) ou 5 min (no ar). */
export function useOperacao(): EstadoOperacao {
  const atual = useSyncExternalStore(
    (o) => {
      ouvintes.add(o)
      return () => ouvintes.delete(o)
    },
    () => estado,
  )
  const emManutencao = atual.tipo === 'manutencao'
  useEffect(() => {
    conferirOperacao().catch(() => undefined)
    const t = setInterval(() => conferirOperacao().catch(() => undefined), emManutencao ? 60_000 : 300_000)
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') conferirOperacao().catch(() => undefined)
    })
    return () => {
      clearInterval(t)
      app.remove()
    }
  }, [emManutencao])
  return atual
}

/** "Previsão de volta: hoje às 15:30". */
export function textoPrevisao(iso: string | null, agora = new Date()): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const mesmoDia = d.toDateString() === agora.toDateString()
  return `Previsão de volta: ${mesmoDia ? 'hoje' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${hora}`
}
