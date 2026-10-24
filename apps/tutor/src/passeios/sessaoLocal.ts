import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { GravadorPasseio } from './gravador';
import { gpsPasseio } from './gps';
import { repositorioPasseiosLocal } from './local';
import { FotosPasseioLocal } from './fotos';

// Telas duplicadas da mesma conta compartilham fila de escrita e observador.
const sessoes = new Map<string, GravadorPasseio>();
export function gravadorPasseioLocal(tutorId: string) {
  let sessao = sessoes.get(tutorId);
  if (!sessao) {
    sessao = new GravadorPasseio(repositorioPasseiosLocal(tutorId), gpsPasseio, Date.now, Crypto.randomUUID, Platform.OS === 'web' ? undefined : new FotosPasseioLocal(tutorId));
    sessoes.set(tutorId, sessao);
  }
  return sessao;
}
