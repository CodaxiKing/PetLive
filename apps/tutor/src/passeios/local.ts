import AsyncStorage from '@react-native-async-storage/async-storage';
import { RepositorioPasseios } from './repositorio';
import { RepositorioMetaPasseios } from './meta';

export function repositorioPasseiosLocal(tutorId: string) {
  return new RepositorioPasseios(tutorId, AsyncStorage);
}

export function repositorioMetaPasseiosLocal(tutorId: string) {
  return new RepositorioMetaPasseios(tutorId, AsyncStorage);
}
