import { supabase } from '../lib/supabase';

/** Linha da caixa de avisos (tabela notification_log, BUSINESS.md 5.43). */
export type Aviso = {
  id: string;
  pet_id: string | null;
  type: 'lembrete' | 'vacina' | 'dose' | 'peso' | 'sistema' | 'campanha';
  title: string;
  body: string | null;
  deep_link: string | null;
  sent_at: string;
  read_at: string | null;
};

/** Últimos 30 dias, os mais novos primeiro. */
export async function carregarAvisos(): Promise<Aviso[]> {
  const { data, error } = await supabase
    .from('notification_log')
    .select('id, pet_id, type, title, body, deep_link, sent_at, read_at')
    .order('sent_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as Aviso[];
}

/** Quantos avisos ainda não foram lidos (ponto vermelho no sino). */
export async function contarNaoLidos(): Promise<number> {
  const { count, error } = await supabase
    .from('notification_log')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) return 0;
  return count ?? 0;
}

export async function marcarLido(id: string): Promise<void> {
  await supabase.from('notification_log').update({ read_at: new Date().toISOString() }).eq('id', id);
}
