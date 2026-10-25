/** Notificações só navegam para caminhos internos, nunca URLs externas. */
export function destinoNotificacao(dados: Record<string, unknown>): string | null {
  const url = dados.url;
  if (typeof url !== 'string' || url.length > 500 ||
      !/^\/[a-zA-Z0-9_/-]+$/.test(url) || url.startsWith('//') || url.includes('//')) return null;
  return url;
}
