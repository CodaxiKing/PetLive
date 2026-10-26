import { supabase } from '../lib/supabase'

/** Confere a conta esperada sem substituir a sessão aberta no app. */
export async function conferirContaPet(tutor: string) {
  const { data, error } = await supabase.auth.getSession()
  if (error || !tutor || data.session?.user.id !== tutor) throw new Error('A conta mudou. Entre novamente para continuar.')
  return data.session
}
