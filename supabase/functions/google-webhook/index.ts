// PetLive: Webhook Google Play Real-time Developer Notifications (RTDN).
// Recebe mensagens Pub/Sub (base64), valida, processa e atualiza subscriptions.
// BUSINESS.md 20.4, 21.5, 23.1, 23.4.
// Responde 2xx rápido; processamento pesado assíncrono via job.

import { serve } from 'std/server';
import {
  mapGoogleNotificationType,
  mapGoogleNotificationToStatus,
  extractUserIdFromPurchase,
  getServiceClient,
  loadGoogleConfig,
  createGooglePlayClient,
  getGoogleSubscriptionPurchase,
  type GooglePubSubMessage,
  type GoogleNotificationType,
  type GooglePurchase,
} from '../_shared/google.ts';

const LOG_PREFIX = '[google-webhook]';

function log(info: Record<string, unknown>) {
  console.log(JSON.stringify({ ...info, timestamp: new Date().toISOString(), prefix: LOG_PREFIX }));
}

function logError(info: Record<string, unknown>) {
  console.error(JSON.stringify({ ...info, timestamp: new Date().toISOString(), prefix: LOG_PREFIX }));
}

serve(async (req) => {
  const start = Date.now();
  let providerSubId = 'unknown';
  let notificationType: GoogleNotificationType = 'TEST_NOTIFICATION';

  try {
    const body = await req.json() as GooglePubSubMessage;
    if (!body.message?.data) {
      logError({ event: 'payload_vazio', status: 400 });
      return new Response('Payload inválido', { status: 400 });
    }

    // Decodifica base64 do Pub/Sub.
    const decoded = JSON.parse(atob(body.message.data)) as
      | { subscriptionNotification?: any; testNotification?: any; voidedPurchaseNotification?: any };

    log({ event: 'webhook_recebido', messageId: body.message.messageId, keys: Object.keys(decoded) });

    // Notificação de teste - só loga e retorna OK.
    if (decoded.testNotification) {
      log({ event: 'test_notification', version: decoded.testNotification.version });
      return new Response('OK', { status: 200 });
    }

    // Notificação de compra anulada (voided purchase).
    if (decoded.voidedPurchaseNotification) {
      const vpn = decoded.voidedPurchaseNotification;
      log({ event: 'voided_purchase', orderId: vpn.orderId, purchaseToken: vpn.purchaseToken, reason: vpn.voidedReason });
      // Marcar como revogada/expirada via purchaseToken.
      await handleVoidedPurchase(vpn.purchaseToken, vpn.voidedReason);
      return new Response('OK', { status: 200 });
    }

    // Notificação de assinatura padrão.
    if (!decoded.subscriptionNotification) {
      logError({ event: 'tipo_desconhecido', decodedKeys: Object.keys(decoded) });
      return new Response('OK', { status: 200 });
    }

    const notif = decoded.subscriptionNotification;
    notificationType = mapGoogleNotificationType(notif.notificationType);
    providerSubId = notif.purchaseToken;

    log({
      event: 'subscription_notification',
      notificationType,
      purchaseToken: notif.purchaseToken,
      subscriptionId: notif.subscriptionId,
      eventTime: decoded.eventTimeMillis,
    });

    // Validação server-side: busca detalhes atuais na Google Play API.
    const googleConfig = await loadGoogleConfig();
    if (!googleConfig || !googleConfig.serviceAccountEmail || !googleConfig.privateKey) {
      logError({ event: 'google_config_ausente', status: 500 });
      // Não falha o webhook; job de reconciliação corrigirá depois.
      return new Response('OK', { status: 200 });
    }

    const gpClient = await createGooglePlayClient(googleConfig);
    const purchase = await getGoogleSubscriptionPurchase(gpClient, notif.purchaseToken);

    if (!purchase) {
      logError({ event: 'compra_nao_encontrada', purchaseToken: notif.purchaseToken });
      return new Response('OK', { status: 200 });
    }

    // Extrai user_id do obfuscatedExternalAccountId.
    const userId = extractUserIdFromPurchase(purchase);
    if (!userId) {
      logError({ event: 'user_id_ausente', purchaseToken: notif.purchaseToken });
      return new Response('OK', { status: 200 });
    }

    // Mapeia productId para plano interno.
    const planCode = mapProductIdToPlanCode(purchase.productId);
    if (!planCode) {
      logError({ event: 'product_id_desconhecido', productId: purchase.productId });
      return new Response('OK', { status: 200 });
    }

    // Mapeia para status interno.
    const { status, cancelReason, renewsAt, retryCount } = mapGoogleNotificationToStatus(notificationType, purchase);

    const startedAt = new Date(parseInt(purchase.startTimeMillis));
    const currentPeriodEnd = purchase.expiryTimeMillis ? new Date(parseInt(purchase.expiryTimeMillis)) : new Date(startedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const renewsAtDate = renewsAt ?? currentPeriodEnd;

    // Upsert idempotente.
    const client = getServiceClient();
    const { error } = await client.rpc('upsert_subscription_from_webhook', {
      p_user_id: userId,
      p_plan_code: planCode,
      p_provider: 'google',
      p_provider_subscription_id: notif.purchaseToken, // purchaseToken muda a cada renovação
      p_provider_original_transaction_id: purchase.linkedPurchaseToken ?? notif.purchaseToken, // primeiro token
      p_status: status,
      p_started_at: startedAt.toISOString(),
      p_current_period_end: currentPeriodEnd.toISOString(),
      p_renews_at: renewsAtDate.toISOString(),
      p_cancel_at: status === 'cancelando' ? renewsAtDate.toISOString() : null,
      p_cancel_reason: cancelReason ?? null,
      p_trial_ends_at: status === 'em_teste' && purchase.paymentState === 2 ? currentPeriodEnd.toISOString() : null,
      p_retry_count: retryCount ?? 0,
    });

    if (error) throw error;

    const duration = Date.now() - start;
    log({ event: 'webhook_processado', notificationType, userId, status, duration_ms: duration });

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
    // Retorna 200 para não travar retry do Google Pub/Sub.
    return new Response('OK', { status: 200 });
  }
});

async function handleVoidedPurchase(purchaseToken: string, voidedReason: number) {
  const client = getServiceClient();
  const reasonMap: Record<number, string> = {
    1: 'user_cancel',      // User cancelled
    2: 'billing_error',    // Payment declined
    3: 'refund',           // Refunded
    4: 'other',            // Other
  };
  const cancelReason = reasonMap[voidedReason] ?? 'other';

  await client
    .from('subscriptions')
    .update({ status: 'cancelada', cancel_reason: cancelReason, updated_at: new Date().toISOString() })
    .eq('provider', 'google')
    .eq('provider_subscription_id', purchaseToken);
}

/** Mapeia productId do Google (SKU) para código do plano interno. */
function mapProductIdToPlanCode(productId: string): string | null {
  const mapping: Record<string, string> = {
    'petlive_premium_mensal': 'premium_mensal',
    'petlive_premium_anual': 'premium_anual',
  };
  return mapping[productId] ?? null;
}