"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export const lojistaConfigurado = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
let cliente: SupabaseClient | null = null;
export function supabaseLojista(): SupabaseClient {
  if (!lojistaConfigurado) throw new Error("O painel da loja ainda não está configurado neste ambiente.");
  return cliente ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { storageKey: "petlive-lojista", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
}
