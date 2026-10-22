// PetLive: consulta da assinatura na App Store e na Google Play, com as
// credenciais guardadas só no servidor (BUSINESS.md 5.13). A verdade é sempre
// a resposta da API da loja: nem o comprovante do app nem o aviso que chega
// pelo webhook são aceitos sem essa consulta.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  centavosGoogle,
  estadoApple,
  estadoGoogle,
  payloadJws,
  type AssinaturaGoogle,
  type EstadoAssinatura,
  type RenovacaoApple,
  type TransacaoApple,
} from './assinatura-estado.ts';

const env = (nome: string) => Deno.env.get(nome) ?? '';

export class ErroLoja extends Error {
  constructor(public codigo: 'pedido' | 'sem_chave' | 'loja' | 'nao_encontrada' | 'outra_conta', mensagem: string) {
    super(mensagem);
  }
}

export function resposta(corpo: unknown, status = 200): Response {
  return Response.json(corpo, { status });
}

export function respostaDeErro(e: unknown): Response {
  if (e instanceof ErroLoja) {
    const status = { pedido: 400, sem_chave: 503, loja: 502, nao_encontrada: 404, outra_conta: 409 }[e.codigo];
    return resposta({ erro: e.codigo, mensagem: e.message }, status);
  }
  console.error(e);
  return resposta({ erro: 'interno', mensagem: 'Não foi possível confirmar a assinatura agora.' }, 500);
}

export function clienteServidor(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
}

/** Grava o estado da loja para o tutor e devolve o plano recalculado. */
export async function aplicar(cliente: SupabaseClient, userId: string, estado: EstadoAssinatura) {
  const { conta: _conta, ...resto } = estado;
  const { data, error } = await cliente.rpc('aplicar_assinatura_loja', { p: { ...resto, user_id: userId } });
  if (error) {
    if (error.hint === 'outra_conta') throw new ErroLoja('outra_conta', error.message);
    throw error;
  }
  return data as { status: string; status_anterior: string | null; plano: 'gratis' | 'premium' };
}

// ------------------------------------------------------------------
// Assinatura de tokens (ES256 para a Apple, RS256 para o Google)
// ------------------------------------------------------------------
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const texto64 = (obj: unknown) => b64url(new TextEncoder().encode(JSON.stringify(obj)));

function chavePkcs8(pem: string): ArrayBuffer {
  const corpo = pem.replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(corpo), (c) => c.charCodeAt(0)).buffer;
}

async function jwt(cabecalho: Record<string, unknown>, corpo: Record<string, unknown>, pem: string, alg: 'ES256' | 'RS256') {
  const dados = `${texto64(cabecalho)}.${texto64(corpo)}`;
  const algoritmo = alg === 'ES256' ? { name: 'ECDSA', namedCurve: 'P-256' } : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
  const chave = await crypto.subtle.importKey('pkcs8', chavePkcs8(pem), algoritmo, false, ['sign']);
  const assinatura = await crypto.subtle.sign(alg === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : algoritmo, chave, new TextEncoder().encode(dados));
  return `${dados}.${b64url(new Uint8Array(assinatura))}`;
}

// ------------------------------------------------------------------
// App Store Server API
// ------------------------------------------------------------------
const APPLE = { producao: 'https://api.storekit.itunes.apple.com', teste: 'https://api.storekit-sandbox.itunes.apple.com' };

async function tokenApple(): Promise<string> {
  if (!env('APPLE_IAP_KEY_ID') || !env('APPLE_IAP_ISSUER_ID') || !env('APPLE_IAP_PRIVATE_KEY')) {
    throw new ErroLoja('sem_chave', 'Credenciais da App Store não configuradas.');
  }
  const agora = Math.floor(Date.now() / 1000);
  return await jwt(
    { alg: 'ES256', kid: env('APPLE_IAP_KEY_ID'), typ: 'JWT' },
    { iss: env('APPLE_IAP_ISSUER_ID'), iat: agora, exp: agora + 600, aud: 'appstoreconnect-v1', bid: env('APPLE_BUNDLE_ID') || 'app.petlive.tutor' },
    env('APPLE_IAP_PRIVATE_KEY'),
    'ES256',
  );
}

type StatusApple = {
  data?: { lastTransactions?: { status: number; originalTransactionId: string; signedTransactionInfo: string; signedRenewalInfo?: string }[] }[];
};

/**
 * Estado da assinatura a partir de qualquer transactionId dela. A Apple pede
 * para tentar produção e, se não achar, o sandbox (compras do TestFlight).
 */
export async function consultarApple(transactionId: string): Promise<EstadoAssinatura> {
  const token = await tokenApple();
  for (const base of [APPLE.producao, APPLE.teste]) {
    const r = await fetch(`${base}/inApps/v1/subscriptions/${encodeURIComponent(transactionId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.status === 404) continue;
    if (!r.ok) throw new ErroLoja('loja', `App Store respondeu ${r.status}.`);
    const corpo = (await r.json()) as StatusApple;
    const ultimas = (corpo.data ?? []).flatMap((g) => g.lastTransactions ?? []);
    if (!ultimas.length) break;
    const decodificadas = ultimas.map((u) => ({
      status: u.status,
      t: payloadJws<TransacaoApple>(u.signedTransactionInfo),
      r: u.signedRenewalInfo ? payloadJws<RenovacaoApple>(u.signedRenewalInfo) : null,
    }));
    // A que vale por mais tempo (o grupo do Premium tem uma só por pessoa).
    decodificadas.sort((a, b) => (b.t.expiresDate ?? 0) - (a.t.expiresDate ?? 0));
    const { status, t, r: renovacao } = decodificadas[0];
    return estadoApple(status, t, renovacao);
  }
  throw new ErroLoja('nao_encontrada', 'A App Store não encontrou esta compra.');
}

// ------------------------------------------------------------------
// Google Play Developer API
// ------------------------------------------------------------------
const PLAY = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const pacote = () => env('GOOGLE_PLAY_PACKAGE') || 'app.petlive.tutor';

async function tokenGoogle(): Promise<string> {
  const bruto = env('GOOGLE_PLAY_SERVICE_ACCOUNT');
  if (!bruto) throw new ErroLoja('sem_chave', 'Conta de serviço da Google Play não configurada.');
  const conta = JSON.parse(bruto) as { client_email: string; private_key: string };
  const agora = Math.floor(Date.now() / 1000);
  const assercao = await jwt(
    { alg: 'RS256', typ: 'JWT' },
    { iss: conta.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 600 },
    conta.private_key,
    'RS256',
  );
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: assercao }),
  });
  if (!r.ok) throw new ErroLoja('loja', 'Não foi possível autenticar na Google Play.');
  return ((await r.json()) as { access_token: string }).access_token;
}

/** Estado da assinatura pelo purchaseToken; confirma (acknowledge) a compra se ainda não foi. */
export async function consultarGoogle(purchaseToken: string): Promise<EstadoAssinatura> {
  const token = await tokenGoogle();
  const auth = { Authorization: `Bearer ${token}` };
  const r = await fetch(`${PLAY}/${pacote()}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`, { headers: auth });
  if (r.status === 404 || r.status === 410) throw new ErroLoja('nao_encontrada', 'A Google Play não encontrou esta compra.');
  if (!r.ok) throw new ErroLoja('loja', `Google Play respondeu ${r.status}.`);
  const assinatura = (await r.json()) as AssinaturaGoogle;

  // Sem a confirmação em 3 dias, a Google reembolsa a compra sozinha.
  const item = assinatura.lineItems?.[0];
  if (assinatura.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING' && item) {
    await fetch(`${PLAY}/${pacote()}/purchases/subscriptions/${item.productId}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: '{}',
    });
  }

  // Valor da última cobrança para o faturamento (se a consulta do pedido falhar, a assinatura vale igual).
  let valor = 0;
  const pedido = item?.latestSuccessfulOrderId ?? assinatura.latestOrderId;
  if (pedido) {
    try {
      const p = await fetch(`${PLAY}/${pacote()}/orders/${encodeURIComponent(pedido)}`, { headers: auth });
      if (p.ok) valor = centavosGoogle(((await p.json()) as { total?: { currencyCode?: string; units?: string; nanos?: number } }).total);
    } catch {
      valor = 0;
    }
  }
  return estadoGoogle(purchaseToken, assinatura, valor);
}
