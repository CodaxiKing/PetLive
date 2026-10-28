import { supabase } from '../lib/supabase'

/** Conversa com a loja (BUSINESS.md 5.12): uma por solicitação, fecha 7 dias depois do fim. */
export type Mensagem = { id: number; da_loja: boolean; body: string; at: string; lida: boolean }
export type Conversa = { id: string; fechada: boolean; sou_loja: boolean; loja: string; numero: number; mensagens: Mensagem[] }

export const RESPOSTAS_RAPIDAS = ['Posso trocar o horário?', 'Aceitam Pix?', 'Já estou a caminho.']

export async function abrirConversa(requestId: string): Promise<Conversa> {
  const { data, error } = await supabase.rpc('chat_abrir', { p_request: requestId })
  if (error) throw new Error(error.message)
  return data as Conversa
}

export async function enviarMensagem(conversaId: string, texto: string): Promise<void> {
  const limpo = texto.trim()
  if (!limpo) throw new Error('Escreva a mensagem.')
  const { error } = await supabase.rpc('chat_enviar', { p_conversa: conversaId, p_texto: limpo.slice(0, 1000) })
  if (error) throw new Error(error.message)
}

/** Junta mensagens novas (do Realtime) sem duplicar e em ordem. */
export function juntarMensagens(atuais: Mensagem[], novas: Mensagem[]): Mensagem[] {
  const porId = new Map(atuais.map((m) => [m.id, m]))
  for (const m of novas) porId.set(m.id, m)
  return [...porId.values()].sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id)
}

/** Mensagens novas da conversa, em tempo real (RLS: só as partes recebem). */
export function ouvirMensagens(conversaId: string, aoChegar: (m: Mensagem) => void): () => void {
  const canal = supabase
    .channel(`chat-${conversaId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversaId}` }, (p) => {
      const r = p.new as { id: number; da_loja: boolean; body: string; at: string; read_at: string | null }
      aoChegar({ id: r.id, da_loja: r.da_loja, body: r.body, at: r.at, lida: Boolean(r.read_at) })
    })
    .subscribe()
  return () => {
    supabase.removeChannel(canal)
  }
}
