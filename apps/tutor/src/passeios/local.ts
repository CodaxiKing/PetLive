import AsyncStorage from '@react-native-async-storage/async-storage';
import { RepositorioPasseios } from './repositorio';

export function repositorioPasseiosLocal(tutorId: string) {
  return new RepositorioPasseios(tutorId, AsyncStorage);
}
