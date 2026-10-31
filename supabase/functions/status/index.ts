// PetLive: status da operação para a página de status (apps/status).
// Pública (verify_jwt = false) e só de leitura: confere cada parte do
// serviço e devolve operante, lenta ou fora, com o tempo de resposta.
// Nunca devolve dado de usuário nem detalhe de erro interno.
import { provedorPadrao } from '../_shared/pagamentos/provedor.ts';

type Estado = 'operante' | 'lenta' | 'fora' | 'nao_configurado';
type Componente = { id: string; nome: string; estado: Estado; ms: number | null };

const URL_SUPABASE = Deno.env.get('SUPABASE_URL') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const LENTO_MS = 2500;
const LIMITE_MS = 8000;

const cabecalhos = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, content-type',
  'Cache-Control': 'public, max-age=20',
};

async function medir(id: string, nome: string, testar: () => Promise<boolean | 'nao_configurado'>): Promise<Componente> {
  const inicio = Date.now();
  try {
    const ok = await Promise.race([
      testar(),
      new Promise<false>((r) => setTimeout(() => r(false), LIMITE_MS)),
    ]);
    const ms = Date.now() - inicio;
    if (ok === 'nao_configurado') return { id, nome, estado: 'nao_configurado', ms: null };
    return { id, nome, estado: !ok ? 'fora' : ms > LENTO_MS ? 'lenta' : 'operante', ms };
  } catch {
    return { id, nome, estado: 'fora', ms: Date.now() - inicio };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cabecalhos });
  let manutencao: unknown = { ativa: false };

  const componentes = await Promise.all([
    medir('api', 'App e banco de dados', async () => {
      const r = await fetch(`${URL_SUPABASE}/rest/v1/rpc/status_publico`, {
        method: 'POST',
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!r.ok) return false;
      const corpo = await r.json();
      manutencao = corpo?.manutencao ?? manutencao;
      return corpo?.banco === 'ok';
    }),
    medir('login', 'Login e contas', async () => (await fetch(`${URL_SUPABASE}/auth/v1/health`, { headers: { apikey: ANON } })).ok),
    medir('arquivos', 'Fotos e arquivos', async () =>
      (await fetch(`${URL_SUPABASE}/storage/v1/bucket`, { headers: { apikey: SERVICO, Authorization: `Bearer ${SERVICO}` } })).ok),
    medir('pagamentos', 'Pagamentos por Pix', async () => {
      if (!Deno.env.get('ASAAS_API_KEY')) return 'nao_configurado';
      return await provedorPadrao().saude();
    }),
    medir('funcoes', 'Funções do servidor', async () => true),
  ]);

  const fora = componentes.filter((c) => c.estado === 'fora').length;
  const lenta = componentes.some((c) => c.estado === 'lenta');
  const geral = (manutencao as { ativa?: boolean })?.ativa ? 'manutencao' : fora ? (fora === componentes.length - 1 ? 'fora' : 'parcial') : lenta ? 'lenta' : 'operante';
  return new Response(JSON.stringify({ geral, componentes, manutencao, verificado_em: new Date().toISOString() }), { headers: cabecalhos });
});
