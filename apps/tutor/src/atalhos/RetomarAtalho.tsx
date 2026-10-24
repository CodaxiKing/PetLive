import { useEffect } from 'react';
import { router, useRootNavigationState } from 'expo-router';
import { useAuth } from '../auth/AuthProvider';
import { consumirAcao } from './acoes';

/** A intenção vem do botão Entrar da tela de atalho; só retoma após login. */
export function RetomarAtalho() {
  const { user, carregando } = useAuth();
  const navegacao = useRootNavigationState();
  useEffect(() => {
    if (carregando || !user || !navegacao?.key) return;
    const acao = consumirAcao();
    if (acao) router.push({ pathname: '/acao-rapida', params: { acao } });
  }, [user, carregando, navegacao?.key]);
  return null;
}
