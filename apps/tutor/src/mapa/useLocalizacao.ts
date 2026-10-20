import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

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

  const localizar = useCallback(() => {
    Location.requestForegroundPermissionsAsync()
      .then((resultado) => {
        setPermissao(resultado.status === 'granted' ? 'concedida' : 'negada');
        if (resultado.status !== 'granted') return null;
        return Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      })
      .then((posicaoObtida) => {
        if (posicaoObtida) {
          setPosicao({ lat: posicaoObtida.coords.latitude, lng: posicaoObtida.coords.longitude });
        }
      })
      // Serviços de localização desligados: mapa segue no centro padrão.
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    localizar();
  }, [localizar]);

  return { permissao, posicao, localizar };
}
