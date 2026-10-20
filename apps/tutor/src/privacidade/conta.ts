import { Share } from 'react-native';
import { supabase } from '../lib/supabase';

/**
 * LGPD (art. 18, V): exporta tudo que pertence ao tutor em JSON e abre
 * a folha de compartilhamento do sistema (salvar, enviar etc.).
 */
export async function exportarMeusDados(): Promise<void> {
  const { data, error } = await supabase.rpc('exportar_meus_dados');
  if (error) throw new Error(error.message);
  const json = JSON.stringify(data, null, 2);
  await Share.share({ title: 'Meus dados — PetLive', message: json });
}

/**
 * Apaga as fotos/anexos do tutor pela API do Storage (pasta = uid, a
 * mesma convenção das policies). O DELETE direto em storage.objects é
 * recusado pelo Storage, então não dá para fazer no banco.
 */
async function apagarArquivosDaConta(tutorId: string): Promise<void> {
  for (const bucket of ['pets', 'anexos']) {
    const { data: arquivos } = await supabase.storage
      .from(bucket)
      .list(tutorId, { limit: 1000 });
    const caminhos = (arquivos ?? []).filter((a) => a.name).map((a) => `${tutorId}/${a.name}`);
    if (caminhos.length) await supabase.storage.from(bucket).remove(caminhos);
  }
}

/** Exclui a conta no servidor (RPC) e encerra a sessão local. */
export async function excluirMinhaConta(tutorId: string): Promise<void> {
  // Melhor esforço: se falhar, a conta é apagada mesmo assim e o arquivo fica órfão.
  await apagarArquivosDaConta(tutorId).catch(() => undefined);
  const { error } = await supabase.rpc('excluir_minha_conta');
  if (error) throw new Error(error.message);
  await supabase.auth.signOut();
}
