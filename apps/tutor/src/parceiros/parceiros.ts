import { supabase } from '../lib/supabase';

/** Plano e seguro pet com parceiros (BUSINESS.md 5.30). */
export type Parceiro = {
  id: string;
  nome: string;
  tipo: 'plano' | 'seguro';
  beneficios: string;
  preco_texto: string | null;
  url: string;
};

export async function carregarParceiros(): Promise<Parceiro[]> {
  const { data, error } = await supabase
    .from('insurance_partners')
    .select('id, nome, tipo, beneficios, preco_texto, url')
    .order('ordem')
    .order('nome');
  if (error) throw new Error(error.message);
  return (data ?? []) as Parceiro[];
}

/** Registra o clique (para a comissão) e devolve o link do parceiro. */
export async function cotar(parceiro: Parceiro): Promise<string> {
  const { data, error } = await supabase.rpc('parceiro_cotar', { p_partner: parceiro.id });
  if (error) throw new Error(error.message);
  const url = typeof data === 'string' ? data : parceiro.url;
  if (!/^https:\/\//i.test(url)) throw new Error('Link do parceiro inválido.');
  return url;
}
