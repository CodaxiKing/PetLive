// PetLive: confirma no servidor a compra (ou a restauração) do Premium feita
// na loja de apps (BUSINESS.md 5.13). O app manda o comprovante, a função
// consulta a loja e só então grava a assinatura e recalcula o plano.
// Pedido: { compras: [{ loja: 'app_store', transacao } | { loja: 'google_play', token }] }
// Resposta: { plano, status }
import { createClient } from 'npm:@supabase/supabase-js@2';
import { contaConfere, type EstadoAssinatura } from '../_shared/assinatura-estado.ts';
import { ErroLoja, aplicar, clienteServidor, consultarApple, consultarGoogle, resposta, respostaDeErro } from '../_shared/lojas.ts';

type Compra = { loja?: unknown; transacao?: unknown; token?: unknown };

Deno.serve(async (req) => {
  try {
    const autorizacao = req.headers.get('Authorization') ?? '';
    const usuario = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: autorizacao } },
      auth: { persistSession: false },
    });
    const { data: auth } = await usuario.auth.getUser();
    if (!auth.user) return resposta({ erro: 'nao_autorizado' }, 401);

    const corpo = (await req.json().catch(() => ({}))) as { compras?: Compra[] };
    const compras = Array.isArray(corpo.compras) ? corpo.compras.slice(0, 10) : [];
    if (!compras.length) throw new ErroLoja('pedido', 'Nenhuma compra para confirmar.');

    const servidor = clienteServidor();
    let plano: 'gratis' | 'premium' = 'gratis';
    let status: string | null = null;
    let outraConta = false;

    for (const c of compras) {
      let estado: EstadoAssinatura;
      if (c.loja === 'app_store' && typeof c.transacao === 'string') estado = await consultarApple(c.transacao);
      else if (c.loja === 'google_play' && typeof c.token === 'string') estado = await consultarGoogle(c.token);
      else throw new ErroLoja('pedido', 'Compra inválida.');

      // Comprovante de outra conta do PetLive (mesmo Apple ID ou conta Google).
      if (!contaConfere(estado, auth.user.id)) {
        outraConta = true;
        continue;
      }
      try {
        const r = await aplicar(servidor, auth.user.id, estado);
        plano = r.plano === 'premium' ? 'premium' : plano;
        status = status ?? r.status;
      } catch (e) {
        if (e instanceof ErroLoja && e.codigo === 'outra_conta') outraConta = true;
        else throw e;
      }
    }

    if (plano === 'gratis' && outraConta) {
      throw new ErroLoja('outra_conta', 'Esta assinatura está ligada a outra conta do PetLive. Entre com ela para usar o Premium.');
    }
    return resposta({ plano, status });
  } catch (e) {
    return respostaDeErro(e);
  }
});
