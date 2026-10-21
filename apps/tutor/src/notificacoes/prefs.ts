import { supabase } from '../lib/supabase'

export type TipoAviso = 'vacina' | 'vermifugo' | 'consulta' | 'banho_tosa' | 'remedio' | 'outro'

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
  { tipo: 'vacina', rotulo: 'Vacinas', quando: '7 dias antes e no dia', fundo: '#EBDDFB', icone: 'vacina' },
  { tipo: 'remedio', rotulo: 'Remédios', quando: 'A cada dose', fundo: '#FFF1C9', icone: 'remedio' },
  { tipo: 'vermifugo', rotulo: 'Vermífugo e antipulgas', quando: '3 dias antes', fundo: '#DDF3E6', icone: 'relogio' },
  { tipo: 'consulta', rotulo: 'Consultas', quando: '1 dia antes', fundo: '#E3F3FC', icone: 'mais' },
  { tipo: 'banho_tosa', rotulo: 'Banho e tosa', quando: 'No dia do agendamento', fundo: '#FCE1EF', icone: 'gota' },
  { tipo: 'outro', rotulo: 'Outros avisos', quando: 'No dia do lembrete', fundo: '#EDEFF3', icone: 'sino' },
]

/** Janela padrão do "Não perturbe" (protótipo: das 22h às 7h). */
export const JANELA_NAO_PERTURBE = { inicio: '22:00', fim: '07:00' } as const

/** Hora padrão dos avisos quando o tutor nunca escolheu. */
export const HORARIO_PADRAO = '09:00'

export type EstadoAvisos = {
  /** Ligado por tipo. Ausência de linha = ligado. */
  ativos: Record<TipoAviso, boolean>
  naoPerturbe: boolean
  /** 'HH:MM' do "Horário dos avisos". */
  horario: string
}

function estadoPadrao(): EstadoAvisos {
  const ativos = {} as Record<TipoAviso, boolean>
  for (const cartao of CARTOES_AVISO) ativos[cartao.tipo] = true
  // Sem preferências salvas, vale o protótipo: tudo ligado e Não perturbe on.
  return { ativos, naoPerturbe: true, horario: HORARIO_PADRAO }
}

/** Lê as preferências da tela Avisos (defaults quando nunca salvas). */
export async function carregarAvisos(): Promise<EstadoAvisos> {
  const { data: auth } = await supabase.auth.getUser()
  const tutorId = auth.user?.id
  if (!tutorId) throw new Error('Sessão expirada. Entre novamente.')

  const [prefs, settings] = await Promise.all([
    supabase
      .from('notification_prefs')
      .select('tipo, ativo, nao_perturbe_inicio')
      .eq('tutor_id', tutorId),
    supabase
      .from('notification_settings')
      .select('horario_avisos')
      .eq('tutor_id', tutorId)
      .maybeSingle(),
  ])

  if (prefs.error) throw new Error(prefs.error.message)
  if (settings.error) throw new Error(settings.error.message)

  const estado = estadoPadrao()
  for (const linha of (prefs.data ?? []) as { tipo: TipoAviso; ativo: boolean }[]) {
    estado.ativos[linha.tipo] = linha.ativo
  }
  const linhas = (prefs.data ?? []) as { nao_perturbe_inicio: string | null }[]
  // Sem linhas: padrão ligado. Com linhas: só ligado se a janela estiver gravada.
  estado.naoPerturbe = linhas.length > 0 ? linhas.some((l) => l.nao_perturbe_inicio != null) : true

  const horario = (settings.data?.horario_avisos ?? '').slice(0, 5)
  estado.horario = /^\d{2}:\d{2}$/.test(horario) ? horario : HORARIO_PADRAO

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
        tutor_id: tutorId,
        horario_avisos: estado.horario,
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
