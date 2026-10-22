// PetLive: Validação server-side de compra Google Play (Google Play Developer API).
// BUSINESS.md 23.1: não confiar só no webhook; consultar API da loja para confirmar status.

import { serve } from 'std/server';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import * as jose from 'npm:jose@5';

const LOG_PREFIX = '[verify-google-purchase]';

function log(info: Record<string, unknown>) {
  console.log(JSON.stringify({ ...info, timestamp: new Date().toISOString(), prefix: LOG_PREFIX }));
}

function logError(info: Record<string, unknown>) {
  console.error(JSON.stringify({ ...info, timestamp: new Date().toISOString(), prefix: LOG_PREFIX }));
}

interface GooglePurchaseRequest {
  purchase_token: string;          // purchaseToken do Google
  product_id?: string;             // SKU do produto
  obfuscated_account_id?: string;  // UUID do usuário (enviado na compra)
}

interface GooglePurchase {
  kind: string;
  startTimeMillis: string;
  expiryTimeMillis: string;
  autoRenewing: boolean;
  priceCurrencyCode: string;
  priceAmountMicros: string;
  countryCode: string;
  developerPayload: string;
  paymentState: number;
  orderId: string;
  purchaseType: number;
  acknowledgementState: number;
  purchaseToken: string;
  productId: string;
  obfuscatedExternalAccountId: string;
  profileId?: string;
  profileName?: string;
  linkedPurchaseToken?: string;
  subscriptionState?: number;
}

serve(async (req) => {
  const start = Date.now();
  const authHeader = req.headers.get('Authorization');

  try {
    let userId: string;
    const client = createServiceClient();

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { data: { user }, error } = await client.auth.getUser(token);
      if (error || !user) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 });
      }
      userId = user.id;
    } else {
      userId = 'service_role';
    }

    const body = await req.json() as GooglePurchaseRequest;
    const { purchase_token, product_id, obfuscated_account_id } = body;

    if (!purchase_token) {
      return new Response(JSON.stringify({ error: 'purchase_token obrigatório' }), { status: 400 });
    }

    // Busca configuração Google.
    const googleConfig = await loadGoogleConfig(client);
    if (!googleConfig) {
      return new Response(JSON.stringify({ error: 'Configuração Google não encontrada' }), { status: 503 });
    }

    // Cria cliente autenticado.
    const gpClient = await createGooglePlayClient(googleConfig);
    const purchase = await getGoogleSubscriptionPurchase(gpClient, purchase_token);

    if (!purchase) {
      return new Response(JSON.stringify({ error: 'Compra não encontrada', valid: false }), { status: 404 });
    }

    // Validações.
    if (product_id && purchase.productId !== product_id) {
      logError({ event: 'product_id_mismatch', expected: product_id, actual: purchase.productId });
    }

    const txnUserId = purchase.obfuscatedExternalAccountId ?? obfuscated_account_id;
    if (txnUserId && userId !== 'service_role' && txnUserId !== userId) {
      return new Response(JSON.stringify({ error: 'Compra pertence a outro usuário', valid: false }), { status: 403 });
    }

    // Mapeia status baseado no subscriptionState e paymentState.
    const { status, cancelReason, renewsAt, retryCount } = mapGoogleStatus(purchase);

    const startedAt = new Date(parseInt(purchase.startTimeMillis));
    const currentPeriodEnd = purchase.expiryTimeMillis ? new Date(parseInt(purchase.expiryTimeMillis)) : new Date(startedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const renewsAtDate = renewsAt ?? currentPeriodEnd;

    // Atualiza/cria assinatura se não é service_role.
    if (userId !== 'service_role' && txnUserId) {
      const planCode = mapProductIdToPlanCode(purchase.productId);
      if (planCode) {
        await client.rpc('upsert_subscription_from_webhook', {
          p_user_id: txnUserId,
          p_plan_code: planCode,
          p_provider: 'google',
          p_provider_subscription_id: purchase.purchaseToken,
          p_provider_original_transaction_id: purchase.linkedPurchaseToken ?? purchase.purchaseToken,
          p_status: status,
          p_started_at: startedAt.toISOString(),
          p_current_period_end: currentPeriodEnd.toISOString(),
          p_renews_at: renewsAtDate.toISOString(),
          p_cancel_at: status === 'cancelando' ? renewsAtDate.toISOString() : null,
          p_cancel_reason: cancelReason ?? null,
          p_trial_ends_at: status === 'em_teste' && purchase.paymentState === 2 ? currentPeriodEnd.toISOString() : null,
          p_retry_count: retryCount ?? 0,
        });
      }
    }

    const duration = Date.now() - start;
    log({ event: 'verificado', purchase_token, status, duration_ms: duration });

    return new Response(JSON.stringify({
      valid: true,
      purchase: {
        purchaseToken: purchase.purchaseToken,
        productId: purchase.productId,
        startTimeMillis: purchase.startTimeMillis,
        expiryTimeMillis: purchase.expiryTimeMillis,
        autoRenewing: purchase.autoRenewing,
        paymentState: purchase.paymentState,
        subscriptionState: purchase.subscriptionState,
        status,
        renewsAt: renewsAtDate.toISOString(),
        cancelReason,
        retryCount,
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    const duration = Date.now() - start;
    logError({ event: 'erro', error: e instanceof Error ? e.message : String(e), duration_ms: duration });
    return new Response(JSON.stringify({ error: 'Erro interno', valid: false }), { status: 500 });
  }
});

async function loadGoogleConfig(client: SupabaseClient): Promise<{
  serviceAccountEmail: string;
  privateKey: string;
  packageName: string;
} | null> {
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

async function createGooglePlayClient(config: { serviceAccountEmail: string; privateKey: string; packageName: string }) {
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

async function getGoogleSubscriptionPurchase(
  client: { accessToken: string; baseUrl: string; packageName: string },
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

function mapGoogleStatus(purchase: GooglePurchase): { status: string; cancelReason?: string; renewsAt?: Date; retryCount?: number } {
  const expiryTime = purchase.expiryTimeMillis ? new Date(parseInt(purchase.expiryTimeMillis)) : null;
  const now = new Date();
  const subState = purchase.subscriptionState ?? 0;
  const paymentState = purchase.paymentState;

  // subscriptionState: 2=active, 3=grace_period, 4=account_hold, 5=paused, 6=revoked, 7=expired
  // paymentState: 0=pending, 1=received, 2=free_trial, 3=grace_period, 4=account_hold

  if (subState === 6) return { status: 'cancelada', cancelReason: 'billing_error' }; // revoked
  if (subState === 7) return { status: 'expirada', cancelReason: 'billing_error' }; // expired
  if (subState === 5) return { status: 'cancelando', renewsAt: expiryTime ?? undefined }; // paused

  if (subState === 4 || paymentState === 4) { // account_hold
    return { status: 'pagamento_falhou', retryCount: 1, renewsAt: expiryTime ?? undefined };
  }

  if (subState === 3 || paymentState === 3) { // grace_period
    return { status: 'ativa', retryCount: 1, renewsAt: expiryTime ?? undefined };
  }

  if (paymentState === 2) { // free_trial
    return { status: 'em_teste', renewsAt: expiryTime ?? undefined };
  }

  // Ativa
  if (!purchase.autoRenewing) {
    return { status: 'cancelando', cancelReason: 'user_cancel', renewsAt: expiryTime ?? undefined };
  }

  return { status: 'ativa', renewsAt: expiryTime ?? undefined, retryCount: 0 };
}

function mapProductIdToPlanCode(productId: string): string | null {
  const mapping: Record<string, string> = {
    'petlive_premium_mensal': 'premium_mensal',
    'petlive_premium_anual': 'premium_anual',
  };
  return mapping[productId] ?? null;
}

function createServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatórios');
  return createClient(url, key, { auth: { persistSession: false } });
}