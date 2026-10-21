import { supabase } from '../lib/supabase';

/**
 * Indicações de lugares pet friendly feitas pelos tutores (tabela
 * sugestoes_lugar). Entram "em análise" e só vão para o mapa depois que a
 * equipe aprova (mesma regra dos eventos enviados por usuário, BUSINESS.md 5.16).
 */
export type CategoriaSugestao = 'restaurante' | 'hotel' | 'praia' | 'parque';
export type AceitaSugestao = 'caes' | 'gatos' | 'caes_e_gatos';
export type StatusSugestao = 'em_analise' | 'aprovada' | 'recusada';

export type Sugestao = {
  id: string;
  nome: string;
  categoria: CategoriaSugestao;
  aceita: AceitaSugestao;
  endereco: string | null;
  status: StatusSugestao;
  motivo_recusa: string | null;
  criado_em: string;
};

export const ROTULO_STATUS: Record<StatusSugestao, string> = {
  em_analise: 'Em análise',
  aprovada: 'No mapa',
  recusada: 'Não aprovada',
};

export async function indicarLugar(dados: {
  nome: string;
  categoria: CategoriaSugestao;
  aceita: AceitaSugestao;
  endereco: string | null;
  lat: number;
  lng: number;
  observacao: string | null;
}): Promise<void> {
  const { error } = await supabase.from('sugestoes_lugar').insert(dados);
  if (error) throw new Error(error.message);
}

export async function minhasSugestoes(): Promise<Sugestao[]> {
  const { data, error } = await supabase
    .from('sugestoes_lugar')
    .select('id, nome, categoria, aceita, endereco, status, motivo_recusa, criado_em')
    .order('criado_em', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as Sugestao[];
}
