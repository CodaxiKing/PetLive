import * as Location from 'expo-location';

type Ponto = { lat: number; lng: number };

/**
 * Endereço ou bairro digitado -> ponto no mapa. Primeiro o geocodificador do
 * aparelho; no Android ele exige a permissão de localização, então sem ela
 * (ou se ele falhar) usa o Nominatim do OpenStreetMap, grátis e sem chave
 * (política de uso: poucas buscas, identificadas). Prefere resultados perto
 * de `perto` e fica no Brasil.
 */
export async function acharEndereco(texto: string, perto?: Ponto | null): Promise<Ponto | null> {
  const termo = texto.trim();
  if (!termo) return null;

  try {
    const [achado] = await Location.geocodeAsync(`${termo}, Brasil`);
    if (achado) return { lat: achado.latitude, lng: achado.longitude };
  } catch {
    // Sem permissão ou sem geocodificador no aparelho: segue para o Nominatim.
  }

  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'br',
    'accept-language': 'pt-BR',
    q: termo,
  });
  if (perto) {
    // Caixa de ~50 km em volta do ponto: prefere, mas não exige (bounded=0).
    params.set('viewbox', [perto.lng - 0.5, perto.lat + 0.5, perto.lng + 0.5, perto.lat - 0.5].join(','));
    params.set('bounded', '0');
  }
  try {
    const resposta = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': 'PetLive/1.0 (contato@petlive.app)' },
    });
    if (!resposta.ok) return null;
    const [primeiro] = (await resposta.json()) as { lat: string; lon: string }[];
    return primeiro ? { lat: Number(primeiro.lat), lng: Number(primeiro.lon) } : null;
  } catch {
    return null;
  }
}
