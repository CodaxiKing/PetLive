import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

/**
 * Cidade do tutor para o Início ("Rio de Janeiro"). Não pede permissão:
 * só lê se já foi dada (tela Permissões); sem ela, fica a cidade padrão.
 */
export function useCidade(padrao = 'Rio de Janeiro'): string {
  const [cidade, setCidade] = useState(padrao);

  useEffect(() => {
    let vivo = true;
    Location.getForegroundPermissionsAsync()
      .then(async ({ granted }) => {
        if (!granted) return;
        const posicao = await Location.getLastKnownPositionAsync();
        if (!posicao) return;
        const [endereco] = await Location.reverseGeocodeAsync(posicao.coords);
        const nome = endereco?.city ?? endereco?.subregion;
        if (vivo && nome) setCidade(nome);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  return cidade;
}
