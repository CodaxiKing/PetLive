import { supabase } from '../lib/supabase';
export type CursorOng = { id: string; criado_em: string };
export type PetOng = CursorOng & { nome: string; status: 'rascunho' | 'publicado' | 'adotado' | 'oculto'; confirmado_em: string; ong_nome: string; ong_status: string; interesses: number; moderacao_motivo?: string|null };
export type ContatoOng = CursorOng & { mensagem: string; email_resposta: string | null };
type Pagina<T> = { itens: T[]; tem_mais: boolean };
export type PainelOng = Pagina<PetOng> & { ongs: { id?: string; nome: string; status: string }[] };
const estados = ['pendente', 'aprovada', 'suspensa', 'recusada'];
const dataValida = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
export function conferirPaginaOng<T>(valor: unknown, itemValido: (v: T) => boolean): Pagina<T> {
  const p = valor as Pagina<T>;
  if (!p || !Array.isArray(p.itens) || p.itens.length > 20 || typeof p.tem_mais !== 'boolean' || (p.tem_mais && p.itens.length !== 20) || p.itens.some((i) => !i || !itemValido(i))) throw new Error('Resposta incompleta. Atualize o modo ONG.');
  return p;
}
const cursorValido = (v: CursorOng) => typeof v.id === 'string' && Boolean(v.id) && dataValida(v.criado_em);
export async function conferirContaOng(tutorId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== tutorId) throw new Error('A conta mudou. Abra o modo ONG novamente.');
}
async function chamar(tutorId: string, nome: string, params: Record<string, unknown>) {
  await conferirContaOng(tutorId);
  const { data, error } = await supabase.rpc(nome, { p_tutor: tutorId, ...params });
  await conferirContaOng(tutorId);
  if (error) throw new Error(['Somente a ONG', 'Somente pets publicados', 'Contato indisponível'].some((i) => error.message.startsWith(i)) ? error.message : 'Não foi possível confirmar a operação. Atualize o modo ONG e tente novamente.');
  return data;
}
const paginaParams = (cursor: CursorOng | null) => ({ p_antes: cursor?.criado_em ?? null, p_antes_id: cursor?.id ?? null });
export async function carregarPetsOng(tutorId: string, cursor: CursorOng | null = null): Promise<PainelOng> {
  const data = await chamar(tutorId, 'ong_pets_listar', paginaParams(cursor));
  const pagina = conferirPaginaOng<PetOng>(data, (i) => cursorValido(i) && typeof i.nome === 'string' && typeof i.ong_nome === 'string' && estados.includes(i.ong_status) && ['rascunho', 'publicado', 'adotado', 'oculto'].includes(i.status) && dataValida(i.confirmado_em) && Number.isSafeInteger(i.interesses) && i.interesses >= 0);
  if (!Array.isArray(data.ongs) || data.ongs.some((g: { nome?: unknown; status?: unknown }) => !g || typeof g.nome !== 'string' || typeof g.status !== 'string' || !estados.includes(g.status))) throw new Error('Cadastro de ONG incompleto. Atualize a tela.');
  if (pagina.itens.some(i => i.moderacao_motivo !== undefined && i.moderacao_motivo !== null && (typeof i.moderacao_motivo !== 'string' || i.moderacao_motivo.length > 500))) throw new Error('Dados de moderação incompletos. Atualize a tela.');
  return { ...pagina, ongs: data.ongs };
}
export async function carregarInteressesOng(tutorId: string, petId: string, cursor: CursorOng | null = null) {
  const data = await chamar(tutorId, 'ong_interesses_listar', { p_pet: petId, ...paginaParams(cursor) });
  return conferirPaginaOng<ContatoOng>(data, (i) => cursorValido(i) && typeof i.mensagem === 'string' && (i.email_resposta === null || typeof i.email_resposta === 'string'));
}
export async function marcarAdotadoOng(tutorId: string, petId: string) {
  if (await chamar(tutorId, 'ong_marcar_adotado', { p_pet: petId }) !== true) throw new Error('Não foi possível confirmar a adoção. Atualize o painel.');
}
export async function confirmarDisponibilidadeOng(tutorId: string, petId: string) {
  await chamar(tutorId, 'adocao_confirmar_pet', { p_pet: petId });
}
export function linkRespostaOng(email: string, nome: string) {
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail de resposta inválido.');
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Interesse na adoção de ${nome}`)}`;
}
export async function prepararRespostaOng(tutorId: string, contatoId: string, nome: string) {
  const email = await chamar(tutorId, 'ong_contato_email', { p_contato: contatoId });
  if (typeof email !== 'string') throw new Error('Contato indisponível para resposta.');
  return linkRespostaOng(email, nome);
}
