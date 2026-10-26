import { criarClienteTemporario, supabase } from '../lib/supabase';
import { conferirLimites, type LimitesPlano } from './limites';

export async function consultarLimites(tutor: string): Promise<LimitesPlano> {
  const { data, error } = await supabase.auth.getSession();
  if (error || data.session?.user.id !== tutor) throw new Error('A conta mudou. Entre novamente.');
  const cliente = criarClienteTemporario(data.session.access_token);
  const resultado = await cliente.rpc('limites_meu_plano', { p_tutor: tutor });
  if (resultado.error) throw new Error('Não foi possível atualizar os limites.');
  const atual = await supabase.auth.getSession();
  if (atual.error || atual.data.session?.user.id !== tutor) throw new Error('A conta mudou. Entre novamente.');
  return conferirLimites(resultado.data);
}
