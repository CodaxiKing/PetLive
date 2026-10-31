/**
 * Traduz um evento do RevenueCat para a assinatura do PetLive. Puro, para
 * testar sem rede. https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */
export type EventoRevenueCat = {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  store?: string;
  period_type?: string;
  original_transaction_id?: string | null;
  transaction_id?: string | null;
  purchased_at_ms?: number | null;
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number;
  price_in_purchased_currency?: number | null;
  currency?: string | null;
};

export type Assinatura = {
  tutor: string;
  provedor: 'google_play' | 'app_store';
  referencia: string;
  status: 'em_teste' | 'ativa' | 'pagamento_falhou' | 'cancelando' | 'expirada';
  inicio: string;
  fim: string;
  valorCentavos: number | null;
  eventoEm: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOJAS: Record<string, Assinatura['provedor']> = { PLAY_STORE: 'google_play', APP_STORE: 'app_store' };
const ATIVAM = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'SUBSCRIPTION_EXTENDED', 'TEMPORARY_ENTITLEMENT_GRANT']);

/** null quando o evento não muda a assinatura (teste do painel, loja desconhecida, usuário anônimo). */
export function traduzirEvento(e: EventoRevenueCat): Assinatura | null {
  const tipo = e.type ?? '';
  let status: Assinatura['status'];
  if (ATIVAM.has(tipo)) status = e.period_type === 'TRIAL' ? 'em_teste' : 'ativa';
  else if (tipo === 'CANCELLATION') status = 'cancelando';
  else if (tipo === 'BILLING_ISSUE') status = 'pagamento_falhou';
  else if (tipo === 'EXPIRATION') status = 'expirada';
  else return null;

  // O app entra no RevenueCat com o id da conta do PetLive; sem ele, não há a quem dar o Premium.
  const tutor = [e.app_user_id, e.original_app_user_id].find((id) => id && UUID.test(id));
  const provedor = LOJAS[e.store ?? ''];
  const referencia = e.original_transaction_id || e.transaction_id;
  if (!tutor || !provedor || !referencia || !e.expiration_at_ms) return null;

  const agora = e.event_timestamp_ms ?? Date.now();
  return {
    tutor,
    provedor,
    referencia,
    status,
    inicio: new Date(e.purchased_at_ms ?? agora).toISOString(),
    fim: new Date(e.expiration_at_ms).toISOString(),
    valorCentavos: e.currency === 'BRL' && typeof e.price_in_purchased_currency === 'number' ? Math.round(e.price_in_purchased_currency * 100) : null,
    eventoEm: new Date(agora).toISOString(),
  };
}
