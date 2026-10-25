import * as Crypto from 'expo-crypto';
import { supabase } from '../lib/supabase';
import { conferirContaOng } from './ong';
import { conferirPaginaAdocao, type PetAdocao } from './modelo';
export type DadosPetOng = Pick<PetAdocao, 'nome' | 'especie' | 'nascimento' | 'porte' | 'sexo' | 'castrado' | 'vacinado' | 'vermifugado' | 'descricao' | 'fotos'> & { status: 'rascunho' | 'publicado' };
export type EdicaoPetOng = DadosPetOng & { id: string; ong_id: string; versao: number; criado_em: string };
export const NOVO_PET_ONG: DadosPetOng = { nome: '', especie: 'cao', nascimento: null, porte: 'medio', sexo: 'nao_informado', castrado: null, vacinado: null, vermifugado: null, descricao: '', fotos: [], status: 'rascunho' };
export function dadosDaEdicao(p: DadosPetOng): DadosPetOng {
  return { nome: p.nome, especie: p.especie, nascimento: p.nascimento, porte: p.porte, sexo: p.sexo, castrado: p.castrado, vacinado: p.vacinado, vermifugado: p.vermifugado, descricao: p.descricao, fotos: [...p.fotos], status: p.status };
}
export function validarPetOng(d: DadosPetOng) {
  if (!d.nome.trim() || d.nome.trim().length > 60) throw new Error('Informe um nome de até 60 caracteres.');
  if (!d.descricao.trim() || d.descricao.trim().length > 2000) throw new Error('Escreva uma descrição de até 2000 caracteres.');
  if (d.nascimento !== null) {
    const data = new Date(`${d.nascimento}T12:00:00Z`);
    const hoje = new Date(); const limite = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.nascimento) || !Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== d.nascimento || d.nascimento < '1900-01-01' || d.nascimento > limite) throw new Error('Informe o nascimento como AAAA-MM-DD, até a data de hoje, ou deixe vazio.');
  }
  if (d.fotos.length > 6 || new Set(d.fotos).size !== d.fotos.length) throw new Error('Use até seis fotos diferentes.');
  if (d.status === 'publicado' && !d.fotos.length) throw new Error('Adicione ao menos uma foto antes de publicar.');
}
export function conferirEdicaoPetOng(data: unknown): EdicaoPetOng {
  const p = data as EdicaoPetOng;
  if (!p || typeof p.id !== 'string' || typeof p.ong_id !== 'string' || !Number.isSafeInteger(p.versao) || p.versao < 1 || !['rascunho', 'publicado'].includes(p.status)) throw new Error('Este pet não está disponível para edição. Atualize o painel.');
  conferirPaginaAdocao({ itens: [{ ...p, favorito: false, ong_nome: '', cidade: '', bairro: '' }], tem_mais: false });
  return p;
}
async function rpc(tutor: string, nome: string, args: Record<string, unknown>) {
  await conferirContaOng(tutor);
  const { data, error } = await supabase.rpc(nome, { p_tutor: tutor, ...args });
  await conferirContaOng(tutor);
  if (error) throw new Error(['Somente a ONG', 'Este pet foi alterado', 'Pets adotados', 'Pet indisponível', 'Uma foto', 'Adicione ao menos'].some((v) => error.message.startsWith(v)) ? error.message : 'Não foi possível confirmar o salvamento. Confira os dados e atualize a ficha para verificar antes de tentar novamente.');
  const pet = conferirEdicaoPetOng(data);
  if (pet.id !== args.p_pet) throw new Error('A ficha recebida não corresponde a este pet.');
  return pet;
}
export const obterPetOng = (tutor: string, id: string) => rpc(tutor, 'ong_pet_obter', { p_pet: id });
export function salvarPetOng(tutor: string, id: string, ong: string, versao: number, dados: DadosPetOng) {
  validarPetOng(dados);
  return rpc(tutor, 'ong_pet_salvar', { p_pet: id, p_ong: ong, p_versao: versao, p_dados: dados });
}
export async function enviarFotoOng(tutor: string, pet: string, foto: { uri: string; mimeType?: string | null }) {
  await conferirContaOng(tutor);
  const tipo = foto.mimeType ?? 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(tipo)) throw new Error('Escolha JPEG, PNG ou WebP.');
  const bytes = await (await fetch(foto.uri)).arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 5 * 1024 * 1024) throw new Error('A foto deve ter até 5 MB.');
  await conferirContaOng(tutor);
  const caminho = `${tutor}/${pet}-${Crypto.randomUUID()}.${tipo === 'image/png' ? 'png' : tipo === 'image/webp' ? 'webp' : 'jpg'}`;
  const { error } = await supabase.storage.from('pets').upload(caminho, bytes, { contentType: tipo, upsert: false });
  if (error) throw new Error('Não foi possível enviar a foto. Tente novamente.');
  await conferirContaOng(tutor);
  return supabase.storage.from('pets').getPublicUrl(caminho).data.publicUrl;
}
