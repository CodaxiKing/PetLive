import { supabase } from '../lib/supabase'
import { ANTECEDENCIA_REMEDIO_MIN, ANTECEDENCIAS_MIN, textoAntecedencia, textoAntecedencias } from './antecedencia'

export type TipoAviso = 'vacina' | 'vermifugo' | 'consulta' | 'banho_tosa' | 'remedio' | 'outro' | 'eventos'

export type CartaoAviso = {
  tipo: TipoAviso
  rotulo: string
  /** Descrição exibida quando o aviso está ligado. */
  quando: string
  /** Fundo do círculo do ícone (protótipo Notificacoes.dc.html). */
  fundo: string
  icone: 'vacina' | 'remedio' | 'relogio' | 'mais' | 'gota' | 'sino'
}

/** Cartões da tela, na ordem do protótipo. */
export const CARTOES_AVISO: CartaoAviso[] = [
  { tipo: 'vacina', rotulo: 'Vacinas', quando: textoAntecedencias(ANTECEDENCIAS_MIN.vacina), fundo: '#EADCFB', icone: 'vacina' },
  { tipo: 'remedio', rotulo: 'Remédios', quando: `${textoAntecedencia(ANTECEDENCIA_REMEDIO_MIN)} de cada dose`, fundo: '#FFF0C9', icone: 'remedio' },
  { tipo: 'vermifugo', rotulo: 'Vermífugo e antipulgas', quando: textoAntecedencias(ANTECEDENCIAS_MIN.vermifugo), fundo: '#D8F2E3', icone: 'relogio' },
  { tipo: 'consulta', rotulo: 'Consultas', quando: textoAntecedencias(ANTECEDENCIAS_MIN.consulta), fundo: '#E0F1FA', icone: 'mais' },
  { tipo: 'banho_tosa', rotulo: 'Banho e tosa', quando: textoAntecedencias(ANTECEDENCIAS_MIN.banho_tosa), fundo: '#FDE0E6', icone: 'gota' },
  { tipo: 'outro', rotulo: 'Outros avisos', quando: textoAntecedencias(ANTECEDENCIAS_MIN.outro), fundo: '#EDEFF3', icone: 'sino' },
  { tipo: 'eventos', rotulo: 'Eventos', quando: '1 dia antes e 2 horas antes', fundo: '#E0F1FA', icone: 'sino' },
]

/** Janela padrão do "Não perturbe" (protótipo: das 22h às 7h). */
export const JANELA_NAO_PERTURBE = { inicio: '22:00', fim: '07:00' } as const

/** Hora de um lembrete novo ou da rotina quando o tutor não escolhe outra (não é hora de aviso). */
export const HORARIO_PADRAO = '09:00'

export type EstadoAvisos = {
  /** Ligado por tipo. Ausência de linha = ligado. */
  ativos: Record<TipoAviso, boolean>
  naoPerturbe: boolean
}

function estadoPadrao(): EstadoAvisos {
  const ativos = {} as Record<TipoAviso, boolean>
  for (const cartao of CARTOES_AVISO) ativos[cartao.tipo] = true
  // Sem preferências salvas, vale o protótipo: tudo ligado e Não perturbe on.
  return { ativos, naoPerturbe: true }
}

/** Lê as preferências da tela Avisos (defaults quando nunca salvas). */
export async function carregarAvisos(): Promise<EstadoAvisos> {
  const { data: auth } = await supabase.auth.getUser()
  const tutorId = auth.user?.id
  if (!tutorId) throw new Error('Sessão expirada. Entre novamente.')

  const prefs = await supabase
    .from('notification_prefs')
    .select('tipo, ativo, nao_perturbe_inicio')
    .eq('tutor_id', tutorId)

  if (prefs.error) throw new Error(prefs.error.message)

  const estado = estadoPadrao()
  for (const linha of (prefs.data ?? []) as { tipo: TipoAviso; ativo: boolean }[]) {
    estado.ativos[linha.tipo] = linha.ativo
  }
  const linhas = (prefs.data ?? []) as { nao_perturbe_inicio: string | null }[]
  // Sem linhas: padrão ligado. Com linhas: só ligado se a janela estiver gravada.
  estado.naoPerturbe = linhas.length > 0 ? linhas.some((l) => l.nao_perturbe_inicio != null) : true


  return estado
}

/**
 * Persiste o estado inteiro (6 linhas de tipo + ajustes globais).
 * Uma única escrita por alteração mantém Não perturbe coerente em todos os tipos.
 */
export async function salvarAvisos(estado: EstadoAvisos): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  const tutorId = auth.user?.id
  if (!tutorId) throw new Error('Sessão expirada. Entre novamente.')

  const linhas = CARTOES_AVISO.map(({ tipo }) => ({
    tutor_id: tutorId,
    tipo,
    ativo: estado.ativos[tipo],
    nao_perturbe_inicio: estado.naoPerturbe ? JANELA_NAO_PERTURBE.inicio : null,
    nao_perturbe_fim: estado.naoPerturbe ? JANELA_NAO_PERTURBE.fim : null,
  }))

  const [prefs, settings] = await Promise.all([
    supabase.from('notification_prefs').upsert(linhas, { onConflict: 'tutor_id,tipo' }),
    supabase.from('notification_settings').upsert(
      {
        // A linha guarda o fuso que o servidor usa no "Não perturbe".
        tutor_id: tutorId,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: 'tutor_id' },
    ),
  ])

  if (prefs.error) throw new Error(prefs.error.message)
  if (settings.error) throw new Error(settings.error.message)

  limparCacheAvisos()
}

// ============================================================
// Cache: quem agenda notificação locais não precisa plumbar estado.
// ============================================================
let cache: EstadoAvisos | null = null

/** Preferências em memória (busca no servidor na primeira chamada). */
export async function preferenciasAvisos(): Promise<EstadoAvisos> {
  if (cache) return cache
  cache = await carregarAvisos()
  return cache
}

/** Zera o cache (chamado ao salvar na tela Avisos). */
export function limparCacheAvisos(): void {
  cache = null
}
