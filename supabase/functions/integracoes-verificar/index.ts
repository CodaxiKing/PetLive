import { createClient } from 'npm:@supabase/supabase-js@2';
import { verificarIntegracoes } from './verificar.mjs';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' };
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response('Use POST.', { status: 405, headers });
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return Response.json({ erro: 'Entre no painel.' }, { status: 401, headers });
  const cliente = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  // Nenhum corpo ou URL do cliente define o destino da sonda.
  try { return Response.json(await verificarIntegracoes(cliente, (nome: string) => Deno.env.get(nome)), { headers }); }
  catch { return Response.json({ erro: 'Não foi possível verificar. Confira o acesso com 2FA e a implantação das funções.' }, { status: 403, headers }); }
});
