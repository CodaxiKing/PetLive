import { supabase } from '../lib/supabase';
import { carregarLinha, type ItemLinha } from './linhaDoTempo';

export const LIMITE_ALBUM = 60;
export const chaveLembranca = (i: ItemLinha) => `${i.tipo}:${i.id}:${i.data}`;
export function dataCivilAlbum(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}
export function lembrancasDoAno(itens: ItemLinha[], ano: number): ItemLinha[] {
  if (!Number.isInteger(ano) || ano < 1900 || ano > 9999) throw new Error('Escolha um ano válido.');
  const unicos = new Map<string, ItemLinha>();
  for (const item of itens) {
    if (dataCivilAlbum(item.data) && Number(item.data.slice(0, 4)) === ano) unicos.set(chaveLembranca(item), item);
  }
  return [...unicos.values()].sort((a, b) => a.data.localeCompare(b.data) || chaveLembranca(a).localeCompare(chaveLembranca(b)));
}
export function montarAlbum(itens: ItemLinha[], ano: number, escolhidas: ReadonlySet<string>): ItemLinha[] {
  const paginas = lembrancasDoAno(itens, ano).filter(i => escolhidas.has(chaveLembranca(i)));
  if (!paginas.length) throw new Error('Selecione ao menos uma lembrança.');
  if (paginas.length > LIMITE_ALBUM) throw new Error(`Escolha até ${LIMITE_ALBUM} lembranças por álbum.`);
  return paginas;
}
export function selecaoInicialAlbum(itens: ItemLinha[], ano: number): Set<string> {
  // Dados de saúde só entram quando a pessoa os escolhe explicitamente.
  return new Set(lembrancasDoAno(itens, ano).filter(i => i.manual || ['chegada','nascimento','aniversario'].includes(i.tipo)).slice(0, LIMITE_ALBUM).map(chaveLembranca));
}
async function conferirConta(tutorId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== tutorId) throw new Error('A conta mudou. Entre novamente.');
}
export async function carregarLembrancasAlbum(tutorId: string, petId: string): Promise<ItemLinha[]> {
  await conferirConta(tutorId);
  // RLS e a RPC conferem acesso ao pet; não usa o pet ativo para gravar/alterar nada.
  const itens = await carregarLinha(petId);
  await conferirConta(tutorId);
  return itens;
}
export async function fotosAlbum(tutorId: string, itens: ItemLinha[]): Promise<Record<string, string>> {
  await conferirConta(tutorId);
  const paths = [...new Set(itens.flatMap(i => i.foto_path ? [i.foto_path] : []))];
  if (paths.some(p => !p.startsWith(`${tutorId}/`) || p.split('/').includes('..'))) throw new Error('Foto indisponível nesta conta.');
  if (paths.length > LIMITE_ALBUM) throw new Error('Muitas fotos na prévia.');
  if (!paths.length) return {};
  const { data, error } = await supabase.storage.from('anexos').createSignedUrls(paths, 300);
  if (error) throw new Error('Não foi possível carregar as fotos. Tente novamente.');
  await conferirConta(tutorId);
  // Links temporários ficam apenas na memória da tela, nunca no álbum ou em AsyncStorage.
  return Object.fromEntries((data ?? []).flatMap(i => i.path && i.signedUrl && !i.error ? [[i.path, i.signedUrl]] : []));
}
