import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarIntegracoes } from '../functions/integracoes-verificar/verificar.mjs';
test('nega antes de consultar ambiente ou rede', async () => {
  await assert.rejects(verificarIntegracoes({ rpc: async () => ({ error: true }) }, () => assert.fail(), () => assert.fail()), /negado/);
});
test('consulta os jobs e faz somente OPTIONS num destino fixo sem credenciais', async () => {
  const r = await verificarIntegracoes({ rpc: async nome => ({ data: { nome } }) }, () => 'segredo', async (url, opcoes) => {
    assert.equal(url, 'https://exp.host/--/api/v2/push/getReceipts'); assert.equal(opcoes.method, 'OPTIONS');
    assert.equal(opcoes.headers, undefined); assert.equal(opcoes.body, undefined);
    return new Response(null, { status: 204 });
  });
  assert.equal(r.gateway_push.estado, 'respondendo'); assert.equal(r.credenciais_push, 'nao_verificadas');
  assert.equal(r.configuracao.google_places, true); assert.ok(!JSON.stringify(r).includes('segredo'));
});
test('falha externa não vira integração operacional e não oculta o diagnóstico local', async () => {
  const r = await verificarIntegracoes({ rpc: async () => ({ data: { ok: true } }) }, () => undefined, async () => { throw new Error('segredo'); });
  assert.equal(r.gateway_push.estado, 'indisponivel'); assert.deepEqual(r.operacao, { ok: true });
});
