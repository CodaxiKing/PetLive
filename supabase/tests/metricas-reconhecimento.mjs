const ORDEM = { muito_parecido: 0, parecido: 1, pouco_parecido: 2, diferente: 3 };

export function embaralhar(lista, semente) {
  let estado = 2166136261;
  for (const letra of String(semente)) estado = Math.imul(estado ^ letra.charCodeAt(0), 16777619) >>> 0;
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
    const j = estado % (i + 1); [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function validarCriterios(c) {
  if (!c || !Array.isArray(c.especies) || !c.especies.length || c.especies.some(e => !['cao', 'gato'].includes(e)) || new Set(c.especies).size !== c.especies.length) throw new Error('Defina as espécies avaliadas nos critérios.');
  for (const campo of ['minPositivos', 'minNegativos']) if (!Number.isInteger(c[campo]) || c[campo] < 1) throw new Error(`Critério inválido: ${campo}.`);
  for (const campo of ['minRecall', 'minTop1', 'maxFalsoPositivo', 'maxFalhas', 'maxRecusas']) if (!Number.isFinite(c[campo]) || c[campo] < 0 || c[campo] > 1) throw new Error(`Critério inválido: ${campo}.`);
  return c;
}

/** Recusas e falhas contam no denominador; empates não contam como top 1. */
export function avaliarReconhecimento(casos, criterios) {
  validarCriterios(criterios);
  const ids = new Set();
  for (const caso of casos) {
    if (typeof caso.id !== 'string' || !caso.id || ids.has(caso.id) || !['cao', 'gato'].includes(caso.especie) || !Array.isArray(caso.candidatos) || !caso.candidatos.length ||
      new Set(caso.candidatos.map(c => c.id)).size !== caso.candidatos.length || caso.candidatos.some(c => typeof c.id !== 'string' || !c.id || !Object.hasOwn(ORDEM, c.nivel)) ||
      (caso.esperado !== null && !caso.candidatos.some(c => c.id === caso.esperado))) throw new Error('Caso incompleto, repetido ou com classificação inválida.');
    ids.add(caso.id);
  }
  const especies = criterios.especies.map(especie => {
    const lista = casos.filter(c => c.especie === especie);
    const positivos = lista.filter(c => c.esperado !== null).length;
    const negativos = lista.length - positivos;
    let acertos = 0, top1 = 0, falsos = 0, falhas = 0, recusas = 0;
    for (const caso of lista) {
      if (caso.erro) { falhas++; continue; }
      if (!caso.fotoValida) { recusas++; continue; }
      const recomendados = caso.candidatos.filter(c => ORDEM[c.nivel] <= 1);
      if (caso.esperado === null) { if (recomendados.length) falsos++; continue; }
      const certo = recomendados.find(c => c.id === caso.esperado);
      if (certo) {
        acertos++;
        if (recomendados.every(c => c.id === certo.id || ORDEM[c.nivel] > ORDEM[certo.nivel])) top1++;
      }
    }
    const recall = positivos ? acertos / positivos : 0;
    const taxaTop1 = positivos ? top1 / positivos : 0;
    const falsoPositivo = negativos ? falsos / negativos : 1;
    const problemas = [];
    if (positivos < criterios.minPositivos) problemas.push('amostra positiva insuficiente');
    if (negativos < criterios.minNegativos) problemas.push('amostra negativa insuficiente');
    if (recall < criterios.minRecall) problemas.push('recall abaixo do critério');
    if (taxaTop1 < criterios.minTop1) problemas.push('top 1 abaixo do critério');
    if (falsoPositivo > criterios.maxFalsoPositivo) problemas.push('falsos positivos acima do critério');
    if (!lista.length || falhas / lista.length > criterios.maxFalhas) problemas.push('falhas acima do critério');
    if (!lista.length || recusas / lista.length > criterios.maxRecusas) problemas.push('recusas acima do critério');
    return { especie, casos: lista.length, positivos, negativos, acertos, top1, falsos, falhas, recusas, recall, taxaTop1, falsoPositivo, problemas };
  });
  return { aprovadoPelosCriterios: especies.every(e => !e.problemas.length), especies };
}
