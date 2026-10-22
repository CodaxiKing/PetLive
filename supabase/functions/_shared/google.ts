// PetLive: utilitários para Google Play Real-time Developer Notifications (RTDN).
// BUSINESS.md 23.1, 23.4: validação de token OAuth2/JWT do Google.
// Recebe mensagens Pub/Sub (base64), decodifica, processa.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import * as jose from 'npm:jose@5';

// Tipos de notificação Google Play (RTDN).
export type GoogleNotificationType =
  | 'SUBSCRIPTION_PURCHASED'
  | 'SUBSCRIPTION_RENEWED'
  | 'SUBSCRIPTION_CANCELED'
  | 'SUBSCRIPTION_ON_HOLD'           // account hold
  | 'SUBSCRIPTION_IN_GRACE_PERIOD'
  | 'SUBSCRIPTION_RESTARTED'
  | 'SUBSCRIPTION_PRICE_CHANGE_CONFIRMED'
  | 'SUBSCRIPTION_DEFERRED'
  | 'SUBSCRIPTION_PAUSED'
  | 'SUBSCRIPTION_REVOKED'
  | 'SUBSCRIPTION_EXPIRED'
  | 'ONE_TIME_PRODUCT_PURCHASED'
  | 'TEST_NOTIFICATION';

export interface GooglePubSubMessage {
  message: {
    data: string;           // base64 encoded
    messageId: string;
    publishTime: string;
    attributes?: Record<string, string>;
  };
  subscription: string;
}

export interface GoogleSubscriptionNotification {
  version: string;
  packageName: string;
  eventTimeMillis: string;
  subscriptionNotification: {
    notificationType: number; // 1=PURCHASED, 2=RENEWED, 3=CANCELED, etc.
    purchaseToken: string;
    subscriptionId: string;
  };
  testNotification?: { version: string };
}

export interface GoogleVoidedPurchaseNotification {
  version: string;
  packageName: string;
  eventTimeMillis: string;
  voidedPurchaseNotification: {
    purchaseToken: string;
    orderId: string;
    productType: number;
    voidedTimeMillis: string;
    voidedReason: number;
    voidedSource: number;
  };
}

export interface GooglePurchase {
  kind: 'androidpublisher#subscriptionPurchase';
  startTimeMillis: string;
  expiryTimeMillis: string;
  autoRenewing: boolean;
  priceCurrencyCode: string;
  priceAmountMicros: string;
  countryCode: string;
  developerPayload: string;
  paymentState: number; // 0=pending, 1=received, 2=free_trial, 3=grace_period, 4=account_hold
  orderId: string;
  purchaseType: number; // 0=test, 1=promo, etc.
  acknowledgementState: number; // 0=not_acknowledged, 1=acknowledged
  purchaseToken: string;
  productId: string;
  obfuscatedExternalAccountId: string; // obfuscated_account_id do app
  profileId?: string;
  profileName?: string;
  emailAddress?: string;
  familyName?: string;
  givenName?: string;
  linkedPurchaseToken?: string;
  subscriptionState?: number; // 2=active, 3=grace_period, 4=account_hold, 5=paused, 6=revoked, 7=expired
}

/** Mapeia notificationType numérico para string. */
export function mapGoogleNotificationType(num: number): GoogleNotificationType {
  const map: Record<number, GoogleNotificationType> = {
    1: 'SUBSCRIPTION_PURCHASED',
    2: 'SUBSCRIPTION_RENEWED',
    3: 'SUBSCRIPTION_CANCELED',
    4: 'SUBSCRIPTION_ON_HOLD',
    5: 'SUBSCRIPTION_IN_GRACE_PERIOD',
    6: 'SUBSCRIPTION_RESTARTED',
    7: 'SUBSCRIPTION_PRICE_CHANGE_CONFIRMED',
    8: 'SUBSCRIPTION_DEFERRED',
    9: 'SUBSCRIPTION_PAUSED',
    10: 'SUBSCRIPTION_REVOKED',
    11: 'SUBSCRIPTION_EXPIRED',
    12: 'ONE_TIME_PRODUCT_PURCHASED',
    13: 'TEST_NOTIFICATION',
  };
  return map[num] ?? 'TEST_NOTIFICATION';
}

/** Mapeia tipo de notificação Google para status interno. */
export function mapGoogleNotificationToStatus(
  type: GoogleNotificationType,
  purchase: GooglePurchase
): { status: string; cancelReason?: string; renewsAt?: Date; retryCount?: number } {
  const expiryTime = purchase.expiryTimeMillis ? new Date(parseInt(purchase.expiryTimeMillis)) : null;
  const now = new Date();

  switch (type) {
    case 'SUBSCRIPTION_PURCHASED':
      // Nova compra (inclui teste grátis).
      return {
        status: purchase.paymentState === 2 ? 'em_teste' : 'ativa',
        renewsAt: expiryTime ?? undefined,
      };

    case 'SUBSCRIPTION_RENEWED':
      // Renovação bem-sucedida.
      return {
        status: 'ativa',
        renewsAt: expiryTime ?? undefined,
        retryCount: 0,
      };

    case 'SUBSCRIPTION_CANCELED':
      // Usuário cancelou (vale até fim do período).
      return {
        status: 'cancelando',
        cancelReason: 'user_cancel',
        renewsAt: expiryTime ?? undefined,
      };

    case 'SUBSCRIPTION_ON_HOLD':
      // Account hold - falha de pagamento, acesso bloqueado.
      return {
        status: 'pagamento_falhou',
        retryCount: 1,
        renewsAt: expiryTime ?? undefined,
      };

    case 'SUBSCRIPTION_IN_GRACE_PERIOD':
      // Grace period - mantém ativo com aviso.
      return {
        status: 'ativa', // mantém ativa durante grace period
        retryCount: 1,
        renewsAt: expiryTime ?? undefined,
      };

    case 'SUBSCRIPTION_RESTARTED':
      // Usuário reativou após cancelar.
      return {
        status: 'ativa',
        renewsAt: expiryTime ?? undefined,
        retryCount: 0,
      };

    case 'SUBSCRIPTION_PRICE_CHANGE_CONFIRMED':
      // Usuário confirmou aumento de preço.
      return { status: 'ativa' };

    case 'SUBSCRIPTION_DEFERRED':
      // Próxima cobrança adiada (prorrogação grátis).
      return {
        status: 'ativa',
        renewsAt: expiryTime ?? undefined,
      };

    case 'SUBSCRIPTION_PAUSED':
      // Pausada pelo usuário (ressume depois).
      return { status: 'cancelando' }; // trata como cancelando até fim do período

    case 'SUBSCRIPTION_REVOKED':
      // Revogada (chargeback, fraude).
      return { status: 'cancelada', cancelReason: 'billing_error' };

    case 'SUBSCRIPTION_EXPIRED':
      // Expirou sem renovar.
      return { status: 'expirada', cancelReason: 'billing_error' };

    default:
      return { status: 'ativa' };
  }
}

/** Extrai user_id do obfuscatedExternalAccountId. */
export function extractUserIdFromPurchase(purchase: GooglePurchase): string | null {
  if (!purchase.obfuscatedExternalAccountId) return null;
  // O obfuscatedExternalAccountId é o que o app mandou na compra (appAccountToken equivalente).
  // Valida UUID.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(purchase.obfuscatedExternalAccountId)) {
    return null;
  }
  return purchase.obfuscatedExternalAccountId;
}

/** Cliente Google Play Developer API (service account). */
export interface GooglePlayClientConfig {
  serviceAccountEmail: string;
  privateKey: string; // PEM
  packageName: string;
}

/** Cria cliente autenticado para Google Play Developer API. */
export async function createGooglePlayClient(config: GooglePlayClientConfig) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: config.serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const privateKey = await jose.importPKCS8(config.privateKey, 'RS256');
  const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .sign(privateKey);

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResp.json();
  if (!tokenResp.ok) {
    throw new Error(`Falha ao obter token Google: ${JSON.stringify(tokenData)}`);
  }

  return {
    accessToken: tokenData.access_token,
    baseUrl: 'https://androidpublisher.googleapis.com/androidpublisher/v3',
    packageName: config.packageName,
  };
}

/** Busca detalhes da assinatura na Google Play Developer API (validação server-side). */
export async function getGoogleSubscriptionPurchase(
  client: Awaited<ReturnType<typeof createGooglePlayClient>>,
  purchaseToken: string
): Promise<GooglePurchase | null> {
  const url = `${client.baseUrl}/applications/${client.packageName}/purchases/subscriptions/${purchaseToken}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${client.accessToken}` },
  });
  if (resp.status === 404) return null;
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Google API erro ${resp.status}: ${JSON.stringify(err)}`);
  }
  return (await resp.json()) as GooglePurchase;
}

/** Cliente Supabase com service_role para webhooks. */
export function getServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatórios');
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Carrega configuração do Google da tabela integrations (criptografada no vault). */
export async function loadGoogleConfig(): Promise<GooglePlayClientConfig | null> {
  const client = getServiceClient();
  const { data, error } = await client
    .from('integrations')
    .select('config')
    .eq('provider', 'google')
    .single();

  if (error || !data?.config) return null;

  const cfg = data.config as Record<string, string>;
  return {
    serviceAccountEmail: cfg.service_account_email ?? '',
    privateKey: cfg.private_key ?? '',
    packageName: cfg.package_name ?? '',
  };
}