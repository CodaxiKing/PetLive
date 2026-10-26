/** Sonda fixa e sem payload: não envia push, coordenadas ou credenciais a terceiros. */
export async function verificarIntegracoes(cliente, ambiente, requisitar = fetch) {
  // A autorização AAL2/papel acontece antes de consultar ambiente ou serviços.
  const { data: inventario, error } = await cliente.rpc('admin_integracoes');
  if (error) throw new Error('Acesso administrativo negado.');
  const { data: operacao, error: erroOperacao } = await cliente.rpc('admin_integracoes_diagnostico');
  if (erroOperacao) throw new Error('Instale o diagnóstico de integrações e tente novamente.');
  const inicio = Date.now();
  let gateway;
  try {
    const resposta = await requisitar('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'OPTIONS', signal: AbortSignal.timeout(3000), redirect: 'error',
    });
    gateway = { estado: resposta.ok || resposta.status === 405 ? 'respondendo' : 'falha_http', http: resposta.status };
    await resposta.body?.cancel();
  } catch { gateway = { estado: 'indisponivel', http: null }; }
  return { inventario, operacao, gateway_push: { ...gateway, latencia_ms: Date.now() - inicio },
    configuracao: { google_places: Boolean(ambiente('GOOGLE_PLACES_KEY')), leitura_fotos: Boolean(ambiente('ANTHROPIC_API_KEY')) },
    credenciais_push: 'nao_verificadas', cobranca: 'adiada' };
}
