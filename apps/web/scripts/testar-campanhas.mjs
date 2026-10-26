import assert from 'node:assert/strict';
import { test } from 'node:test';
import { amanha9h, criarTravaCampanha, horarioEnvio, horarioLocal } from '../src/lib/admin/campanhas.ts';

for (const fuso of ['America/Sao_Paulo', 'America/New_York', 'Europe/Lisbon']) {
  test(`agendamento no fuso ${fuso}`, () => {
    const anterior = process.env.TZ;
    process.env.TZ = fuso;
    try {
      const agora = new Date('2026-10-26T12:00:00');
      const iso = horarioEnvio('2026-10-27T09:15', agora);
      assert.equal(horarioLocal(new Date(iso)), '2026-10-27T09:15');
      assert.equal(amanha9h(new Date('2026-12-31T23:55:00')), '2027-01-01T09:00');
      assert.equal(amanha9h(new Date('2028-02-28T23:55:00')), '2028-02-29T09:00');
      assert.equal(amanha9h(new Date('2026-03-07T23:55:00')), '2026-03-08T09:00');
      assert.equal(amanha9h(new Date('2026-10-31T23:55:00')), '2026-11-01T09:00');
      for (const invalida of ['', 'texto', '2027-02-31T09:00', '2027-13-01T09:00', '2027-01-01T24:00', '2027-01-01T12:60', '2027-01-01', '2027-01-01T09:00Z']) {
        assert.throws(() => horarioEnvio(invalida, agora), /Informe/);
      }
      assert.throws(() => horarioEnvio('2026-10-26T12:00', agora), /futuro/);
      assert.throws(() => horarioEnvio('2026-10-25T12:00', agora), /futuro/);
      assert.throws(() => horarioLocal(new Date('inválida')), /válida/);
      if (fuso === 'America/New_York') {
        // O offset da campanha em julho difere do offset da data de edição.
        assert.equal(horarioLocal(new Date('2027-07-01T13:00:00Z')), '2027-07-01T09:00');
        assert.equal(horarioLocal(new Date('2027-01-01T14:00:00Z')), '2027-01-01T09:00');
        assert.throws(() => horarioEnvio('2027-03-14T02:30', agora), /válidos/);
      }
    } finally {
      if (anterior === undefined) delete process.env.TZ;
      else process.env.TZ = anterior;
    }
  });
}

test('duplo clique executa uma única ação e libera depois do sucesso', async () => {
  const executar = criarTravaCampanha();
  let liberar;
  let chamadas = 0;
  const primeira = executar(async () => {
    chamadas++;
    await new Promise((resolve) => { liberar = resolve; });
  });
  assert.equal(await executar(async () => { chamadas++; }), false);
  assert.equal(chamadas, 1);
  liberar();
  assert.equal(await primeira, true);
  assert.equal(await executar(async () => { chamadas++; }), true);
  assert.equal(chamadas, 2);
});

test('falha de validação ou requisição libera a próxima tentativa', async () => {
  const executar = criarTravaCampanha();
  await assert.rejects(executar(async () => { throw new Error('falha'); }), /falha/);
  assert.equal(await executar(async () => {}), true);
});
