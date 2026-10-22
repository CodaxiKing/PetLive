import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { fetchComCache } from './cacheOffline';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Erro claro quando o `.env` ainda não foi preenchido.
 * O app roda sem backend, mas avisamos no console em vez de falhar mudo.
 */
export const supabaseConfigurado = Boolean(supabaseUrl && supabaseAnonKey);

if (!supabaseConfigurado) {
  console.warn(
    '[PetLive] Supabase não configurado. Copie apps/tutor/.env.example para ' +
      'apps/tutor/.env e preencha EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.',
  );
}

/**
 * Criado mesmo sem chaves para que a tela de login possa ser aberta e
 * mostrar o aviso de configuração, em vez de quebrar com null.
 */
export const urlSupabase = supabaseUrl ?? 'https://invalid.supabase.co';
export const chaveAnonSupabase = supabaseAnonKey ?? 'anon-placeholder';

export const supabase = createClient(urlSupabase, chaveAnonSupabase, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  // Leituras de saúde do pet guardadas no aparelho para abrir sem internet.
  global: { fetch: fetchComCache },
});
