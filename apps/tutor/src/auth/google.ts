import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';

/**
 * Entrar com Google (board P0 "Telas Criar conta e Entrar (e-mail e
 * Google)"). No celular o `signInWithOAuth` só devolve a URL: o app abre a
 * sessão de login no navegador do sistema, recebe o retorno em
 * petlive://auth/callback e cria a sessão a partir dele.
 *
 * Devolve false quando o tutor fecha o navegador sem entrar.
 */
export async function entrarComGoogle(): Promise<boolean> {
  const redirectTo = Linking.createURL('auth/callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const resultado = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (resultado.type !== 'success') return false;

  await criarSessaoDoRetorno(resultado.url);
  return true;
}

/** Retorno do Supabase: `?code=` (PKCE) ou tokens no `#` (fluxo implícito). */
async function criarSessaoDoRetorno(url: string): Promise<void> {
  const { queryParams } = Linking.parse(url);
  const erro = queryParams?.error_description ?? queryParams?.error;
  if (typeof erro === 'string') throw new Error(erro);

  const code = queryParams?.code;
  if (typeof code === 'string') {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  const fragmento = new URLSearchParams(url.split('#')[1] ?? '');
  const access_token = fragmento.get('access_token');
  const refresh_token = fragmento.get('refresh_token');
  if (!access_token || !refresh_token) throw new Error('Login com Google não retornou a sessão.');

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}
