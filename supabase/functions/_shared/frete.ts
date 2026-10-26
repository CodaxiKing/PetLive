/** Preparação da Fase 3 (BUSINESS.md 5.8). Não cria pedidos nem cobra. */
type Prazo = { minimo: number; maximo: number };
type Taxa = { taxaCentavos: number; prazoMinutos: Prazo };
type Base = {
  entregaAtiva: true;
  retiradaAtiva: boolean;
  raioMaximoMetros: number;
  pedidoMinimoCentavos: number;
  freteGratisAcimaDeCentavos: number | null;
};
export type ConfiguracaoFrete =
  | { entregaAtiva: false; retiradaAtiva: boolean }
  | (Base & Taxa & { modo: 'fixa' })
  | (Base & { modo: 'bairro'; bairros: (Taxa & { id: string; ativo: boolean })[] })
  | (Base & { modo: 'distancia'; faixas: (Taxa & { ateMetros: number })[] });

export type ConsultaFrete = {
  /** Subtotal de produtos calculado pelo servidor; não inclui entrega. */
  subtotalProdutosCentavos: number;
  /** Distância validada no servidor; null enquanto o endereço não foi validado. */
  distanciaMetros: number | null;
  /** Identificador exato da área validada, nunca aproximação pelo nome digitado. */
  bairroId?: string | null;
};
export type MotivoFrete = 'configuracao_invalida' | 'dados_invalidos' | 'entrega_desativada'
  | 'endereco_nao_validado' | 'fora_do_raio' | 'bairro_nao_atendido' | 'pedido_abaixo_do_minimo';
export type CotacaoFrete =
  | { disponivel: false; motivo: MotivoFrete; retiradaHabilitada: boolean }
  | { disponivel: true; taxaCentavos: number; freteGratis: boolean; prazoMinutos: Prazo; retiradaHabilitada: boolean };

function registro(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
const inteiro = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
function taxa(v: unknown): boolean {
  if (!registro(v) || !inteiro(v.taxaCentavos) || !registro(v.prazoMinutos)) return false;
  return inteiro(v.prazoMinutos.minimo) && inteiro(v.prazoMinutos.maximo) && v.prazoMinutos.maximo >= v.prazoMinutos.minimo;
}
function configuracao(v: unknown): v is ConfiguracaoFrete {
  if (!registro(v) || typeof v.entregaAtiva !== 'boolean' || typeof v.retiradaAtiva !== 'boolean') return false;
  if (!v.entregaAtiva) return true;
  if (!inteiro(v.raioMaximoMetros) || v.raioMaximoMetros === 0 || !inteiro(v.pedidoMinimoCentavos) ||
    (v.freteGratisAcimaDeCentavos !== null && !inteiro(v.freteGratisAcimaDeCentavos))) return false;
  if (v.modo === 'fixa') return taxa(v);
  if (v.modo === 'bairro') {
    if (!Array.isArray(v.bairros) || !v.bairros.length) return false;
    const ids = new Set<string>();
    for (const b of v.bairros) {
      if (!registro(b) || typeof b.id !== 'string' || !b.id.trim() || b.id !== b.id.trim() ||
        ids.has(b.id) || typeof b.ativo !== 'boolean' || !taxa(b)) return false;
      ids.add(b.id);
    }
    return true;
  }
  if (v.modo === 'distancia') {
    if (!Array.isArray(v.faixas) || !v.faixas.length) return false;
    let anterior = 0;
    for (const f of v.faixas) {
      if (!registro(f) || !inteiro(f.ateMetros) || f.ateMetros <= anterior || f.ateMetros > v.raioMaximoMetros || !taxa(f)) return false;
      anterior = f.ateMetros;
    }
    return anterior === v.raioMaximoMetros;
  }
  return false;
}
function consulta(v: unknown): v is ConsultaFrete {
  return registro(v) && inteiro(v.subtotalProdutosCentavos) &&
    (v.distanciaMetros === null || inteiro(v.distanciaMetros)) &&
    (v.bairroId === undefined || v.bairroId === null || (typeof v.bairroId === 'string' && Boolean(v.bairroId.trim())));
}

/**
 * Sem floats monetários, arredondamento implícito ou inferência de endereço.
 * Regras de cobertura/mínimo são conferidas antes da isenção. “Acima de” é
 * estrito (>); no limite exato o frete continua sendo cobrado.
 * O chamador deve carregar configuração, subtotal e distância confiáveis.
 */
export function calcularFrete(config: unknown, pedido: unknown): CotacaoFrete {
  if (!configuracao(config)) return { disponivel: false, motivo: 'configuracao_invalida', retiradaHabilitada: false };
  const negar = (motivo: MotivoFrete): CotacaoFrete => ({ disponivel: false, motivo, retiradaHabilitada: config.retiradaAtiva });
  if (!consulta(pedido)) return negar('dados_invalidos');
  if (!config.entregaAtiva) return negar('entrega_desativada');
  const distancia = pedido.distanciaMetros;
  if (distancia === null) return negar('endereco_nao_validado');
  if (distancia > config.raioMaximoMetros) return negar('fora_do_raio');
  let escolhida: Taxa;
  if (config.modo === 'fixa') escolhida = config;
  else if (config.modo === 'bairro') {
    const bairro = config.bairros.find(b => b.id === pedido.bairroId && b.ativo);
    if (!bairro) return negar('bairro_nao_atendido');
    escolhida = bairro;
  } else {
    // Validação exige faixas crescentes e cobertura até o raio máximo.
    const faixa = config.faixas.find(f => distancia <= f.ateMetros);
    if (!faixa) return negar('configuracao_invalida');
    escolhida = faixa;
  }
  if (pedido.subtotalProdutosCentavos < config.pedidoMinimoCentavos) return negar('pedido_abaixo_do_minimo');
  const isento = config.freteGratisAcimaDeCentavos !== null && pedido.subtotalProdutosCentavos > config.freteGratisAcimaDeCentavos;
  const valor = isento ? 0 : escolhida.taxaCentavos;
  return { disponivel: true, taxaCentavos: valor, freteGratis: valor === 0,
    prazoMinutos: { ...escolhida.prazoMinutos }, retiradaHabilitada: config.retiradaAtiva };
}
