import { supabase } from '../lib/supabase';
import { conferirPaginaAdocao, type CursorAdocao, type FiltrosAdocao } from './modelo';
async function conferirConta(tutorId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== tutorId) throw new Error('A conta mudou. Abra a adoção novamente.');
}
export async function carregarPaginaAdocao(tutorId: string, filtros: FiltrosAdocao, cursor: CursorAdocao | null = null) {
  if (filtros.cidade.trim().length > 80) throw new Error('Digite uma cidade com até 80 caracteres.');
  await conferirConta(tutorId);
  const { data, error } = await supabase.rpc('adocao_listar', { p_tutor: tutorId, p_especie: filtros.especie || null,
    p_filhote: filtros.filhote, p_porte: filtros.porte || null, p_sexo: filtros.sexo || null,
    p_cidade: filtros.cidade.trim() || null, p_favoritos: filtros.favoritos, p_antes: cursor?.criado_em ?? null, p_antes_id: cursor?.id ?? null });
  if (error) throw new Error('Não foi possível carregar a adoção. Confira a conexão e tente novamente.');
  await conferirConta(tutorId); return conferirPaginaAdocao(data);
}
export async function favoritarAdocao(tutorId: string, petId: string, ativo: boolean) {
  await conferirConta(tutorId);
  const { data, error } = await supabase.rpc('adocao_favoritar', { p_tutor: tutorId, p_pet: petId, p_ativo: ativo });
  if (error) throw new Error(error.message.startsWith('Este pet não está disponível') ? error.message : 'Não foi possível salvar o favorito. Confira a conexão e tente novamente.');
  await conferirConta(tutorId);
  if (data !== ativo) throw new Error('Não foi possível confirmar o favorito. Atualize a lista.');
  return data as boolean;
}
