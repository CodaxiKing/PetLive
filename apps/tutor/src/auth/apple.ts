import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { supabase } from '../lib/supabase';

/**
 * Entrar com Apple (App Store, diretriz 4.8: app com login do Google precisa
 * oferecer o da Apple). Só no iPhone: o login nativo devolve um token, que o
 * Supabase troca por sessão (signInWithIdToken). O nonce vai em SHA-256 para
 * a Apple e cru para o Supabase, que confere os dois.
 */
export async function appleDisponivel(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

/** Devolve false quando o tutor cancela a janela da Apple. */
export async function entrarComApple(): Promise<boolean> {
  const nonce = Crypto.randomUUID();
  const nonceHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);

  let credencial: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credencial = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: nonceHash,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
    throw e;
  }
  if (!credencial.identityToken) throw new Error('A Apple não devolveu o login. Tente de novo.');

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credencial.identityToken,
    nonce,
  });
  if (error) throw error;

  // A Apple só manda o nome no primeiro login: guarda agora ou nunca.
  const nome = [credencial.fullName?.givenName, credencial.fullName?.familyName].filter(Boolean).join(' ').trim();
  if (nome && data.user) {
    await supabase.auth.updateUser({ data: { nome, full_name: nome } }).catch(() => undefined);
    await supabase.from('profiles').update({ nome }).eq('id', data.user.id).is('nome', null);
  }
  return true;
}
