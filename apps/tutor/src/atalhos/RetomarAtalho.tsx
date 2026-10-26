import { useEffect } from 'react';
import { router, useRootNavigationState } from 'expo-router';
import { useAuth } from '../auth/AuthProvider';
import { consumirAcao } from './acoes';
import { ouvirAtalhoIOS } from './nativoIOS';

/** A intenção vem do botão Entrar da tela de atalho; só retoma após login. */
export function RetomarAtalho() {
  const { user, carregando } = useAuth();
  const navegacao = useRootNavigationState();
  useEffect(() => {
    if (!navegacao?.key) return;
    return ouvirAtalhoIOS((acao) => router.push({ pathname: '/acao-rapida', params: { acao } }));
  }, [navegacao?.key]);
  useEffect(() => {
    if (carregando || !user || !navegacao?.key) return;
    const acao = consumirAcao();
    if (acao) router.push({ pathname: '/acao-rapida', params: { acao } });
  }, [user, carregando, navegacao?.key]);
  return null;
}
