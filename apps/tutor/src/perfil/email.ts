import { criarClienteTemporario, supabase } from '../lib/supabase';

export function validarTrocaEmail(atual: string, novo: string, confirmacao: string): string | null {
  const email = novo.trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Informe um e-mail válido.';
  if (email.toLowerCase() !== confirmacao.trim().toLowerCase()) return 'Os e-mails não conferem.';
  if (email.toLowerCase() === atual.trim().toLowerCase()) return 'Informe um e-mail diferente do atual.';
  return null;
}

export async function solicitarTrocaEmail(tutorId: string, novo: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== tutorId) throw new Error('Sua conta mudou. Abra esta tela novamente.');
  // Evita renovar o token fora do cliente principal e disputar sua rotação.
  if (!data.session.expires_at || data.session.expires_at < Date.now() / 1000 + 60) {
    throw new Error('A sessão está sendo renovada. Tente novamente em alguns segundos.');
  }
  const cliente = criarClienteTemporario();
  try {
    const sessao = await cliente.auth.setSession(data.session);
    if (sessao.error) throw sessao.error;
    const { data: conta } = await supabase.auth.getSession();
    if (conta.session?.user.id !== tutorId) throw new Error('Sua conta mudou. Abra esta tela novamente.');
    // A requisição permanece vinculada à sessão capturada, mesmo se houver logout.
    const resultado = await cliente.auth.updateUser({ email: novo.trim().toLowerCase() });
    if (resultado.error) {
      if (resultado.error.status === 429) throw new Error('Aguarde alguns minutos antes de tentar novamente.');
      throw new Error('Não foi possível solicitar a troca. Verifique o endereço e tente novamente.');
    }
    return resultado.data.user;
  } finally {
    cliente.auth.stopAutoRefresh();
  }
}
