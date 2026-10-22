// PetLive: Validação server-side de recibo Apple (App Store Server API).
// BUSINESS.md 23.1: não confiar só no webhook; consultar API da loja para confirmar status.
// Endpoint chamado pelo app após compra ou pelo job subscription-billing.

import { serve } from 'std/server';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import * as jose from 'npm:jose@5';

const LOG_PREFIX = '[verify-apple-receipt]';

function log(info: Record<string, unknown>) {
  console.log(JSON.stringify({ ...info, timestamp: new Date().toISOString(), prefix: LOG_PREFIX }));
}

function logError(info: Record<string, unknown>) {
  console.error(JSON.stringify({ ...info, timestamp: new Date().toISOString(), prefix: LOG_PREFIX }));
}

interface AppleReceiptRequest {
  transaction_id: string;        // transactionId da Apple (originalTransactionId para assinaturas)
  product_id?: string;           // SKU do produto
  app_account_token?: string;    // UUID do usuário (enviado na compra)
}

interface AppleTransactionResponse {
  signedTransactionInfo: string;
  signedRenewalInfo?: string;
}

interface AppleTransactionInfo {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  purchaseDate: number;
  originalPurchaseDate: number;
  expirationDate?: number;
  type: string;
  inAppOwnershipType: string;
  signedDate: number;
  environment: 'Sandbox' | 'Production';
  offerType?: number;
  offerIdentifier?: string;
  revocationDate?: number;
  revocationReason?: number;
  storefront?: string;
  appAccountToken?: string;
}

interface AppleRenewalInfo {
  originalTransactionId: string;
  autoRenewStatus: 0 | 1;
  autoRenewProductId?: string;
  priceIncreaseStatus?: 0 | 1;
  signedDate: number;
  environment: string;
  expirationIntent?: number;
  offerType?: number;
  offerIdentifier?: string;
  gracePeriodExpirationDate?: number;
  isInBillingRetryPeriod?: boolean;
}

serve(async (req) => {
  const start = Date.now();
  const authHeader = req.headers.get('Authorization');

  try {
    // Autenticação: service_role ou usuário autenticado.
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
      // Service role (job, webhook).
      userId = 'service_role';
    }

    const body = await req.json() as AppleReceiptRequest;
    const { transaction_id, product_id, app_account_token } = body;

    if (!transaction_id) {
      return new Response(JSON.stringify({ error: 'transaction_id obrigatório' }), { status: 400 });
    }

    // Se veio app_account_token, valida se bate com o usuário autenticado.
    if (app_account_token && userId !== 'service_role' && app_account_token !== userId) {
      return new Response(JSON.stringify({ error: 'Token de conta não confere' }), { status: 403 });
    }

    // Busca configuração Apple (issuer_id, key_id, private_key, bundle_id).
    const appleConfig = await loadAppleConfig(client);
    if (!appleConfig) {
      return new Response(JSON.stringify({ error: 'Configuração Apple não encontrada' }), { status: 503 });
    }

    // Chama App Store Server API para buscar transação.
    const apiClient = await createAppStoreClient(appleConfig);
    const transaction = await fetchTransaction(apiClient, transaction_id);

    if (!transaction) {
      return new Response(JSON.stringify({ error: 'Transação não encontrada', valid: false }), { status: 404 });
    }

    // Decodifica transactionInfo.
    const txn = decodeJWSPayload(transaction.signedTransactionInfo) as AppleTransactionInfo;
    const renewal = transaction.signedRenewalInfo
      ? decodeJWSPayload(transaction.signedRenewalInfo) as AppleRenewalInfo
      : undefined;

    // Validações de segurança.
    if (product_id && txn.productId !== product_id) {
      logError({ event: 'product_id_mismatch', expected: product_id, actual: txn.productId });
    }

    // Extrai user_id do appAccountToken se não veio no request.
    const txnUserId = txn.appAccountToken ?? app_account_token;
    if (txnUserId && userId !== 'service_role' && txnUserId !== userId) {
      return new Response(JSON.stringify({ error: 'Transação pertence a outro usuário', valid: false }), { status: 403 });
    }

    // Mapeia status.
    const { status, cancelReason, renewsAt, retryCount } = mapAppleStatus(txn, renewal);

    const startedAt = new Date(txn.purchaseDate);
    const currentPeriodEnd = txn.expirationDate ? new Date(txn.expirationDate) : new Date(startedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const renewsAtDate = renewsAt ?? currentPeriodEnd;

    // Se não é service_role, atualiza/cria assinatura no banco.
    if (userId !== 'service_role' && txnUserId) {
      const planCode = mapProductIdToPlanCode(txn.productId);
      if (planCode) {
        await client.rpc('upsert_subscription_from_webhook', {
          p_user_id: txnUserId,
          p_plan_code: planCode,
          p_provider: 'apple',
          p_provider_subscription_id: txn.originalTransactionId,
          p_provider_original_transaction_id: txn.originalTransactionId,
          p_status: status,
          p_started_at: startedAt.toISOString(),
          p_current_period_end: currentPeriodEnd.toISOString(),
          p_renews_at: renewsAtDate.toISOString(),
          p_cancel_at: status === 'cancelando' ? renewsAtDate.toISOString() : null,
          p_cancel_reason: cancelReason ?? null,
          p_trial_ends_at: status === 'em_teste' && txn.expirationDate ? new Date(txn.expirationDate).toISOString() : null,
          p_retry_count: retryCount ?? 0,
        });
      }
    }

    const duration = Date.now() - start;
    log({ event: 'verificado', transaction_id, status, duration_ms: duration });

    return new Response(JSON.stringify({
      valid: true,
      transaction: {
        transactionId: txn.transactionId,
        originalTransactionId: txn.originalTransactionId,
        productId: txn.productId,
        purchaseDate: txn.purchaseDate,
        expirationDate: txn.expirationDate,
        environment: txn.environment,
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

/** Carrega configuração Apple da tabela integrations. */
async function loadAppleConfig(client: SupabaseClient): Promise<{
  issuerId: string;
  keyId: string;
  privateKey: string;
  bundleId: string;
} | null> {
  const { data, error } = await client
    .from('integrations')
    .select('config')
    .eq('provider', 'apple')
    .single();

  if (error || !data?.config) return null;

  const cfg = data.config as Record<string, string>;
  return {
    issuerId: cfg.issuer_id ?? '',
    keyId: cfg.key_id ?? '',
    privateKey: cfg.private_key ?? '',
    bundleId: cfg.bundle_id ?? '',
  };
}

/** Cria cliente autenticado para App Store Server API (JWT). */
async function createAppStoreClient(config: { issuerId: string; keyId: string; privateKey: string; bundleId: string }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: config.issuerId,
    iat: now,
    exp: now + 1200, // 20 min
    aud: 'appstoreconnect-v1',
    scope: [],
  };

  const privateKey = await jose.importPKCS8(config.privateKey, 'ES256');
  const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256', kid: config.keyId, typ: 'JWT' })
    .sign(privateKey);

  return {
    accessToken: jwt,
    baseUrl: 'https://api.storekit-sandbox.itunes.apple.com', // sandbox; produção usa api.storekit.itunes.apple.com
    bundleId: config.bundleId,
  };
}

/** Busca transação na App Store Server API. */
async function fetchTransaction(
  client: { accessToken: string; baseUrl: string; bundleId: string },
  transactionId: string
): Promise<AppleTransactionResponse | null> {
  const url = `${client.baseUrl}/inApps/v1/transactions/${transactionId}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${client.accessToken}` },
  });

  if (resp.status === 404) return null;
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`App Store API erro ${resp.status}: ${JSON.stringify(err)}`);
  }

  return (await resp.json()) as AppleTransactionResponse;
}

/** Decodifica payload JWS (sem verificar assinatura - a API já garante). */
function decodeJWSPayload(signed: string): Record<string, unknown> {
  const parts = signed.split('.');
  if (parts.length !== 3) throw new Error('JWS malformado');
  const json = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  return json;
}

/** Mapeia transação Apple para status interno. */
function mapAppleStatus(
  txn: AppleTransactionInfo,
  renewal?: AppleRenewalInfo
): { status: string; cancelReason?: string; renewsAt?: Date; retryCount?: number } {
  const now = new Date();
  const expirationDate = txn.expirationDate ? new Date(txn.expirationDate) : null;
  const isRevoked = !!txn.revocationDate;
  const isExpired = expirationDate && expirationDate < now;

  if (isRevoked) {
    return { status: 'cancelada', cancelReason: 'billing_error' };
  }

  if (isExpired) {
    // Verifica se está em grace period ou billing retry via renewalInfo.
    if (renewal?.isInBillingRetryPeriod || renewal?.gracePeriodExpirationDate) {
      const graceEnd = renewal.gracePeriodExpirationDate ? new Date(renewal.gracePeriodExpirationDate) : null;
      if (graceEnd && graceEnd > now) {
        return { status: 'ativa', renewsAt: graceEnd, retryCount: 1 };
      }
    }
    return { status: 'expirada', cancelReason: 'billing_error' };
  }

  // Assinatura ativa.
  const autoRenew = renewal?.autoRenewStatus ?? 1;
  if (autoRenew === 0) {
    return { status: 'cancelando', renewsAt: expirationDate ?? undefined, cancelReason: 'user_cancel' };
  }

  // Verifica paymentState via renewalInfo (grace period, billing retry).
  if (renewal?.isInBillingRetryPeriod) {
    return { status: 'pagamento_falhou', retryCount: 1, renewsAt: expirationDate ?? undefined };
  }
  if (renewal?.gracePeriodExpirationDate) {
    const graceEnd = new Date(renewal.gracePeriodExpirationDate);
    if (graceEnd > now) {
      return { status: 'ativa', renewsAt: graceEnd, retryCount: 1 };
    }
  }

  return {
    status: txn.expirationDate && expirationDate > now ? 'ativa' : 'em_teste',
    renewsAt: expirationDate ?? undefined,
  };
}

/** Mapeia productId para plano. */
function mapProductIdToPlanCode(productId: string): string | null {
  const mapping: Record<string, string> = {
    'petlive.premium.mensal': 'premium_mensal',
    'petlive.premium.anual': 'premium_anual',
  };
  return mapping[productId] ?? null;
}

function createServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatórios');
  return createClient(url, key, { auth: { persistSession: false } });
}