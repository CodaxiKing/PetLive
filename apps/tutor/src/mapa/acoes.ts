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
