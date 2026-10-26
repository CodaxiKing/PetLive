import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularHorariosLivres as calcular } from '../functions/_shared/horarios.ts';
const minuto = 60000;
const hora = n => n*60*minuto;
const periodo = (inicio,fim) => ({ inicio: hora(inicio),fim: hora(fim) });
const base = { dia: periodo(0,24), agora: hora(8), aberturas: [periodo(9,11)], folgas: [], reservas: [], duracaoMinutos: 30, intervaloMinutos: 0, capacidade: 2, vagasSolicitadas: 1 };
const inicios = c => calcular(c).horarios.map(h=>h.inicio/hora(1));
test('grade respeita abertura, duração, agora e fechamento', () => {
  assert.deepEqual(inicios(base),[9,9.5,10,10.5]);
  assert.deepEqual(inicios({ ...base, agora: hora(9.5) }),[9.5,10,10.5]);
  assert.deepEqual(inicios({ ...base, agora: hora(12) }),[]);
});
test('intervalo de limpeza entra no passo e precisa caber antes do fechamento', () => {
  const r = calcular({ ...base, duracaoMinutos: 40, intervaloMinutos: 20 }).horarios;
  assert.deepEqual(r.map(h=>[h.inicio,h.fim,h.ocupadoAte]),[[hora(9),hora(9)+40*minuto,hora(10)],[hora(10),hora(10)+40*minuto,hora(11)]]);
  assert.deepEqual(inicios({ ...base, duracaoMinutos: 120, intervaloMinutos: 1 }),[]);
});
test('folga bloqueia serviço e limpeza, com limites semiabertos', () => {
  assert.deepEqual(inicios({ ...base, folgas: [periodo(9.5,10)] }),[9,10,10.5]);
  assert.deepEqual(inicios({ ...base, duracaoMinutos: 20, intervaloMinutos: 10, folgas: [periodo(9+25/60,9.5)] }),[9.5,10,10.5]);
});
test('capacidade usa pico simultâneo, sem somar reservas sequenciais', () => {
  const c = { ...base, duracaoMinutos: 60, reservas: [{ id: 'a',...periodo(9,9.5),vagas: 1 },{ id: 'b',...periodo(9.5,10),vagas: 1 }] };
  assert.equal(calcular(c).horarios[0].vagasLivres,1);
  assert.deepEqual(inicios({ ...c, vagasSolicitadas: 2 }),[10]);
});
test('reservas sobrepostas e quantidade solicitada respeitam o pico', () => {
  const reservas = [{ id: 'a',...periodo(9,10),vagas: 1 },{ id: 'b',...periodo(9.5,10.5),vagas: 1 }];
  assert.deepEqual(inicios({ ...base, reservas }),[9,10,10.5]);
  assert.deepEqual(inicios({ ...base, reservas,vagasSolicitadas: 2 }),[10.5]);
  assert.deepEqual(inicios({ ...base, vagasSolicitadas: 3 }),[]);
});
test('união de aberturas evita duplicidade, preserva almoço e recorta o dia', () => {
  assert.deepEqual(inicios({ ...base, aberturas: [periodo(10,11),periodo(9,10.5),periodo(9,10)] }),[9,9.5,10,10.5]);
  assert.deepEqual(inicios({ ...base, aberturas: [periodo(9,10),periodo(11,12)] }),[9,9.5,11,11.5]);
  assert.deepEqual(inicios({ ...base, dia: periodo(9.5,10.5) }),[9.5,10]);
});
test('dia fechado e dados fora do dia não criam horários nem bloqueios', () => {
  assert.deepEqual(inicios({ ...base, aberturas: [] }),[]);
  assert.deepEqual(inicios({ ...base, folgas: [periodo(20,22)],reservas: [{ id: 'fora',...periodo(23,25),vagas: 9 }] }),[9,9.5,10,10.5]);
});
test('dias materializados com 23 ou 25 horas não usam constante de 24 horas', () => {
  for (const fim of [23,25]) {
    const r = calcular({ ...base, dia: periodo(0,fim), agora: 0, aberturas: [periodo(0,fim)],duracaoMinutos: 60 });
    assert.equal(r.horarios.length,fim);
    assert.equal(r.horarios.at(-1).fim,hora(fim));
  }
});
test('dados inválidos, reservas repetidas e overflow não parecem disponibilidade', () => {
  const reserva = { id: 'a',...periodo(9,10),vagas: 1 };
  const ruins = [null,{}, { ...base, capacidade: 0 },{ ...base,vagasSolicitadas: -1 },{ ...base, duracaoMinutos: 0 },
    { ...base, intervaloMinutos: NaN },{ ...base, agora: '100' },{ ...base, aberturas: [periodo(10,9)] },
    { ...base,reservas: [reserva,reserva] },{ ...base,reservas: [{ ...reserva,vagas: -1 }] },
    { ...base,duracaoMinutos: Number.MAX_SAFE_INTEGER },
    { ...base,reservas: [{ ...reserva,vagas: Number.MAX_SAFE_INTEGER },{ ...reserva,id: 'b',vagas: 1 }] }];
  for (const c of ruins) assert.deepEqual(calcular(c),{ valido: false,motivo: 'dados_invalidos' });
});
test('limites de dados/candidatos falham explicitamente sem truncar', () => {
  assert.deepEqual(calcular({ ...base, folgas: Array(10001).fill(periodo(9,10)) }),{ valido: false,motivo: 'limite_de_dados' });
  assert.deepEqual(calcular({ ...base,dia: periodo(0,100),aberturas: [periodo(0,100)],duracaoMinutos: 1 }),{ valido: false,motivo: 'limite_de_dados' });
});
test('entrada não é alterada e resultado não compartilha seus períodos', () => {
  const antes = JSON.stringify(base);
  const r = calcular(base);r.horarios[0].inicio=0;
  assert.equal(JSON.stringify(base),antes);
  assert.equal(calcular(base).horarios[0].inicio,hora(9));
});
test('capacidade confere com simulação independente em 80 agendas determinísticas', () => {
  let seed=7583;
  const aleatorio = n => { seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n; };
  for (let caso=0;caso<80;caso++) {
    const duracaoMinutos=1+aleatorio(6), intervaloMinutos=aleatorio(3), capacidade=1+aleatorio(4), vagasSolicitadas=1+aleatorio(4);
    const reservas=Array.from({ length: 8 },(_,i) => {
      const inicio=aleatorio(60)*minuto;
      return { id: String(i),inicio,fim: inicio+(1+aleatorio(15))*minuto,vagas: 1+aleatorio(2) };
    });
    const c={ ...base,dia: { inicio: 0,fim: hora(1) },agora: 0,aberturas: [{ inicio: 0,fim: hora(1) }],reservas,duracaoMinutos,intervaloMinutos,capacidade,vagasSolicitadas };
    const esperado=[],passo=(duracaoMinutos+intervaloMinutos)*minuto;
    for (let inicio=0;inicio+passo<=hora(1);inicio+=passo) {
      let pico=0;
      for (let t=inicio;t<inicio+passo;t+=minuto) pico=Math.max(pico,reservas.filter(r=>r.inicio<=t && r.fim>t).reduce((n,r)=>n+r.vagas,0));
      const vagasLivres=Math.max(0,capacidade-pico);
      if(vagasLivres>=vagasSolicitadas) esperado.push({ inicio,fim: inicio+duracaoMinutos*minuto,ocupadoAte: inicio+passo,vagasLivres });
    }
    assert.deepEqual(calcular(c),{ valido: true,horarios: esperado },`agenda ${caso}`);
  }
});
