// PetLive: envia localização do visitante para o tutor (BUSINESS.md 5.6).
// Edge Function que lê o IP do cliente, calcula o hash e chama a RPC qr_enviar_localizacao.
// POST /functions/v1/qr-location { codigo, lat, lng }
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

function clienteAnon(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}

function obterIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map((s) => s.trim());
    if (ips.length > 0 && ips[0]) return ips[0];
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  return '127.0.0.1';
}

async function hashIp(cliente: SupabaseClient, ip: string): Promise<string> {
  const { data, error } = await cliente.rpc('hash_ip', { p_ip: ip });
  if (error) throw new Error(`Erro ao calcular hash do IP: ${error.message}`);
  return data as string;
}

async function lerCorpo<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error('Pedido sem JSON válido.');
  }
}

function validarNumero(valor: unknown, nome: string): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) throw new Error(`${nome} inválido.`);
  return valor;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ erro: 'metodo', mensagem: 'Use POST.' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const corpo = await lerCorpo<{ codigo: unknown; lat: unknown; lng: unknown }>(req);
    const codigo = corpo.codigo;
    if (typeof codigo !== 'string' || !codigo.trim()) {
      return new Response(JSON.stringify({ erro: 'pedido', mensagem: 'Parâmetro "codigo" obrigatório.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const lat = validarNumero(corpo.lat, 'lat');
    const lng = validarNumero(corpo.lng, 'lng');
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return new Response(JSON.stringify({ erro: 'pedido', mensagem: 'Coordenadas fora do intervalo válido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cliente = clienteAnon();
    const ip = obterIp(req);
    const ipHash = await hashIp(cliente, ip);

    const { data, error } = await cliente.rpc('qr_enviar_localizacao', {
      p_codigo: codigo,
      p_lat: lat,
      p_lng: lng,
      p_ip_hash: ipHash,
    });

    if (error) throw new Error(`Erro na RPC qr_enviar_localizacao: ${error.message}`);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e);
    // Diferencia erros conhecidos
    if (mensagem.includes('Link inválido') || mensagem.includes('expirado')) {
      return new Response(JSON.stringify({ erro: 'nao_encontrado', mensagem }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (mensagem.includes('Muitos envios')) {
      return new Response(JSON.stringify({ erro: 'limite', mensagem }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ erro: 'interno', mensagem }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});