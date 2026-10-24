import { AppState } from 'react-native';
import * as Location from 'expo-location';
import type { GpsPasseio } from './gravador';

export const gpsPasseio: GpsPasseio = {
  async observar(ponto, erro) {
    const permissao = await Location.requestForegroundPermissionsAsync();
    if (!permissao.granted) throw new Error('Autorize a localização nas configurações do aparelho para gravar o passeio.');
    if (permissao.android?.accuracy === 'coarse') throw new Error('Ative a localização precisa nas configurações do aparelho para gravar o trajeto.');
    if (!await Location.hasServicesEnabledAsync()) throw new Error('Ative o GPS do aparelho e tente novamente.');
    if (AppState.currentState !== 'active') throw new Error('Volte ao app para iniciar ou retomar o passeio.');
    const assinatura = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 3 },
      (p) => ponto({ lat: p.coords.latitude, lng: p.coords.longitude, instante: p.timestamp, precisao: p.coords.accuracy ?? Infinity }),
      () => erro('O GPS foi interrompido. O passeio foi pausado; confira a localização e retome.'),
    );
    return () => assinatura.remove();
  },
};
