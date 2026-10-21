import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';

/**
 * Esqueci minha senha: o Supabase manda um e-mail com o link de recuperação,
 * que volta para o app em petlive://auth/nova-senha (tela de nova senha).
 */
export async function pedirNovaSenha(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: Linking.createURL('auth/nova-senha'),
  });
  if (error) throw error;
}

/**
 * Sessão de recuperação a partir do link: `?code=` (PKCE) ou tokens no `#`.
 * Devolve false quando o link não traz sessão (expirado ou já usado).
 */
export async function sessaoDoLinkDeRecuperacao(url: string): Promise<boolean> {
  const { queryParams } = Linking.parse(url);
  const code = queryParams?.code;
  if (typeof code === 'string') {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return !error;
  }
  const fragmento = new URLSearchParams(url.split('#')[1] ?? '');
  const access_token = fragmento.get('access_token');
  const refresh_token = fragmento.get('refresh_token');
  if (!access_token || !refresh_token) return false;
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  return !error;
}
