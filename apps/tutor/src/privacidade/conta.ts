import { supabase } from '../lib/supabase';
import { repositorioMetaPasseiosLocal, repositorioPasseiosLocal } from '../passeios/local';
import { compartilharExportacao } from './arquivoExportacao';

async function conferirConta(esperada?: string): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || (esperada && data.user.id !== esperada)) {
    throw new Error('A conta mudou. Entre novamente.');
  }
  return data.user.id;
}

export type EstadoPrivacidade = {
  pedidoId: string | null;
  executarEm: Date | null;
  status: string | null;
  podeSolicitar: boolean;
  podeCancelar: boolean;
};

export async function carregarEstadoPrivacidade(tutorId: string): Promise<EstadoPrivacidade> {
  await conferirConta(tutorId);
  const { data, error } = await supabase.rpc('privacidade_estado', { p_tutor: tutorId });
  if (error) throw new Error(error.message);
  await conferirConta(tutorId);
  if (!data || typeof data.pode_solicitar !== 'boolean' || typeof data.pode_cancelar !== 'boolean' ||
      (data.pedido_id !== null && typeof data.pedido_id !== 'string') ||
      (data.status !== null && typeof data.status !== 'string')) {
    throw new Error('Não foi possível confirmar o estado do pedido. Atualize a tela.');
  }
  const dataPedido = data.executar_em === null ? null : new Date(data.executar_em);
  if (dataPedido && !Number.isFinite(dataPedido.getTime())) throw new Error('Data de exclusão inválida. Atualize a tela.');
  return { pedidoId: data.pedido_id, executarEm: dataPedido, status: data.status,
    podeSolicitar: data.pode_solicitar, podeCancelar: data.pode_cancelar };
}

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
    supabase.rpc('privacidade_exportar_dados', { p_tutor: auth.user.id }),
    supabase
      .from('documentos_saude')
      .select('pet_id, tipo, titulo, realizado_em, arquivo_path, criado_em')
      .order('realizado_em', { ascending: false }),
  ]);
  if (error) throw new Error(error.message);
  if (erroDocumentos) throw new Error(erroDocumentos.message);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('O servidor não retornou seus dados. Tente exportar novamente.');
  }
  const { data: contaAtual } = await supabase.auth.getUser();
  if (contaAtual.user?.id !== auth.user.id) throw new Error('A conta mudou durante a exportação. Tente novamente.');
  await compartilharExportacao({ ...data, documentos_saude: documentos ?? [], passeios_locais: passeiosLocais, meta_semanal_passeios_km: metaPasseios }, auth.user.id, passeiosLocais, async () => {
    const { data: atual } = await supabase.auth.getUser();
    if (atual.user?.id !== auth.user.id) throw new Error('A conta mudou durante a exportação. Tente novamente.');
  });
  // O compartilhamento pode permanecer aberto enquanto o usuário troca de conta.
  await conferirConta(auth.user.id);
  const { error: erroRegistro } = await supabase.rpc('privacidade_registrar_exportacao', { p_tutor: auth.user.id });
  if (erroRegistro) throw new Error('Arquivo preparado, mas não foi possível registrar a exportação. Tente novamente.');
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

export async function cancelarExclusaoConta(tutorId: string, pedidoId: string): Promise<void> {
  await conferirConta(tutorId);
  const { error } = await supabase.rpc('privacidade_cancelar_exclusao', { p_tutor: tutorId, p_pedido: pedidoId });
  if (error) throw new Error(error.message);
  await conferirConta(tutorId);
}
