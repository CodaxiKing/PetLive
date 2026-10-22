// PetLive: utilitários para App Store Server Notifications v2 (JWS assinado).
// BUSINESS.md 23.1, 23.4: validação de assinatura com rotação de chaves.
// Chaves públicas: https://appleid.apple.com/auth/keys

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import * as jose from 'npm:jose@5';

// Tipos de notificação Apple (App Store Server Notifications v2).
export type AppleNotificationType =
  | 'SUBSCRIBED'
  | 'RENEWAL'
  | 'DID_CHANGE_RENEWAL_PREF'
  | 'DID_CHANGE_RENEWAL_STATUS'
  | 'DID_FAIL_TO_RENEW'
  | 'GRACE_PERIOD_EXPIRED'
  | 'REFUND'
  | 'REVOKE'
  | 'EXPIRED'
  | 'OFFER_REDEEMED'
  | 'PRICE_INCREASE'
  | 'SUBSCRIPTION_EXTENDED';

export interface AppleNotificationV2 {
  signedPayload: string;
}

export interface AppleSignedPayload {
  notificationType: AppleNotificationType;
  subtype?: string;
  data: AppleTransactionData;
  version: string;
  signedDate: number;
  environment: 'Sandbox' | 'Production';
}

export interface AppleTransactionData {
  signedTransactionInfo: string;
  signedRenewalInfo?: string;
}

export interface AppleTransactionInfo {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  purchaseDate: number;
  originalPurchaseDate: number;
  expirationDate?: number;
  type: 'Auto-Renewable Subscription';
  inAppOwnershipType: 'PURCHASED' | 'FAMILY_SHARED';
  signedDate: number;
  environment: 'Sandbox' | 'Production';
  offerType?: 1 | 2 | 3; // 1=Intro, 2=Promo, 3=Code
  offerIdentifier?: string;
  revocationDate?: number;
  revocationReason?: 1 | 2; // 1=Issue, 2=Other
  storefront?: string;
  appAccountToken?: string; // UUID que o app mandou na compra
}

export interface AppleRenewalInfo {
  originalTransactionId: string;
  autoRenewStatus: 0 | 1; // 0=off, 1=on
  autoRenewProductId?: string;
  priceIncreaseStatus?: 0 | 1;
  signedDate: number;
  environment: 'Sandbox' | 'Production';
  expirationIntent?: 1 | 2 | 3 | 4 | 5; // 1=User, 2=Billing, 3=Price, 4=Refund, 5=Other
  offerType?: 1 | 2 | 3;
  offerIdentifier?: string;
  gracePeriodExpirationDate?: number;
  isInBillingRetryPeriod?: boolean;
}

/** Cache das chaves públicas da Apple (JWKS). */
let appleJwksCache: jose.JWKS.KeyStore | null = null;
let appleJwksFetchedAt = 0;
const JWKS_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/** Busca ou retorna cache das chaves JWKS da Apple. */
export async function getAppleJwks(): Promise<jose.JWKS.KeyStore> {
  const now = Date.now();
  if (appleJwksCache && now - appleJwksFetchedAt < JWKS_TTL_MS) {
    return appleJwksCache;
  }
  const resp = await fetch('https://appleid.apple.com/auth/keys');
  if (!resp.ok) throw new Error(`Falha ao buscar chaves Apple: ${resp.status}`);
  const jwks = await resp.json();
  appleJwksCache = jose.createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
  appleJwksFetchedAt = now;
  return appleJwksCache;
}

/** Verifica e decodifica o JWS do payload assinado da Apple. */
export async function verifyAppleSignedPayload(
  signedPayload: string
): Promise<AppleSignedPayload> {
  const jwks = await getAppleJwks();
  const { payload } = await jose.jwtVerify(signedPayload, jwks, {
    algorithms: ['ES256'],
  });
  return payload as unknown as AppleSignedPayload;
}

/** Decodifica (sem verificar) o transactionInfo para ler campos antes da verificação completa. */
export function decodeAppleTransactionInfo(signed: string): AppleTransactionInfo {
  const parts = signed.split('.');
  if (parts.length !== 3) throw new Error('JWS transactionInfo malformado');
  const json = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  return json as AppleTransactionInfo;
}

/** Decodifica (sem verificar) o renewalInfo. */
export function decodeAppleRenewalInfo(signed: string): AppleRenewalInfo {
  const parts = signed.split('.');
  if (parts.length !== 3) throw new Error('JWS renewalInfo malformado');
  const json = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  return json as AppleRenewalInfo;
}

/** Mapeia tipo de notificação Apple para status interno da assinatura. */
export function mapAppleNotificationToStatus(
  type: AppleNotificationType,
  txn: AppleTransactionInfo,
  renewal?: AppleRenewalInfo
): { status: string; cancelReason?: string; renewsAt?: Date; retryCount?: number } {
  const now = new Date();
  const expirationDate = txn.expirationDate ? new Date(txn.expirationDate) : null;

  switch (type) {
    case 'SUBSCRIBED':
      // Nova assinatura ou teste iniciado.
      return {
        status: txn.expirationDate && expirationDate > now ? 'ativa' : 'em_teste',
        renewsAt: expirationDate ?? undefined,
      };

    case 'RENEWAL':
      // Renovação bem-sucedida.
      return {
        status: 'ativa',
        renewsAt: expirationDate ?? undefined,
        retryCount: 0,
      };

    case 'DID_CHANGE_RENEWAL_PREF':
      // Usuário mudou o plano (upgrade/downgrade). O productId novo está no renewalInfo.
      return { status: 'ativa' };

    case 'DID_CHANGE_RENEWAL_STATUS':
      // Ligou/desligou renovação automática.
      return { status: renewal?.autoRenewStatus === 0 ? 'cancelando' : 'ativa' };

    case 'DID_FAIL_TO_RENEW':
      // Falha de cobrança - entra em billing retry / grace period.
      return {
        status: 'pagamento_falhou',
        retryCount: (renewal?.isInBillingRetryPeriod ? 1 : 0),
        renewsAt: renewal?.gracePeriodExpirationDate
          ? new Date(renewal.gracePeriodExpirationDate)
          : expirationDate ?? undefined,
      };

    case 'GRACE_PERIOD_EXPIRED':
      // Grace period acabou sem sucesso.
      return { status: 'expirada', cancelReason: 'billing_error' };

    case 'REFUND':
      // Reembolso (Apple processou).
      return { status: 'cancelada', cancelReason: 'refund' };

    case 'REVOKE':
      // Revogado (ex.: chargeback, fraude).
      return { status: 'cancelada', cancelReason: 'billing_error' };

    case 'EXPIRED':
      // Assinatura expirou (não renovou, fim do período).
      return { status: 'expirada', cancelReason: 'billing_error' };

    case 'OFFER_REDEEMED':
      // Oferta promocional resgatada.
      return { status: 'ativa' };

    case 'PRICE_INCREASE':
      // Aumento de preço - usuário precisa concordar.
      return { status: 'ativa' };

    case 'SUBSCRIPTION_EXTENDED':
      // Estendida pelo Apple (grátis por algum motivo).
      return {
        status: 'ativa',
        renewsAt: expirationDate ?? undefined,
      };

    default:
      return { status: 'ativa' };
  }
}

/** Extrai user_id (appAccountToken) do transactionInfo. */
export function extractUserIdFromTransaction(txn: AppleTransactionInfo): string | null {
  if (!txn.appAccountToken) return null;
  // Valida UUID.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(txn.appAccountToken)) {
    return null;
  }
  return txn.appAccountToken;
}

/** Cliente Supabase com service_role para webhooks (ignora RLS). */
export function getServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatórios');
  return createClient(url, key, { auth: { persistSession: false } });
}