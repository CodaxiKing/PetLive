import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFrete } from '../functions/_shared/frete.ts';

// Valores exclusivamente sintéticos, não são preços/defaults comerciais.
const taxa = (taxaCentavos = 750, minimo = 20, maximo = 40) => ({ taxaCentavos, prazoMinutos: { minimo, maximo } });
const base = { entregaAtiva: true, retiradaAtiva: true, raioMaximoMetros: 5000, pedidoMinimoCentavos: 2000, freteGratisAcimaDeCentavos: null };
const fixa = { ...base, modo: 'fixa', ...taxa() };
const pedido = { subtotalProdutosCentavos: 5000, distanciaMetros: 2000 };
const motivo = (config, p, esperado) => assert.deepEqual(calcularFrete(config,p), { disponivel: false, motivo: esperado, retiradaHabilitada: config.retiradaAtiva });

test('taxa fixa aceita o limite do raio e devolve valor/prazo em inteiros', () => {
  assert.deepEqual(calcularFrete(fixa,{ ...pedido, distanciaMetros: 5000 }), { disponivel: true, ...taxa(), freteGratis: false, retiradaHabilitada: true });
  motivo(fixa,{ ...pedido, distanciaMetros: 5001 },'fora_do_raio');
  assert.equal(calcularFrete(fixa,{ ...pedido, distanciaMetros: 0 }).taxaCentavos,750);
});
test('não considera entrega disponível sem endereço validado ou com entrega desligada', () => {
  motivo(fixa,{ ...pedido, distanciaMetros: null },'endereco_nao_validado');
  motivo({ entregaAtiva: false, retiradaAtiva: true },pedido,'entrega_desativada');
  motivo({ entregaAtiva: false, retiradaAtiva: false },pedido,'entrega_desativada');
});
test('mínimo é inclusivo; frete grátis acima do limiar é estrito e não inclui a taxa', () => {
  const c = { ...fixa, freteGratisAcimaDeCentavos: 10000 };
  motivo(c,{ ...pedido, subtotalProdutosCentavos: 1999 },'pedido_abaixo_do_minimo');
  assert.equal(calcularFrete(c,{ ...pedido, subtotalProdutosCentavos: 2000 }).taxaCentavos,750);
  assert.equal(calcularFrete(c,{ ...pedido, subtotalProdutosCentavos: 10000 }).taxaCentavos,750);
  assert.equal(calcularFrete(c,{ ...pedido, subtotalProdutosCentavos: 10001 }).taxaCentavos,0);
  assert.equal(calcularFrete({ ...fixa, freteGratisAcimaDeCentavos: 0 },pedido).taxaCentavos,0);
});
test('isenção não libera raio, bairro, endereço ou mínimo inválidos', () => {
  const c = { ...fixa, freteGratisAcimaDeCentavos: 0 };
  motivo(c,{ ...pedido, distanciaMetros: 5001 },'fora_do_raio');
  motivo(c,{ ...pedido, distanciaMetros: null },'endereco_nao_validado');
  motivo(c,{ ...pedido, subtotalProdutosCentavos: 1 },'pedido_abaixo_do_minimo');
  motivo({ ...base, modo: 'bairro', freteGratisAcimaDeCentavos: 0, bairros: [{ id: 'centro', ativo: false, ...taxa() }] },{ ...pedido, bairroId: 'centro' },'bairro_nao_atendido');
});
test('bairro usa ID exato, ativação e prazo próprios; nenhum fallback gratuito', () => {
  const c = { ...base, modo: 'bairro', bairros: [{ id: 'centro', ativo: true, ...taxa(900,30,60) }, { id: 'norte', ativo: false, ...taxa() }] };
  assert.deepEqual(calcularFrete(c,{ ...pedido, bairroId: 'centro' }),{ disponivel: true, ...taxa(900,30,60), freteGratis: false, retiradaHabilitada: true });
  for (const bairroId of ['Centro',' centro','norte','desconhecido',null]) motivo(c,{ ...pedido, bairroId },'bairro_nao_atendido');
});
test('faixas usam limites superiores inclusivos sem sobreposição', () => {
  const c = { ...base, modo: 'distancia', faixas: [{ ateMetros: 2000, ...taxa(500) },{ ateMetros: 5000, ...taxa(1200,40,80) }] };
  for (const distanciaMetros of [0,1999,2000]) assert.equal(calcularFrete(c,{ ...pedido, distanciaMetros }).taxaCentavos,500);
  for (const distanciaMetros of [2001,4999,5000]) assert.equal(calcularFrete(c,{ ...pedido, distanciaMetros }).taxaCentavos,1200);
  motivo(c,{ ...pedido, distanciaMetros: 5001 },'fora_do_raio');
});
test('configurações incompletas, negativas, ambíguas ou sem cobertura falham fechadas', () => {
  const faixa = (ateMetros) => ({ ateMetros, ...taxa() });
  const bairros = [{ id: 'centro', ativo: true, ...taxa() }];
  const configs = [null,{},[], { ...fixa, taxaCentavos: -1 }, { ...fixa, taxaCentavos: 1.5 },
    { ...fixa, prazoMinutos: { minimo: 40, maximo: 20 } }, { ...fixa, prazoMinutos: null },
    { ...fixa, freteGratisAcimaDeCentavos: undefined }, { ...fixa, raioMaximoMetros: 0 },
    { ...base, modo: 'distancia', faixas: [] }, { ...base, modo: 'distancia', faixas: [faixa(4000)] },
    { ...base, modo: 'distancia', faixas: [faixa(5000),faixa(2000)] },
    { ...base, modo: 'distancia', faixas: [faixa(2000),faixa(2000),faixa(5000)] },
    { ...base, modo: 'distancia', faixas: [faixa(6000)] },
    { ...base, modo: 'bairro', bairros: [...bairros,...bairros] },
    { ...base, modo: 'bairro', bairros: [{ ...bairros[0], id: ' centro' }] }, { ...base, modo: 'outro' }];
  for (const c of configs) assert.deepEqual(calcularFrete(c,pedido),{ disponivel: false, motivo: 'configuracao_invalida', retiradaHabilitada: false });
});
test('não converte silenciosamente números monetários, distâncias ou valores não finitos', () => {
  for (const valor of [-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1,'100',undefined]) {
    motivo(fixa,{ ...pedido, subtotalProdutosCentavos: valor },'dados_invalidos');
    motivo(fixa,{ ...pedido, distanciaMetros: valor },'dados_invalidos');
    assert.equal(calcularFrete({ ...fixa, taxaCentavos: valor },pedido).motivo,'configuracao_invalida');
  }
});
test('taxa zero configurada é válida e resultado não altera entrada nem compartilha prazo', () => {
  const c = { ...fixa, ...taxa(0) };
  const antes = JSON.stringify(c);
  const r = calcularFrete(c,pedido);
  assert.equal(r.freteGratis,true);assert.equal(r.taxaCentavos,0);
  r.prazoMinutos.minimo=999;
  assert.equal(JSON.stringify(c),antes);
});
