// PetLive: página pública do QR da coleira (BUSINESS.md 5.6 e seção 4.5).
// Edge Function que lê o IP do cliente, calcula o hash e chama a RPC qr_publica.
// GET /functions/v1/public-qr?codigo=xxx
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

function clienteAnon(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}

function obterIp(req: Request): string {
  // Ordem de preferência: header real, forwarded, x-forwarded-for, fallback
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map((s) => s.trim());
    if (ips.length > 0 && ips[0]) return ips[0];
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  // Fallback: IP da conexão (pode não estar disponível no Deno)
  return '127.0.0.1';
}

async function hashIp(cliente: SupabaseClient, ip: string): Promise<string> {
  const { data, error } = await cliente.rpc('hash_ip', { p_ip: ip });
  if (error) throw new Error(`Erro ao calcular hash do IP: ${error.message}`);
  return data as string;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ erro: 'metodo', mensagem: 'Use GET.' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const codigo = url.searchParams.get('codigo');
    if (!codigo) {
      return new Response(JSON.stringify({ erro: 'pedido', mensagem: 'Parâmetro "codigo" obrigatório.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userAgent = req.headers.get('user-agent') ?? '';

    const cliente = clienteAnon();
    const ip = obterIp(req);
    const ipHash = await hashIp(cliente, ip);

    const { data, error } = await cliente.rpc('qr_publica', {
      p_codigo: codigo,
      p_ip_hash: ipHash,
      p_user_agent: userAgent,
    });

    if (error) throw new Error(`Erro na RPC qr_publica: ${error.message}`);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ erro: 'interno', mensagem }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});