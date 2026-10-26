import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processarExclusao } from '../functions/lgpd-delete/processar.mjs';
const pedido = { pedido_id: '11111111-1111-4111-8111-111111111111', user_id: '22222222-2222-4222-8222-222222222222', lease: '33333333-3333-4333-8333-333333333333' };
function cliente(falha) {
  const chamadas = [];
  return { chamadas, async rpc(nome) {
    chamadas.push(nome);
    if (nome === 'lgpd_exclusao_reivindicar') return { data: [pedido] };
    return { error: nome === falha ? new Error('segredo-do-provedor') : null };
  }, storage: { async listBuckets() { return { data: [{ id: 'perfis' }, { id: 'novo-bucket' }] }; },
    from() { return { async list() { if (falha === 'storage') throw new Error('segredo-do-provedor'); return { data: [] }; } }; } } };
}
test('conclui somente após inventariar todos os buckets e renovar a reserva', async () => {
  const c = cliente(); assert.deepEqual(await processarExclusao(c), { processados: 1, concluidos: 1, retentar: false });
  assert.equal(c.chamadas.at(-1), 'lgpd_exclusao_concluir');
  assert.ok(c.chamadas.filter(n => n === 'lgpd_exclusao_renovar').length >= 4);
});
test('falha/lease vencida não concluem nem expõem erro privado', async () => {
  for (const falha of ['storage', 'lgpd_exclusao_renovar']) {
    const c = cliente(falha); const r = await processarExclusao(c);
    assert.equal(r.retentar, true); assert.ok(!c.chamadas.includes('lgpd_exclusao_concluir'));
    assert.ok(!JSON.stringify(r).includes('segredo'));
  }
});
test('recusa uma fila com mais de uma reserva e dados inválidos', async () => {
  await assert.rejects(processarExclusao({ rpc: async () => ({ data: [pedido, pedido] }) }), /inválida/);
  await assert.rejects(processarExclusao({ rpc: async () => ({ data: [{ ...pedido, user_id: '../outra' }] }) }), /inválida/);
});
