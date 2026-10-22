"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente do Supabase do painel admin. A sessão fica só no navegador de quem
 * entrou; os dados vêm das funções admin_* do banco, que exigem o papel e o
 * segundo fator (aal2). Criado na primeira chamada (o build não tem window).
 */
let cliente: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (!cliente) {
    cliente = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", {
      auth: { storageKey: "petlive-admin", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
  return cliente;
}

export const painelConfigurado = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export type Papel = "super" | "financeiro" | "suporte" | "moderacao" | "marketing" | "leitura";

export type AdminEu =
  | { admin: false }
  | { admin: true; papel: Papel; verificado: boolean; nome: string; email: string };

export const ROTULO_PAPEL: Record<Papel, string> = {
  super: "Super admin",
  financeiro: "Financeiro",
  suporte: "Suporte",
  moderacao: "Moderação",
  marketing: "Marketing",
  leitura: "Só leitura",
};

/** Chama uma função admin_* e devolve o resultado (ou lança a mensagem do banco). */
export async function rpcAdmin<T>(nome: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabaseAdmin().rpc(nome, args);
  if (error) throw new Error(error.message);
  return data as T;
}
