import { Share } from 'react-native';
import { supabase } from '../lib/supabase';

/**
 * LGPD (art. 18, V): exporta tudo que pertence ao tutor em JSON e abre
 * a folha de compartilhamento do sistema (salvar, enviar etc.). Cada
 * exportação fica registrada em lgpd_requests.
 */
export async function exportarMeusDados(): Promise<void> {
  const { data, error } = await supabase.rpc('exportar_meus_dados');
  if (error) throw new Error(error.message);
  const json = JSON.stringify(data, null, 2);
  await Share.share({ title: 'Meus dados — PetLive', message: json });
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
