import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';

/**
 * Rota raiz: manda para as boas-vindas quando não há sessão e para o
 * Início quando já há. O grupo certo também é protegido pelo layout raiz.
 */
export default function Index() {
  const { session, carregando } = useAuth();

  if (carregando) return null;

  return <Redirect href={session ? '/inicio' : '/welcome'} />;
}
