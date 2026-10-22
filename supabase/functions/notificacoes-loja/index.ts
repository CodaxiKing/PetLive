// PetLive: avisos da App Store (App Store Server Notifications V2) e da
// Google Play (Real-time developer notifications, push do Pub/Sub) sobre
// renovação, cancelamento, falha de cobrança, reembolso e expiração
// (BUSINESS.md 5.13 e 20.4).
//
// O aviso só diz QUAL assinatura mudou: o estado é sempre reconsultado na API
// da loja com as credenciais do servidor, então um aviso falso não muda nada.
// URL da App Store: .../notificacoes-loja?loja=app_store
// URL do Pub/Sub:   .../notificacoes-loja?loja=google_play&segredo=<NOTIFICACOES_LOJA_SEGREDO>
import { payloadJws, type EstadoAssinatura } from '../_shared/assinatura-estado.ts';
import { aplicar, clienteServidor, consultarApple, consultarGoogle, resposta, respostaDeErro } from '../_shared/lojas.ts';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const loja = url.searchParams.get('loja');
    const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    let estado: EstadoAssinatura | null = null;

    if (loja === 'app_store' && typeof corpo.signedPayload === 'string') {
      const aviso = payloadJws<{ notificationType?: string; data?: { signedTransactionInfo?: string } }>(corpo.signedPayload);
      if (aviso.notificationType === 'TEST' || !aviso.data?.signedTransactionInfo) return resposta({ ok: true });
      const t = payloadJws<{ transactionId: string }>(aviso.data.signedTransactionInfo);
      estado = await consultarApple(t.transactionId);
    } else if (loja === 'google_play') {
      const segredo = Deno.env.get('NOTIFICACOES_LOJA_SEGREDO') ?? '';
      if (!segredo || url.searchParams.get('segredo') !== segredo) return resposta({ erro: 'nao_autorizado' }, 401);
      const dados = (corpo.message as { data?: string } | undefined)?.data;
      if (!dados) return resposta({ ok: true });
      const aviso = JSON.parse(atob(dados)) as { subscriptionNotification?: { purchaseToken?: string } };
      const token = aviso.subscriptionNotification?.purchaseToken;
      // Aviso de teste do Play Console ou de compra avulsa: nada a fazer.
      if (!token) return resposta({ ok: true });
      estado = await consultarGoogle(token);
    } else {
      return resposta({ erro: 'pedido' }, 400);
    }

    const servidor = clienteServidor();
    // Dono: quem já tem esta assinatura ou, numa compra nova, a conta gravada na loja.
    const { data: existente } = await servidor
      .from('subscriptions')
      .select('user_id')
      .eq('loja', estado.loja)
      .eq('referencia', estado.referencia)
      .maybeSingle();
    let dono = (existente?.user_id as string | undefined) ?? null;
    if (!dono && estado.conta) {
      const { data: perfil } = await servidor.from('profiles').select('id').eq('id', estado.conta).maybeSingle();
      dono = (perfil?.id as string | undefined) ?? null;
    }
    // Sem dono conhecido: o app confirma quando o tutor abrir (validar-compra-loja).
    if (!dono) return resposta({ ok: true, ignorado: true });

    const r = await aplicar(servidor, dono, estado);
    return resposta({ ok: true, status: r.status, plano: r.plano });
  } catch (e) {
    // Erro devolve 5xx: a loja reenvia o aviso mais tarde.
    return respostaDeErro(e);
  }
});
