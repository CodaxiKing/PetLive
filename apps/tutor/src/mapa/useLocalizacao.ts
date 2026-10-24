import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { comPrazo } from '../lib/prazo';

export type PermissaoLocalizacao = 'desconhecida' | 'concedida' | 'negada';

export type Posicao = { lat: number; lng: number };

/**
 * Permissão e posição atual (board: [APP-CLIENTE] "Mapa: Permissão e uso
 * da localização"). Em caso de negativa ou de serviços desligados, a
 * tela do mapa segue no centro padrão (Rio) e mostra o cartão de aviso.
 */
export function useLocalizacao() {
  const [permissao, setPermissao] = useState<PermissaoLocalizacao>('desconhecida');
  const [posicao, setPosicao] = useState<Posicao | null>(null);
  const [localizando, setLocalizando] = useState(true);

  const localizar = useCallback(() => {
    Location.requestForegroundPermissionsAsync()
      .then((resultado) => {
        setLocalizando(true);
        setPermissao(resultado.status === 'granted' ? 'concedida' : 'negada');
        if (resultado.status !== 'granted') return null;
        // GPS que não responde não pode deixar o mapa sem posição: espera
        // até 8 s e cai na última posição conhecida.
        return comPrazo(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          8000,
        ).then((posicao) => posicao ?? Location.getLastKnownPositionAsync());
      })
      .then((posicaoObtida) => {
        if (posicaoObtida) {
          setPosicao({ lat: posicaoObtida.coords.latitude, lng: posicaoObtida.coords.longitude });
        }
      })
      // Serviços de localização desligados: mapa segue no centro padrão.
      .catch(() => undefined)
      .finally(() => setLocalizando(false));
  }, []);

  useEffect(() => {
    localizar();
  }, [localizar]);

  return { permissao, posicao, localizar, localizando };
}
