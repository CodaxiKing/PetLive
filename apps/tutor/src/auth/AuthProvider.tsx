import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { atualizarPush, pushDisponivel, registroPush } from '../notificacoes/push';

type AuthState = {
  /** Sessão atual, null quando deslogado. */
  session: Session | null;
  user: User | null;
  /** true enquanto a sessão salva ainda está sendo carregada. */
  carregando: boolean;
  atualizarUsuario: () => Promise<User | null>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  carregando: true,
  atualizarUsuario: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);
  const tutorId = session?.user.id ?? null;

  useEffect(() => {
    void import('../widget/tarefaWidget').then((w) => w.atualizarWidget()).catch(() => undefined);
    return () => {
      void import('../widget/proximo').then((w) => w.limparCacheWidget(tutorId ?? undefined)).catch(() => undefined);
    };
  }, [tutorId]);

  useEffect(() => {
    void registroPush.definirConta(tutorId).catch(() => undefined);
    if (!tutorId || !pushDisponivel()) return;
    const estado = AppState.addEventListener('change', (novo) => {
      if (novo === 'active') atualizarPush();
    });
    const token = Notifications.addPushTokenListener(() => atualizarPush());
    // Retenta falhas temporárias e detecta permissão alterada sem reiniciar o app.
    const tentativa = setInterval(() => {
      if (AppState.currentState === 'active') atualizarPush();
    }, 60_000);
    return () => { estado.remove(); token.remove(); clearInterval(tentativa); };
  }, [tutorId]);

  useEffect(() => {
    // Restaura a sessão salva no primeiro carregamento.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCarregando(false);
    });

    // Mantém o estado em dia (login, logout, refresh do token).
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, novaSessao) => {
      setSession(novaSessao);
      setCarregando(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function atualizarUsuario() {
    const { data: atual } = await supabase.auth.getSession();
    if (!atual.session) return null;
    const { data, error } = await supabase.auth.getUser(atual.session.access_token);
    if (error) throw new Error('Não foi possível verificar a confirmação. Tente novamente.');
    const { data: depois } = await supabase.auth.getSession();
    if (depois.session?.user.id !== data.user.id) return null;
    setSession((s) => s?.user.id === data.user.id ? { ...s, user: data.user } : s);
    return data.user;
  }

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    carregando,
    atualizarUsuario,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
