import { supabase } from '../lib/supabase';
import type { Especie } from '../pets/types';

/** Guarda compartilhada (BUSINESS.md 5.45): chamadas às funções guarda_* do banco. */

export type PetResumo = { id: string; nome: string; especie: Especie; foto_url: string | null };
export type PessoaGuarda = { user_id: string; nome: string; desde: string; pets: PetResumo[] };
export type ConviteEnviado = { id: string; email: string; pets: PetResumo[]; expira_em: string };
export type GuardaComigo = { titular_id: string; titular: string; suspensa: boolean; pets: PetResumo[] };
export type ConviteRecebido = { id: string; titular: string; pets: PetResumo[]; expira_em: string };

export type PainelGuarda = {
  premium: boolean;
  limite: number;
  pessoas: PessoaGuarda[];
  convites: ConviteEnviado[];
  comigo: GuardaComigo[];
  recebidos: ConviteRecebido[];
};

export type Convite =
  | { encontrado: false }
  | {
      encontrado: true;
      id: string;
      situacao: 'enviado' | 'aceito' | 'recusado' | 'cancelado' | 'expirado';
      titular: string;
      proprio: boolean;
      pets: PetResumo[];
      expira_em: string;
    };

export type Cuidadores = {
  titular: { user_id: string; nome: string; voce: boolean };
  pessoas: { user_id: string; nome: string; voce: boolean; desde: string }[];
};

export type TipoAtividade = 'vacina' | 'vermifugo' | 'peso' | 'consulta' | 'remedio' | 'dose';
export type Atividade = { id: string; pet_id: string; autor_id: string | null; tipo: TipoAtividade; resumo: string; criado_em: string };

const SITE = (process.env.EXPO_PUBLIC_SITE_URL || 'https://petlive.app').replace(/\/$/, '');

/** Link que vai no convite para quem ainda não tem o app. */
export function linkConvite(token: string): string {
  return `${SITE}/convite/${token}`;
}

function falha(error: { message: string } | null): never | void {
  if (error) throw new Error(error.message);
}

export async function carregarPainel(): Promise<PainelGuarda> {
  const { data, error } = await supabase.rpc('guarda_painel');
  falha(error);
  return data as PainelGuarda;
}

export async function convidar(petIds: string[], email: string): Promise<{ id: string; token: string; tem_conta: boolean; expira_em: string }> {
  const { data, error } = await supabase.rpc('guarda_convidar', { p_pet_ids: petIds, p_email: email.trim() });
  falha(error);
  return data as { id: string; token: string; tem_conta: boolean; expira_em: string };
}

export async function abrirConvite(id: string | null, token: string | null): Promise<Convite> {
  const { data, error } = await supabase.rpc('guarda_convite', { p_id: id, p_token: token });
  falha(error);
  return data as Convite;
}

export async function responderConvite(
  id: string,
  aceitar: boolean,
  petIds: string[] | null,
  token: string | null,
): Promise<{ situacao: 'aceito' | 'recusado'; pets: PetResumo[] }> {
  const { data, error } = await supabase.rpc('guarda_responder', { p_id: id, p_aceitar: aceitar, p_pet_ids: petIds, p_token: token });
  falha(error);
  return data as { situacao: 'aceito' | 'recusado'; pets: PetResumo[] };
}

export async function cancelarConvite(id: string): Promise<void> {
  const { error } = await supabase.rpc('guarda_cancelar', { p_id: id });
  falha(error);
}

/** Titular tira a pessoa de alguns pets (ou de todos, sem petIds). */
export async function removerPessoa(userId: string, petIds?: string[]): Promise<void> {
  const { error } = await supabase.rpc('guarda_remover', { p_user_id: userId, p_pet_ids: petIds ?? null });
  falha(error);
}

/** Quem foi convidado sai de alguns pets (ou de todos, sem petIds). */
export async function sairDaGuarda(petIds?: string[]): Promise<void> {
  const { error } = await supabase.rpc('guarda_sair', { p_pet_ids: petIds ?? null });
  falha(error);
}

export async function carregarCuidadores(petId: string): Promise<Cuidadores> {
  const { data, error } = await supabase.rpc('guarda_cuidadores', { p_pet_id: petId });
  falha(error);
  return data as Cuidadores;
}

export async function carregarAtividades(petId: string, dias = 30): Promise<Atividade[]> {
  const { data, error } = await supabase
    .from('pet_activity')
    .select('id, pet_id, autor_id, tipo, resumo, criado_em')
    .eq('pet_id', petId)
    .gte('criado_em', new Date(Date.now() - dias * 86400000).toISOString())
    .order('criado_em', { ascending: false })
    .limit(200);
  falha(error);
  return (data ?? []) as Atividade[];
}

/** Atualizações novas do pet na hora (Realtime). Devolve a função que cancela. */
export function ouvirAtividades(petId: string, aoChegar: (a: Atividade) => void): () => void {
  const canal = supabase
    .channel(`pet-activity-${petId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pet_activity', filter: `pet_id=eq.${petId}` }, (msg) =>
      aoChegar(msg.new as Atividade),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}

/** "Rex", "Rex e Mia", "Rex, Mia e Thor". */
export function nomesPets(pets: { nome: string }[]): string {
  const nomes = pets.map((p) => p.nome);
  if (nomes.length <= 1) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/** Agrupa por dia local: Hoje, Ontem ou a data. */
export function agruparPorDia<T extends { criado_em: string }>(itens: T[], agora = new Date()): { dia: string; itens: T[] }[] {
  const chave = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const hoje = chave(agora);
  const ontem = chave(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1));
  const grupos: { dia: string; itens: T[] }[] = [];
  for (const item of itens) {
    const d = new Date(item.criado_em);
    const k = chave(d);
    const dia = k === hoje ? 'Hoje' : k === ontem ? 'Ontem' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.itens.push(item);
    else grupos.push({ dia, itens: [item] });
  }
  return grupos;
}

/** "Ana" quando foi outra pessoa, "Você" quando foi quem está usando o app. */
export function nomeAutor(autorId: string | null, eu: string | undefined, cuidadores: Cuidadores | null): string {
  if (!autorId) return 'Alguém';
  if (autorId === eu) return 'Você';
  if (cuidadores?.titular.user_id === autorId) return cuidadores.titular.nome;
  return cuidadores?.pessoas.find((p) => p.user_id === autorId)?.nome ?? 'Alguém';
}
