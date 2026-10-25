import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export const MINIMO_SENHA = 8;

/** A conta tem senha própria (cadastro por e-mail), e não só Google ou Apple. */
export function temSenha(user: User | null | undefined): boolean {
  const provedores = user?.app_metadata?.providers;
  if (Array.isArray(provedores)) return provedores.includes('email');
  return user?.app_metadata?.provider === 'email';
}

/** Confere os campos antes de falar com o servidor; devolve a mensagem do problema ou null. */
export function validarTrocaSenha(atual: string, nova: string, confirmacao: string): string | null {
  if (!atual) return 'Digite a senha atual.';
  if (nova.length < MINIMO_SENHA) return `A senha nova precisa ter pelo menos ${MINIMO_SENHA} caracteres.`;
  if (nova !== confirmacao) return 'As duas senhas novas não são iguais.';
  if (nova === atual) return 'Use uma senha diferente da atual.';
  return null;
}

/**
 * Troca a senha de quem está logado: confirma a senha atual entrando de novo
 * com ela e só então grava a nova.
 */
export async function trocarSenha(email: string, atual: string, nova: string): Promise<void> {
  const { error: erroAtual } = await supabase.auth.signInWithPassword({ email, password: atual });
  if (erroAtual) {
    throw new Error(erroAtual.message.toLowerCase().includes('invalid') ? 'A senha atual não confere.' : 'Não deu para conferir a senha atual. Tente de novo.');
  }
  const { error } = await supabase.auth.updateUser({ password: nova });
  if (error) {
    throw new Error(error.message.includes('different from the old') ? 'Use uma senha diferente da atual.' : 'Não deu para salvar a senha nova. Tente de novo.');
  }
}
