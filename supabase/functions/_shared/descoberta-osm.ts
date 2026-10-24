/** Conversão dos dados públicos; nenhuma informação de conta é enviada ao provedor. */
export type ElementoOSM = {
  type: string; id: number; lat?: number; lon?: number;
  center?: { lat: number; lon: number }; tags?: Record<string, string>;
};

export function validarRegiao(corpo: { lat?: unknown; lng?: unknown; raioKm?: unknown }) {
  const { lat, lng } = corpo;
  const raioKm = corpo.raioKm ?? 3;
  if (typeof lat !== 'number' || !Number.isFinite(lat) || Math.abs(lat) > 90 ||
    typeof lng !== 'number' || !Number.isFinite(lng) || Math.abs(lng) > 180 ||
    typeof raioKm !== 'number' || !Number.isFinite(raioKm) || raioKm < 1 || raioKm > 10) {
    throw new Error('Região inválida. Use um raio entre 1 e 10 km.');
  }
  // Consulta uma região aproximada, compartilhada entre pessoas próximas.
  const centro = { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 };
  return { ...centro, raioKm: Math.ceil(raioKm), chave: `${centro.lat}:${centro.lng}:${Math.ceil(raioKm)}` };
}

export function consultaOSM(regiao: { lat: number; lng: number; raioKm: number }) {
  const perto = `(around:${(regiao.raioKm + 1) * 1000},${regiao.lat},${regiao.lng})`;
  return `[out:json][timeout:18];(nwr[amenity=veterinary]${perto};nwr[shop~"^(pet|pet_grooming)$"]${perto};nwr[amenity~"^(animal_boarding|animal_training)$"]${perto};nwr[leisure=dog_park]${perto};nwr[leisure=park][dog~"^(yes|leashed)$"]${perto};nwr[natural=beach][dog~"^(yes|leashed)$"]${perto};nwr[amenity~"^(restaurant|cafe)$"][dog~"^(yes|leashed)$"]${perto};nwr[tourism~"^(hotel|guest_house|camp_site)$"][dog~"^(yes|leashed)$"]${perto};);out center tags 1000;`;
}

export function converterOSM(elementos: ElementoOSM[]) {
  const vistos = new Set<string>();
  return elementos.flatMap((el) => {
    const t = el.tags ?? {};
    const nome = (t.name || t['name:pt'] || '').trim();
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    const fonte_id = `${el.type}/${el.id}`;
    if (!['node', 'way', 'relation'].includes(el.type) || !Number.isSafeInteger(el.id) || !nome ||
      typeof lat !== 'number' || !Number.isFinite(lat) || Math.abs(lat) > 90 ||
      typeof lng !== 'number' || !Number.isFinite(lng) || Math.abs(lng) > 180 || vistos.has(fonte_id)) return [];
    const aceitaCaes = ['yes', 'leashed'].includes(t.dog);
    const categoria = t.amenity === 'veterinary' ? 'clinica' : t.shop === 'pet_grooming' ? 'banho_tosa'
      : t.shop === 'pet' ? 'petshop' : t.amenity === 'animal_boarding' ? (/creche/i.test(nome) ? 'creche' : 'hotelzinho')
      : t.leisure === 'dog_park' || (t.leisure === 'park' && aceitaCaes) ? 'parque'
      : t.natural === 'beach' && aceitaCaes ? 'praia' : ['restaurant', 'cafe'].includes(t.amenity) && aceitaCaes ? 'restaurante'
      : ['hotel', 'guest_house', 'camp_site'].includes(t.tourism) && aceitaCaes ? 'hotel' : null;
    if (!categoria) return [];
    vistos.add(fonte_id);
    return [{ fonte: 'osm', fonte_id, osm_type: el.type, osm_id: el.id, nome: nome.slice(0, 250), categoria, lat, lng,
      endereco: t['addr:full'] || [t['addr:street'], t['addr:housenumber'], t['addr:suburb'], t['addr:city']].filter(Boolean).join(', ') || null,
      telefone: t.phone || t['contact:phone'] || t.mobile || null,
      website: t.website || t['contact:website'] || null, horario: t.opening_hours || null,
      aberto_24h: t.opening_hours === '24/7', aceita_caes: aceitaCaes ? true : null, area_caes: t.leisure === 'dog_park' }];
  });
}
