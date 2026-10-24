import { createClient } from 'npm:@supabase/supabase-js@2';
import { consultaOSM, converterOSM, validarRegiao } from '../_shared/descoberta-osm.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const responder = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { ...cors, 'Cache-Control': 'no-store' } });
const regioes = new Map<string, { expira: number; consulta: Promise<unknown[]> }>();
const usuarios = new Map<string, number[]>();
const campos = 'id,nome,categoria,endereco,telefone,horario,website,lat,lng,aberto_24h,aceita_caes,aceita_gatos,area_caes,fonte';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return responder({ mensagem: 'Use POST.' }, 405);
  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return responder({ mensagem: 'Entre na sua conta.' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return responder({ mensagem: 'Sessão inválida.' }, 401);
    let regiao;
    try { regiao = validarRegiao(await req.json()); } catch { return responder({ mensagem: 'Região inválida.' }, 400); }
    const agora = Date.now();
    for (const [chave, item] of regioes) if (item.expira <= agora) regioes.delete(chave);
    for (const [id, consultas] of usuarios) if (consultas.every((quando) => quando < agora - 60_000)) usuarios.delete(id);
    const guardado = regioes.get(regiao.chave);
    if (guardado) return responder({ lugares: await guardado.consulta });
    const recentes = (usuarios.get(user.id) ?? []).filter((quando) => quando > agora - 60_000);
    if (recentes.length >= 12) return responder({ mensagem: 'Aguarde alguns segundos antes de buscar outra região.' }, 429);
    usuarios.set(user.id, [...recentes, agora]);
    const consulta = (async () => {
      // Endpoint histórico do serviço Private.coffee; substituível por instância própria.
      const url = Deno.env.get('OVERPASS_URL') || 'https://overpass.kumi.systems/api/interpreter';
      const resposta = await fetch(url, { method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'PetLive/1.0 (https://github.com/CodaxiKing/PetLive)' },
        body: new URLSearchParams({ data: consultaOSM(regiao) }), signal: AbortSignal.timeout(22_000) });
      if (!resposta.ok) throw new Error(`Provedor indisponível (${resposta.status}).`);
      const dados = await resposta.json();
      if (dados.remark || !Array.isArray(dados.elements)) throw new Error('Consulta pública incompleta.');
      const linhas = converterOSM(dados.elements);
      if (!linhas.length) return [];
      const { data, error } = await admin.from('places').upsert(linhas, { onConflict: 'fonte,fonte_id' }).select(campos);
      if (error) throw error;
      return data ?? [];
    })();
    // Uma chamada por região por worker; filtros reutilizam a mesma consulta.
    if (regioes.size >= 100) regioes.delete(regioes.keys().next().value!);
    regioes.set(regiao.chave, { expira: agora + 3_600_000, consulta });
    try { return responder({ lugares: await consulta }); }
    catch (erro) { regioes.delete(regiao.chave); throw erro; }
  } catch (erro) {
    console.error('[discover-places]', erro instanceof Error ? erro.message : String((erro as { message?: string })?.message ?? 'Falha de consulta'));
    return responder({ mensagem: 'Não foi possível atualizar os dados públicos desta região.' }, 503);
  }
});
