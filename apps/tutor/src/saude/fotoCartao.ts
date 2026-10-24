import { File, Paths } from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { enviarDocumentoSaude, salvarDocumentoSaude } from './documentos';
import { dadosFotoCartao, validarFotoCartao, type FotoCartao } from './fotoCartaoDados';

export function conferirArquivoCartao(foto: FotoCartao) {
  const arquivo = new File(foto.uri);
  if (!arquivo.exists) throw new Error('A foto temporária não está disponível. Fotografe novamente.');
  return validarFotoCartao(foto, arquivo.size);
}
/** Remove somente o arquivo temporário devolvido pela câmera, dentro do cache. */
export function descartarFotoCartao(uri: string) {
  try {
    const pasta = Paths.cache.uri.replace(/\/?$/, '/');
    if (!uri.startsWith(pasta) || decodeURIComponent(uri).split('/').includes('..')) return;
    const arquivo = new File(uri); if (arquivo.exists) arquivo.delete();
  } catch { /* O sistema também pode limpar o cache. */ }
}
async function conferirConta(tutorId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== tutorId) throw new Error('A conta mudou. Entre novamente para salvar o cartão.');
}
export async function salvarFotoCartao(tutorId: string, petId: string, foto: FotoCartao, titulo: string, data: string) {
  const campos = dadosFotoCartao(titulo, data);
  conferirArquivoCartao(foto);
  await conferirConta(tutorId);
  const [perfil, pet] = await Promise.all([
    supabase.from('profiles').select('plano').eq('id', tutorId).maybeSingle(),
    supabase.from('pets').select('id,tutor_id').eq('id', petId).eq('tutor_id', tutorId).maybeSingle(),
  ]);
  if (perfil.error || perfil.data?.plano !== 'premium') throw new Error('Confirme seu Premium para usar a captura guiada.');
  if (pet.error || pet.data?.tutor_id !== tutorId) throw new Error('Este pet não está disponível nesta conta.');
  await conferirConta(tutorId);
  let caminho: string | null = null;
  let registrado = false;
  try {
    caminho = await enviarDocumentoSaude(tutorId, petId, foto.uri, 'image/jpeg');
    await conferirConta(tutorId);
    await salvarDocumentoSaude({ tutor_id: tutorId, pet_id: petId, tipo: 'cartao_vacina', titulo: campos.titulo,
      realizado_em: campos.realizadoEm, arquivo_path: caminho });
    registrado = true;
    await conferirConta(tutorId);
  } catch (e) {
    // Se o registro foi confirmado e a conta mudou depois, não apaga seu anexo.
    // O caminho só é limpo quando a gravação do documento não foi confirmada.
    if (caminho && !registrado) await supabase.storage.from('anexos').remove([caminho]).catch(() => undefined);
    throw e;
  }
}
