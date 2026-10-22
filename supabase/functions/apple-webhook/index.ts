// PetLive: Webhook Apple App Store Server Notifications v2.
// Recebe notificações JWS assinadas, valida, processa e atualiza subscriptions.
// BUSINESS.md 20.4, 21.5, 23.1, 23.4.
// Responde 2xx em < 5s (requisito Apple); processamento pesado pode ser assíncrono via job.

import { serve } from 'std/server';
import {
  verifyAppleSignedPayload,
  mapAppleNotificationToStatus,
  extractUserIdFromTransaction,
  getServiceClient,
  type AppleNotificationV2,
  type AppleNotificationType,
  type AppleTransactionInfo,
} from '../_shared/apple.ts';

const LOG_PREFIX = '[apple-webhook]';

function log(info: Record<string, unknown>) {
  console.log(JSON.stringify({ ...info, timestamp: new Date().toISOString(), prefix: LOG_PREFIX }));
}

function logError(info: Record<string, unknown>) {
  console.error(JSON.stringify({ ...info, timestamp: new Date().toISOString(), prefix: LOG_PREFIX }));
}

serve(async (req) => {
  const start = Date.now();
  let providerSubId = 'unknown';
  let notificationType: AppleNotificationType = 'SUBSCRIBED';

  try {
    // Apple exige resposta rápida; logamos o recebimento imediatamente.
    const body = await req.json() as AppleNotificationV2;
    if (!body.signedPayload) {
      logError({ event: 'payload_vazio', status: 400 });
      return new Response('Payload inválido', { status: 400 });
    }

    // Verifica assinatura JWS e decodifica.
    const payload = await verifyAppleSignedPayload(body.signedPayload);
    notificationType = payload.notificationType;
    const txn = JSON.parse(atob(payload.data.signedTransactionInfo.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as AppleTransactionInfo;
    providerSubId = txn.transactionId;

    log({
      event: 'webhook_recebido',
      notificationType,
      transactionId: txn.transactionId,
      originalTransactionId: txn.originalTransactionId,
      productId: txn.productId,
      environment: payload.environment,
    });

    // Extrai user_id do appAccountToken (enviado pelo app na compra).
    const userId = extractUserIdFromTransaction(txn);
    if (!userId) {
      logError({ event: 'user_id_ausente', transactionId: txn.transactionId, status: 400 });
      // Não falhamos o webhook para não bloquear reprocessamento Apple;
      // apenas logamos e retornamos 200 para evitar retry infinito.
      return new Response('OK', { status: 200 });
    }

    // Mapeia productId da Apple para código do plano interno.
    const planCode = mapProductIdToPlanCode(txn.productId);
    if (!planCode) {
      logError({ event: 'product_id_desconhecido', productId: txn.productId, status: 400 });
      return new Response('OK', { status: 200 });
    }

    // Decodifica renewalInfo se presente.
    let renewal: AppleTransactionInfo | undefined;
    if (payload.data.signedRenewalInfo) {
      renewal = JSON.parse(atob(payload.data.signedRenewalInfo.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as AppleTransactionInfo;
    }

    // Mapeia para status interno.
    const { status, cancelReason, renewsAt, retryCount } = mapAppleNotificationToStatus(
      notificationType,
      txn,
      renewal
    );

    const startedAt = new Date(txn.purchaseDate);
    const currentPeriodEnd = txn.expirationDate ? new Date(txn.expirationDate) : new Date(startedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const renewsAtDate = renewsAt ?? currentPeriodEnd;

    // Upsert idempotente na tabela subscriptions.
    const client = getServiceClient();
    const { error } = await client.rpc('upsert_subscription_from_webhook', {
      p_user_id: userId,
      p_plan_code: planCode,
      p_provider: 'apple',
      p_provider_subscription_id: txn.originalTransactionId, // originalTransactionId é estável
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

    if (error) throw error;

    const duration = Date.now() - start;
    log({ event: 'webhook_processado', notificationType, userId, status, duration_ms: duration });

    // Resposta rápida para Apple.
    return new Response('OK', { status: 200 });
  } catch (e) {
    const duration = Date.now() - start;
    logError({
      event: 'webhook_erro',
      notificationType,
      providerSubId,
      error: e instanceof Error ? e.message : String(e),
      duration_ms: duration,
    });
    // Mesmo em erro, retornamos 200 para não travar reprocessamento Apple
    // (o job subscription-billing fará a reconciliação).
    return new Response('OK', { status: 200 });
  }
});

/** Mapeia productId da Apple (SKU) para código do plano interno. */
function mapProductIdToPlanCode(productId: string): string | null {
  // Configurável via feature_flags ou integrations no futuro.
  const mapping: Record<string, string> = {
    'petlive.premium.mensal': 'premium_mensal',
    'petlive.premium.anual': 'premium_anual',
  };
  return mapping[productId] ?? null;
}