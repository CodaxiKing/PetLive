import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState, Platform } from 'react-native';
import type { GpsPasseio } from './gravador';

export const TAREFA_PASSEIO = 'petlive-passeio-gps-v1';
type Recebedor = { ponto: Parameters<GpsPasseio['observar']>[0]; erro: Parameters<GpsPasseio['observar']>[1] };
let recebedor: Recebedor | null = null;
let fila: Promise<unknown> = Promise.resolve();
function transporte<T>(acao: () => Promise<T>): Promise<T> {
  const proxima = fila.then(acao);
  fila = proxima.catch(() => undefined);
  return proxima;
}
async function pararNativo() {
  if (await Location.hasStartedLocationUpdatesAsync(TAREFA_PASSEIO)) {
    await Location.stopLocationUpdatesAsync(TAREFA_PASSEIO);
  }
}
export const passeioSegundoPlanoDisponivel = () => Platform.OS === 'android' &&
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient &&
  Constants.expoConfig?.extra?.passeioSegundoPlano === true;

// Escopo global: o Android encontra a tarefa mesmo sem uma tela montada.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TAREFA_PASSEIO, async ({ data, error }) => {
  const destino = recebedor;
  if (!destino) {
    // Processo reiniciado: não retoma conta/sessão antiga implicitamente.
    await transporte(pararNativo);
    return;
  }
  if (error || !Array.isArray(data?.locations)) {
    await destino.erro('O GPS em segundo plano foi interrompido. Confira as permissões e retome o passeio.');
    return;
  }
  for (const p of [...data.locations].sort((a, b) => a.timestamp - b.timestamp)) {
    if (recebedor !== destino) break;
    // Aguarda a escrita antes de informar ao sistema que o lote terminou.
    await destino.ponto({ lat: p.coords.latitude, lng: p.coords.longitude,
      instante: p.timestamp, precisao: p.coords.accuracy ?? Infinity });
  }
});

export const gpsSegundoPlano: GpsPasseio = {
  async observar(ponto, erro) {
    if (!passeioSegundoPlanoDisponivel()) throw new Error('Instale a versão Android com suporte a passeio com tela apagada.');
    if (AppState.currentState !== 'active') throw new Error('Volte ao app para iniciar ou retomar o passeio.');
    const primeiro = await Location.requestForegroundPermissionsAsync();
    if (!primeiro.granted) throw new Error('Autorize a localização para gravar o passeio.');
    if (primeiro.android?.accuracy !== 'fine') throw new Error('Ative a localização precisa para gravar o trajeto.');
    if (!await Location.hasServicesEnabledAsync()) throw new Error('Ative o GPS do aparelho e tente novamente.');
    const fundo = await Location.requestBackgroundPermissionsAsync();
    if (!fundo.granted) throw new Error('Para gravar com a tela apagada, permita a localização o tempo todo. Você também pode usar o modo com a tela aberta.');
    if (!await TaskManager.isAvailableAsync()) throw new Error('A gravação em segundo plano não está disponível neste aparelho.');
    if (AppState.currentState !== 'active') throw new Error('Volte ao app depois de autorizar e toque em iniciar novamente.');
    if (recebedor) throw new Error('Pause o passeio em andamento antes de iniciar outro.');
    const destino = { ponto, erro };
    recebedor = destino;
    try {
      await transporte(async () => {
        await pararNativo();
        await Location.startLocationUpdatesAsync(TAREFA_PASSEIO, {
          accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 3,
          deferredUpdatesInterval: 0,
          foregroundService: { notificationTitle: 'PetLive · passeio em andamento',
            notificationBody: 'Gravando seu trajeto. Abra o PetLive para pausar ou finalizar.',
            notificationColor: '#9AD6F8', killServiceOnDestroy: true },
        });
      });
    } catch (e) {
      if (recebedor === destino) recebedor = null;
      await transporte(pararNativo).catch(() => undefined);
      throw e;
    }
    return async () => {
      if (recebedor === destino) recebedor = null;
      // Uma remoção antiga não pode desligar a assinatura de outra conta/sessão.
      await transporte(async () => { if (!recebedor) await pararNativo(); });
    };
  },
};
