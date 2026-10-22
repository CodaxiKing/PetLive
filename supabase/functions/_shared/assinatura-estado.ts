// PetLive: traduz o que a App Store e a Google Play devolvem para o estado da
// assinatura do PetLive (BUSINESS.md 20.4). Sem APIs do Deno: os testes rodam
// no Node (supabase/tests/assinatura-estado.test.mjs).

export type Loja = 'app_store' | 'google_play';
export type StatusAssinatura = 'em_teste' | 'ativa' | 'pagamento_falhou' | 'cancelando' | 'cancelada' | 'expirada';

/** O que vai para public.aplicar_assinatura_loja (sem o user_id). */
export type EstadoAssinatura = {
  loja: Loja;
  produto: string;
  periodo: 'mensal' | 'anual';
  referencia: string;
  status: StatusAssinatura;
  renova_auto: boolean;
  started_at: string | null;
  renews_at: string | null;
  trial_ends_at: string | null;
  cancel_at: string | null;
  ambiente: 'producao' | 'teste';
  /** Conta do PetLive gravada na compra (appAccountToken / obfuscatedAccountId). */
  conta: string | null;
  cobranca: { id: string; valor_centavos: number; pago_em: string } | null;
};

/** Ids dos produtos nas duas lojas (iguais na App Store e na Google Play). */
export const PRODUTOS = { mensal: 'petlive_premium_mensal', anual: 'petlive_premium_anual' } as const;

export function periodoDoProduto(produto: string): 'mensal' | 'anual' {
  return produto === PRODUTOS.anual ? 'anual' : 'mensal';
}

const data = (ms: number | null | undefined) => (typeof ms === 'number' && ms > 0 ? new Date(ms).toISOString() : null);

/** Valor em centavos só quando a moeda é real (o faturamento do admin é em R$). */
function centavos(valor: number | null | undefined, moeda: string | null | undefined, divisor: number): number {
  if (moeda !== 'BRL' || typeof valor !== 'number' || valor <= 0) return 0;
  return Math.round(valor / divisor);
}

// ------------------------------------------------------------------
// App Store (App Store Server API: Get All Subscription Statuses)
// ------------------------------------------------------------------

/** Campos usados do JWSTransactionDecodedPayload. */
export type TransacaoApple = {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  purchaseDate?: number;
  originalPurchaseDate?: number;
  expiresDate?: number;
  revocationDate?: number;
  offerType?: number;
  offerDiscountType?: string;
  appAccountToken?: string;
  environment?: string;
  price?: number;
  currency?: string;
};

/** Campos usados do JWSRenewalInfoDecodedPayload. */
export type RenovacaoApple = {
  autoRenewStatus?: number;
  gracePeriodExpiresDate?: number;
  isInBillingRetryPeriod?: boolean;
};

/**
 * Status da Apple: 1 ativa, 2 expirada, 3 em nova tentativa de cobrança,
 * 4 em carência de cobrança, 5 revogada (reembolso ou Compartilhamento Familiar).
 */
export function estadoApple(statusApple: number, t: TransacaoApple, r: RenovacaoApple | null): EstadoAssinatura {
  const renova = (r?.autoRenewStatus ?? 1) === 1;
  const teste = t.offerType === 1 && t.offerDiscountType === 'FREE_TRIAL';
  let status: StatusAssinatura;
  let fim = t.expiresDate ?? null;

  if (statusApple === 5 || t.revocationDate) {
    status = 'cancelada';
    fim = t.revocationDate ?? fim;
  } else if (statusApple === 2) {
    status = renova ? 'expirada' : 'cancelada';
  } else if (statusApple === 3) {
    status = 'pagamento_falhou';
  } else if (statusApple === 4) {
    status = 'pagamento_falhou';
    fim = r?.gracePeriodExpiresDate ?? fim;
  } else {
    status = !renova ? 'cancelando' : teste ? 'em_teste' : 'ativa';
  }

  const valor = centavos(t.price, t.currency, 10); // price vem em milésimos da moeda
  return {
    loja: 'app_store',
    produto: t.productId,
    periodo: periodoDoProduto(t.productId),
    referencia: t.originalTransactionId,
    status,
    renova_auto: renova,
    started_at: data(t.originalPurchaseDate ?? t.purchaseDate),
    renews_at: data(fim),
    trial_ends_at: teste ? data(t.expiresDate) : null,
    cancel_at: status === 'cancelando' || status === 'cancelada' ? new Date().toISOString() : null,
    ambiente: t.environment === 'Sandbox' || t.environment === 'Xcode' ? 'teste' : 'producao',
    conta: t.appAccountToken ? t.appAccountToken.toLowerCase() : null,
    cobranca: valor > 0 ? { id: t.transactionId, valor_centavos: valor, pago_em: data(t.purchaseDate) ?? new Date().toISOString() } : null,
  };
}

// ------------------------------------------------------------------
// Google Play (purchases.subscriptionsv2.get)
// ------------------------------------------------------------------

export type AssinaturaGoogle = {
  subscriptionState?: string;
  startTime?: string;
  testPurchase?: Record<string, unknown> | null;
  latestOrderId?: string;
  acknowledgementState?: string;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
  canceledStateContext?: Record<string, unknown> | null;
  lineItems?: {
    productId: string;
    expiryTime?: string;
    latestSuccessfulOrderId?: string;
    autoRenewingPlan?: { autoRenewEnabled?: boolean } | null;
    offerDetails?: { basePlanId?: string; offerId?: string } | null;
    offerPhase?: { freeTrial?: Record<string, unknown> } | null;
  }[];
};

/** Preço pago da última cobrança, quando a consulta do pedido devolveu (em centavos). */
export function estadoGoogle(
  token: string,
  g: AssinaturaGoogle,
  valorCentavos = 0,
): EstadoAssinatura {
  const item = g.lineItems?.[0];
  const produto = item?.productId ?? PRODUTOS.mensal;
  const renova = item?.autoRenewingPlan?.autoRenewEnabled ?? false;
  const teste = Boolean(item?.offerPhase?.freeTrial) || /teste|trial/i.test(item?.offerDetails?.offerId ?? '');

  let status: StatusAssinatura;
  switch (g.subscriptionState) {
    case 'SUBSCRIPTION_STATE_ACTIVE':
      status = teste ? 'em_teste' : 'ativa';
      break;
    case 'SUBSCRIPTION_STATE_CANCELED':
      // Cancelada pelo tutor: o Premium vale até o fim do período pago.
      status = 'cancelando';
      break;
    case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD':
    case 'SUBSCRIPTION_STATE_ON_HOLD':
      // Na carência a expiryTime já inclui os dias extras; em espera ela já passou.
      status = 'pagamento_falhou';
      break;
    case 'SUBSCRIPTION_STATE_EXPIRED':
      status = g.canceledStateContext ? 'cancelada' : 'expirada';
      break;
    default:
      // Pendente (boleto, aprovação) ou pausada: ainda não dá Premium.
      status = 'expirada';
  }

  const pedido = item?.latestSuccessfulOrderId ?? g.latestOrderId ?? null;
  return {
    loja: 'google_play',
    produto,
    periodo: periodoDoProduto(produto),
    referencia: token,
    status,
    renova_auto: renova,
    started_at: g.startTime ?? null,
    renews_at: item?.expiryTime ?? null,
    trial_ends_at: teste ? item?.expiryTime ?? null : null,
    cancel_at: status === 'cancelando' || status === 'cancelada' ? new Date().toISOString() : null,
    ambiente: g.testPurchase ? 'teste' : 'producao',
    conta: g.externalAccountIdentifiers?.obfuscatedExternalAccountId?.toLowerCase() ?? null,
    cobranca: pedido && valorCentavos > 0 && !teste ? { id: pedido, valor_centavos: valorCentavos, pago_em: new Date().toISOString() } : null,
  };
}

/** Preço do pedido da Google Play (Money: units + nanos) em centavos de real. */
export function centavosGoogle(total: { currencyCode?: string; units?: string; nanos?: number } | null | undefined): number {
  if (!total || total.currencyCode !== 'BRL') return 0;
  return Number(total.units ?? 0) * 100 + Math.round((total.nanos ?? 0) / 1e7);
}

/** A compra é desta conta? Sem a conta gravada na loja, quem decide é o banco (uma assinatura, um dono). */
export function contaConfere(estado: EstadoAssinatura, userId: string): boolean {
  return estado.conta === null || estado.conta === userId.toLowerCase();
}

/** Lê o payload de um JWS da Apple sem conferir a assinatura (só para o que veio da API da Apple). */
export function payloadJws<T>(jws: string): T {
  const parte = jws.split('.')[1] ?? '';
  const base64 = parte.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parte.length / 4) * 4, '=');
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)))) as T;
}
