export type Assinatura = {
  id: string; ciclo: 'mensal' | 'anual'; status: 'em_teste' | 'ativa' | 'pagamento_falhou' | 'cancelando' | 'cancelada' | 'expirada';
  periodo_inicio: string; periodo_fim: string;
  forma_pagamento: 'pix' | 'cartao' | 'loja_apps' | null;
  valor_centavos: number | null; moeda: 'BRL'; provedor: 'asaas' | 'google_play' | 'app_store';
};
export type MinhaAssinatura = { plano: 'gratis' | 'premium'; assinatura: Assinatura | null; gestao_disponivel: false };
const estados = { em_teste: 'Em teste', ativa: 'Ativa', pagamento_falhou: 'Pagamento pendente', cancelando: 'Cancelamento agendado', cancelada: 'Cancelada', expirada: 'Expirada' };

export function lerAssinatura(valor: unknown): MinhaAssinatura {
  if (!valor || typeof valor !== 'object') throw new Error('Resposta de assinatura inválida.');
  const r = valor as MinhaAssinatura;
  if (!['gratis', 'premium'].includes(r.plano) || r.gestao_disponivel !== false) throw new Error('Resposta de assinatura inválida.');
  const a = r.assinatura;
  if (a !== null && (!a || typeof a.id !== 'string' || !['mensal', 'anual'].includes(a.ciclo)
    || !Object.hasOwn(estados, a.status) || !['asaas', 'google_play', 'app_store'].includes(a.provedor)
    || ![null, 'pix', 'cartao', 'loja_apps'].includes(a.forma_pagamento)
    || a.moeda !== 'BRL' || (a.valor_centavos !== null && (!Number.isSafeInteger(a.valor_centavos) || a.valor_centavos < 0))
    || !Number.isFinite(Date.parse(a.periodo_inicio)) || !Number.isFinite(Date.parse(a.periodo_fim))
    || Date.parse(a.periodo_inicio) >= Date.parse(a.periodo_fim))) throw new Error('Dados da assinatura indisponíveis.');
  return r;
}

export function resumoAssinatura(a: Assinatura, agora = Date.now()) {
  const fim = new Date(a.periodo_fim);
  const data = fim.toLocaleDateString('pt-BR');
  const vencida = fim.getTime() <= agora;
  let periodo: string;
  if (vencida) periodo = `Período encerrado em ${data}`;
  else if (a.status === 'cancelando') periodo = `Cancelamento agendado para ${data}. O período já pago é preservado.`;
  else if (a.status === 'cancelada' || a.status === 'expirada') periodo = `Último período informado: até ${data}`;
  else if (a.status === 'em_teste') periodo = `Teste até ${data}`;
  else if (a.status === 'pagamento_falhou') periodo = `Pagamento pendente. Fim do período registrado: ${data}`;
  else periodo = `Próxima renovação prevista: ${data}`;
  return {
    status: vencida && ['em_teste', 'ativa', 'cancelando', 'pagamento_falhou'].includes(a.status) ? 'Período encerrado' : estados[a.status],
    periodo,
    pagamento: a.forma_pagamento === 'pix' ? 'Pix' : a.forma_pagamento === 'cartao' ? 'Cartão' : a.forma_pagamento === 'loja_apps' ? 'Loja de aplicativos' : 'Não informado',
    valor: a.valor_centavos === null ? 'Valor não informado' : (a.valor_centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
  };
}
