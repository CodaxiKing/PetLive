import { Linking, Platform } from 'react-native';

/** "tel:" quer só dígitos com o + inicial. */
function paraChamada(telefone: string): string {
  return telefone.replace(/[^\d+]/g, '');
}

/**
 * wa.me quer dígitos com DDI. Números brasileiros locais ganham o 55;
 * os que já vêm com +55 (12+ dígitos) vão como estão.
 */
function paraWhatsApp(telefone: string): string {
  const digitos = telefone.replace(/\D/g, '');
  if (digitos.startsWith('55') && digitos.length >= 12) return digitos;
  return `55${digitos}`;
}

export async function ligarPara(telefone: string): Promise<void> {
  await Linking.openURL(`tel:${paraChamada(telefone)}`).catch(() => undefined);
}

export async function abrirWhatsApp(telefone: string): Promise<void> {
  const numero = paraWhatsApp(telefone);
  try {
    // App instalado: deep link direto na conversa.
    await Linking.openURL(`whatsapp://send?phone=${numero}`);
  } catch {
    // Sem WhatsApp: cai para a web (wa.me sempre abre).
    await Linking.openURL(`https://wa.me/${numero}`).catch(() => undefined);
  }
}

/** Destino da rota: coordenadas e, quando vier do Google, o place_id. */
export type DestinoRota = { lat: number; lng: number; nome: string; placeId?: string | null };

export type AppMapa = 'google' | 'waze' | 'apple' | 'navegador';

export const NOME_APP_MAPA: Record<AppMapa, string> = {
  google: 'Google Maps',
  waze: 'Waze',
  apple: 'Apple Maps',
  navegador: 'Abrir no navegador',
};

/** Rota do Google Maps no site: abre em qualquer aparelho, sem instalar nada. */
function rotaNoSite(destino: DestinoRota): string {
  const ponto = `${destino.lat},${destino.lng}`;
  const lugar = destino.placeId ? `&destination_place_id=${encodeURIComponent(destino.placeId)}` : '';
  return `https://www.google.com/maps/dir/?api=1&destination=${ponto}${lugar}`;
}

function enderecoNoApp(app: AppMapa, destino: DestinoRota): string {
  const ponto = `${destino.lat},${destino.lng}`;
  switch (app) {
    case 'google':
      return Platform.OS === 'ios' ? `comgooglemaps://?daddr=${ponto}&directionsmode=driving` : `google.navigation:q=${ponto}`;
    case 'waze':
      return `waze://?ll=${ponto}&navigate=yes`;
    case 'apple':
      return `maps://?daddr=${ponto}`;
    case 'navegador':
      return rotaNoSite(destino);
  }
}

/** Endereço que só abre se o app estiver instalado (consultado antes da folha). */
const TESTE_INSTALADO: Partial<Record<AppMapa, string>> = {
  google: Platform.OS === 'ios' ? 'comgooglemaps://' : 'google.navigation:q=0,0',
  waze: 'waze://',
  apple: Platform.OS === 'ios' ? 'maps://' : undefined,
};

/**
 * Apps de mapa instalados no aparelho (BUSINESS.md 5.15): Google Maps e
 * Waze, e Apple Maps no iPhone. Precisa das consultas declaradas no app
 * (plugin apps-de-mapa); sem nenhum, a folha oferece só o navegador.
 */
export async function appsDeMapaInstalados(): Promise<AppMapa[]> {
  const candidatos: AppMapa[] = Platform.OS === 'ios' ? ['google', 'waze', 'apple'] : ['google', 'waze'];
  const instalados = await Promise.all(
    candidatos.map(async (app) => {
      const teste = TESTE_INSTALADO[app];
      if (!teste) return null;
      return (await Linking.canOpenURL(teste).catch(() => false)) ? app : null;
    }),
  );
  return instalados.filter((app): app is AppMapa => app !== null);
}

/** Abre a rota no app escolhido; se falhar, cai para o site do Google Maps. */
export async function abrirRota(app: AppMapa, destino: DestinoRota): Promise<void> {
  try {
    await Linking.openURL(enderecoNoApp(app, destino));
  } catch {
    await Linking.openURL(rotaNoSite(destino)).catch(() => undefined);
  }
}

/** Abre o app de mapas com a rota até o lugar (Android geo: / iOS Apple Maps). */
export async function tracarRota(lugar: { lat: number; lng: number; nome: string }): Promise<void> {
  const destino = `${lugar.lat},${lugar.lng}`;
  const preferido =
    Platform.OS === 'android'
      ? `geo:${destino}?q=${destino}(${encodeURIComponent(lugar.nome)})`
      : `http://maps.apple.com/?daddr=${destino}`;
  try {
    await Linking.openURL(preferido);
  } catch {
    // Sem app de mapas nativo: rota pelo Google Maps no navegador.
    await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destino}`).catch(
      () => undefined,
    );
  }
}
