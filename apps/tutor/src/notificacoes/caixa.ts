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

async function conferirConta(esperada?: string): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || (esperada && data.user.id !== esperada)) throw new Error('A conta mudou. Entre novamente.');
  return data.user.id;
}

/** Últimos 30 dias, os mais novos primeiro. */
export async function carregarAvisos(tutor?: string): Promise<Aviso[]> {
  const conta = await conferirConta(tutor);
  const { data, error } = await supabase
    .from('notification_log')
    .select('id, pet_id, type, title, body, deep_link, sent_at, read_at')
    .gte('sent_at', new Date(Date.now() - 30 * 86400000).toISOString())
    .order('sent_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  await conferirConta(conta);
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

export async function marcarLido(id: string, tutor?: string): Promise<void> {
  const conta = await conferirConta(tutor);
  const { data, error } = await supabase.from('notification_log').update({ read_at: new Date().toISOString() }).eq('id', id).select('id').maybeSingle();
  if (error) throw new Error(error.message);
  await conferirConta(conta);
  if (data?.id !== id) throw new Error('Este aviso não está disponível nesta conta.');
}
