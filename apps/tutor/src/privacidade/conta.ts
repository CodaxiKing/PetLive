import { supabase } from '../lib/supabase';
import { repositorioMetaPasseiosLocal, repositorioPasseiosLocal } from '../passeios/local';
import { compartilharExportacao } from './arquivoExportacao';

/**
 * LGPD (art. 18, V): exporta tudo que pertence ao tutor em JSON e abre
 * a folha de compartilhamento do sistema (salvar, enviar etc.). Cada
 * exportação fica registrada em lgpd_requests.
 */
export async function exportarMeusDados(): Promise<void> {
  const { data: auth, error: erroAuth } = await supabase.auth.getUser();
  if (erroAuth || !auth.user) throw new Error('Entre novamente para exportar seus dados.');
  const passeiosLocais = await repositorioPasseiosLocal(auth.user.id).carregar();
  const metaPasseios = await repositorioMetaPasseiosLocal(auth.user.id).carregar();
  const [{ data, error }, { data: documentos, error: erroDocumentos }] = await Promise.all([
    supabase.rpc('exportar_meus_dados'),
    supabase
      .from('documentos_saude')
      .select('pet_id, tipo, titulo, realizado_em, arquivo_path, criado_em')
      .order('realizado_em', { ascending: false }),
  ]);
  if (error) throw new Error(error.message);
  if (erroDocumentos) throw new Error(erroDocumentos.message);
  const { data: contaAtual } = await supabase.auth.getUser();
  if (contaAtual.user?.id !== auth.user.id) throw new Error('A conta mudou durante a exportação. Tente novamente.');
  await compartilharExportacao({ ...data, documentos_saude: documentos ?? [], passeios_locais: passeiosLocais, meta_semanal_passeios_km: metaPasseios }, auth.user.id, passeiosLocais, async () => {
    const { data: atual } = await supabase.auth.getUser();
    if (atual.user?.id !== auth.user.id) throw new Error('A conta mudou durante a exportação. Tente novamente.');
  });
  await supabase.rpc('registrar_exportacao');
}

/**
 * Agenda a exclusão da conta (BUSINESS.md 12): os dados são apagados em
 * 30 dias pela função lgpd-delete, e até lá o tutor pode cancelar.
 * Devolve a data da exclusão.
 */
export async function solicitarExclusaoConta(): Promise<Date> {
  const { data, error } = await supabase.rpc('solicitar_exclusao_conta');
  if (error) throw new Error(error.message);
  return new Date(data as string);
}

export async function cancelarExclusaoConta(): Promise<void> {
  const { error } = await supabase.rpc('cancelar_exclusao_conta');
  if (error) throw new Error(error.message);
}

/** Data da exclusão agendada, ou null quando não há pedido em aberto. */
export async function exclusaoAgendada(): Promise<Date | null> {
  const { data, error } = await supabase
    .from('lgpd_requests')
    .select('executar_em')
    .eq('tipo', 'apagar')
    .eq('status', 'novo')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.executar_em ? new Date(data.executar_em) : null;
}
