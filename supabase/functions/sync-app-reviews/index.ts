// PetLive: importa as avaliações do Google Play e da App Store e envia as
// respostas escritas no painel (AdminAvaliacoes). Chamada a cada hora pelo
// pg_cron (migração 20270108220000_avaliacoes_apps), só com a service_role.
//
// Segredos (Edge Functions): cada loja só roda se os dela existirem.
//   Google Play: GOOGLE_PLAY_SERVICE_ACCOUNT (JSON da conta de serviço com
//     acesso ao app no Play Console) e GOOGLE_PLAY_PACKAGE (padrão app.petlive.tutor).
//   App Store: APP_STORE_ISSUER_ID, APP_STORE_KEY_ID, APP_STORE_PRIVATE_KEY
//     (conteúdo do .p8) e APP_STORE_APP_ID (id numérico do app).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { importPKCS8, SignJWT } from 'npm:jose@5.9.6';

type Item = { external_id: string; rating: number; author: string | null; title: string | null; text: string | null; app_version: string | null; at: string; reply_text: string | null; replied_at: string | null };
type Pendente = { id: string; platform: 'play' | 'app_store'; external_id: string; reply_text: string };

// ---------- Google Play (Android Publisher API v3) ----------
async function tokenGoogle(conta: { client_email: string; private_key: string }): Promise<string> {
  const chave = await importPKCS8(conta.private_key, 'RS256');
  const agora = Math.floor(Date.now() / 1000);
  const assercao = await new SignJWT({ scope: 'https://www.googleapis.com/auth/androidpublisher' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(conta.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(agora)
    .setExpirationTime(agora + 3000)
    .sign(chave);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: assercao }),
  });
  if (!r.ok) throw new Error(`Google: token recusado (${r.status})`);
  return (await r.json()).access_token as string;
}

const segundos = (v?: { seconds?: string | number }) => (v?.seconds ? new Date(Number(v.seconds) * 1000).toISOString() : null);

async function play(supabase: SupabaseClient, pendentes: Pendente[]) {
  const bruto = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT');
  if (!bruto) return { platform: 'play', ok: false, mensagem: 'Sem credencial do Google Play' };
  const pacote = Deno.env.get('GOOGLE_PLAY_PACKAGE') ?? 'app.petlive.tutor';
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(pacote)}/reviews`;
  try {
    const token = await tokenGoogle(JSON.parse(bruto));
    const auth = { Authorization: `Bearer ${token}` };
    for (const p of pendentes.filter((x) => x.platform === 'play')) {
      const r = await fetch(`${base}/${encodeURIComponent(p.external_id)}:reply`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ replyText: p.reply_text }),
      });
      await supabase.rpc('app_reviews_resposta_resultado', { p_id: p.id, p_ok: r.ok, p_erro: r.ok ? null : `Google ${r.status}` });
    }
    // A API devolve as avaliações com texto da última semana.
    const itens: Item[] = [];
    let pagina: string | undefined;
    for (let i = 0; i < 5; i++) {
      const r = await fetch(`${base}?maxResults=100${pagina ? `&token=${encodeURIComponent(pagina)}` : ''}`, { headers: auth });
      if (!r.ok) throw new Error(`Google: lista recusada (${r.status})`);
      const corpo = await r.json();
      for (const rev of corpo.reviews ?? []) {
        const usuario = rev.comments?.find((c: { userComment?: unknown }) => c.userComment)?.userComment;
        const dev = rev.comments?.find((c: { developerComment?: unknown }) => c.developerComment)?.developerComment;
        if (!usuario?.starRating) continue;
        itens.push({
          external_id: rev.reviewId, rating: usuario.starRating, author: rev.authorName ?? null, title: null,
          text: usuario.text?.trim() ?? null, app_version: usuario.appVersionName ?? null, at: segundos(usuario.lastModified) ?? new Date().toISOString(),
          reply_text: dev?.text ?? null, replied_at: segundos(dev?.lastModified),
        });
      }
      pagina = corpo.tokenPagination?.nextPageToken;
      if (!pagina) break;
    }
    const { data } = await supabase.rpc('app_reviews_importar', { p_platform: 'play', p_itens: itens, p_ok: true, p_mensagem: `${itens.length} avaliações` });
    return { platform: 'play', ok: true, importadas: data };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e);
    await supabase.rpc('app_reviews_importar', { p_platform: 'play', p_itens: [], p_ok: false, p_mensagem: mensagem });
    return { platform: 'play', ok: false, mensagem };
  }
}

// ---------- App Store Connect API ----------
async function tokenApple(issuer: string, kid: string, p8: string): Promise<string> {
  const chave = await importPKCS8(p8.replace(/\\n/g, '\n'), 'ES256');
  const agora = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid, typ: 'JWT' })
    .setIssuer(issuer)
    .setAudience('appstoreconnect-v1')
    .setIssuedAt(agora)
    .setExpirationTime(agora + 1100)
    .sign(chave);
}

async function appStore(supabase: SupabaseClient, pendentes: Pendente[]) {
  const issuer = Deno.env.get('APP_STORE_ISSUER_ID');
  const kid = Deno.env.get('APP_STORE_KEY_ID');
  const p8 = Deno.env.get('APP_STORE_PRIVATE_KEY');
  const app = Deno.env.get('APP_STORE_APP_ID');
  if (!issuer || !kid || !p8 || !app) return { platform: 'app_store', ok: false, mensagem: 'Sem credencial da App Store' };
  const api = 'https://api.appstoreconnect.apple.com/v1';
  try {
    const auth = { Authorization: `Bearer ${await tokenApple(issuer, kid, p8)}` };
    for (const p of pendentes.filter((x) => x.platform === 'app_store')) {
      const r = await fetch(`${api}/customerReviewResponses`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { type: 'customerReviewResponses', attributes: { responseBody: p.reply_text }, relationships: { review: { data: { type: 'customerReviews', id: p.external_id } } } } }),
      });
      await supabase.rpc('app_reviews_resposta_resultado', { p_id: p.id, p_ok: r.ok, p_erro: r.ok ? null : `Apple ${r.status}` });
    }
    const itens: Item[] = [];
    let url: string | undefined = `${api}/apps/${encodeURIComponent(app)}/customerReviews?sort=-createdDate&limit=200&include=response`;
    for (let i = 0; i < 3 && url; i++) {
      const r: Response = await fetch(url, { headers: auth });
      if (!r.ok) throw new Error(`Apple: lista recusada (${r.status})`);
      const corpo = await r.json();
      const respostas = new Map<string, { responseBody?: string; lastModifiedDate?: string }>(
        (corpo.included ?? []).filter((x: { type: string }) => x.type === 'customerReviewResponses').map((x: { id: string; attributes: object }) => [x.id, x.attributes]),
      );
      for (const rev of corpo.data ?? []) {
        const resp = respostas.get(rev.relationships?.response?.data?.id);
        itens.push({
          external_id: rev.id, rating: rev.attributes.rating, author: rev.attributes.reviewerNickname ?? null, title: rev.attributes.title ?? null,
          text: rev.attributes.body ?? null, app_version: null, at: rev.attributes.createdDate,
          reply_text: resp?.responseBody ?? null, replied_at: resp?.lastModifiedDate ?? null,
        });
      }
      url = corpo.links?.next;
    }
    const { data } = await supabase.rpc('app_reviews_importar', { p_platform: 'app_store', p_itens: itens, p_ok: true, p_mensagem: `${itens.length} avaliações` });
    return { platform: 'app_store', ok: true, importadas: data };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e);
    await supabase.rpc('app_reviews_importar', { p_platform: 'app_store', p_itens: [], p_ok: false, p_mensagem: mensagem });
    return { platform: 'app_store', ok: false, mensagem };
  }
}

Deno.serve(async (req) => {
  const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  // Só o cron (com a service_role) pode disparar.
  if (!chave || req.headers.get('Authorization') !== `Bearer ${chave}`) return new Response('nao autorizado', { status: 401 });
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', chave, { auth: { persistSession: false } });
  const { data } = await supabase.rpc('app_reviews_respostas_pendentes');
  const pendentes = (data ?? []) as Pendente[];
  const resultado = await Promise.all([play(supabase, pendentes), appStore(supabase, pendentes)]);
  return Response.json({ resultado });
});
