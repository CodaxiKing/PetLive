import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliarReconhecimento, embaralhar, validarCriterios } from './metricas-reconhecimento.mjs';
const criterios = { especies: ['cao'], minPositivos: 1, minNegativos: 1, minRecall: 1, minTop1: 1, maxFalsoPositivo: 0, maxFalhas: 0, maxRecusas: 0 };
const positivo = { id: 'p', especie: 'cao', esperado: 'mesmo', fotoValida: true, candidatos: [{ id: 'mesmo', nivel: 'muito_parecido' }, { id: 'outro', nivel: 'diferente' }] };
const negativo = { id: 'n', especie: 'cao', esperado: null, fotoValida: true, candidatos: [{ id: 'outro', nivel: 'diferente' }] };
test('amostra vazia e espécies ausentes nunca aprovam', () => {
  assert.equal(avaliarReconhecimento([], criterios).aprovadoPelosCriterios, false);
  assert.equal(avaliarReconhecimento([positivo, negativo], { ...criterios, especies: ['cao', 'gato'] }).aprovadoPelosCriterios, false);
});
test('recusa e falha do modelo não desaparecem dos denominadores', () => {
  for (const extras of [{ fotoValida: false }, { erro: true }]) {
    const r = avaliarReconhecimento([{ ...positivo, ...extras }, negativo], criterios);
    assert.equal(r.aprovadoPelosCriterios, false); assert.equal(r.especies[0].positivos, 1); assert.equal(r.especies[0].recall, 0);
  }
});
test('empate não melhora top1 e falso positivo parecido também conta', () => {
  const empate = { ...positivo, candidatos: positivo.candidatos.map(c => ({ ...c, nivel: 'muito_parecido' })) };
  assert.equal(avaliarReconhecimento([empate, negativo], criterios).especies[0].top1, 0);
  const falso = { ...negativo, candidatos: [{ id: 'outro', nivel: 'parecido' }] };
  assert.equal(avaliarReconhecimento([positivo, falso], criterios).especies[0].falsoPositivo, 1);
  assert.equal(avaliarReconhecimento([positivo, negativo], criterios).aprovadoPelosCriterios, true);
});
test('rejeita casos repetidos, esperado ausente e critérios inválidos', () => {
  assert.throws(() => avaliarReconhecimento([positivo, positivo], criterios));
  assert.throws(() => avaliarReconhecimento([{ ...positivo, esperado: 'ausente' }], criterios));
  assert.throws(() => validarCriterios({ ...criterios, minPositivos: 0 }));
  assert.throws(() => validarCriterios({ ...criterios, maxFalhas: NaN }));
});
test('embaralhamento tem ordem reproduzível sem modificar a entrada', () => {
  const lista = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.deepEqual(embaralhar(lista, 'execucao1'), embaralhar(lista, 'execucao1'));
  assert.notDeepEqual(embaralhar(lista, 'execucao1'), embaralhar(lista, 'execucao2'));
  assert.deepEqual(lista, [1, 2, 3, 4, 5, 6, 7, 8]);
});
