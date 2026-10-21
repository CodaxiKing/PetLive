import { Redirect } from 'expo-router';

/**
 * Destino do retorno do login com Google (petlive://auth/callback). No
 * Android o retorno também abre esta rota; a sessão já foi criada por
 * src/auth/google.ts, então só volta para a raiz, que decide o caminho.
 */
export default function RetornoLogin() {
  return <Redirect href="/" />;
}
