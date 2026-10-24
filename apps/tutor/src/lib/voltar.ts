import { router } from 'expo-router';

/** Atalhos e links podem abrir uma tela sem nenhuma entrada anterior. */
export function voltarOuInicio() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
