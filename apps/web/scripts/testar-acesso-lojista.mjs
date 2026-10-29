import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conferirLojas, carregarAcessoLojista, CHECKLIST_LOJA } from '../src/lib/lojista/acesso.ts';
const loja = { id: 'loja-a', name: 'Loja A', status: 'aprovada', role: 'owner', motivo_status: null, lugar_pendente: false,
  checklist: Object.fromEntries(Object.keys(CHECKLIST_LOJA).map(k=>[k,true])) };
const sessao = id => ({ data: { session: id ? { user: { id, email: `${id}@example.invalid` } } : null }, error: null });
function cliente(inicial='a', final='a', resposta={ data: [loja], error: null }) {
  let chamadas=0, sessoes=0;
  return { auth: { getSession: async () => sessao(sessoes++ ? final : inicial) },
    rpc: async nome => { assert.equal(nome,'minhas_lojas');chamadas++;return resposta; }, get chamadas() { return chamadas; } };
}
test('valida papéis, estados e checklist e projeta somente os campos usados', () => {
  const r=conferirLojas([{ ...loja, token_privado: 'não copiar', checklist: { ...loja.checklist, segredo: 'não copiar' } }]);
  assert.deepEqual(r,[loja]);
  for (const role of ['owner','manager','staff']) assert.equal(conferirLojas([{ ...loja,role }])[0].role,role);
  for (const status of ['rascunho','em_analise','aprovada','correcao_pedida','recusada','suspensa']) assert.equal(conferirLojas([{ ...loja,status }])[0].status,status);
});
test('resposta inválida não vira vínculo nem lista vazia', () => {
  for (const valor of [null,{},[null],[{ ...loja,id: '' }],[{ ...loja,role:'super' }],[{ ...loja,status:'constructor' }],
    [{ ...loja,role:'toString' }],[{ ...loja,name:' ' }],[{ ...loja,motivo_status: undefined }],
    [{ ...loja,lugar_pendente: 'false' }],[{ ...loja,checklist: {} }],[loja,loja]]) assert.throws(()=>conferirLojas(valor));
  assert.deepEqual(conferirLojas([]),[]);
});
test('checklist devolvido não compartilha o objeto de entrada', () => {
  const r=conferirLojas([loja]);r[0].checklist.dados=false;
  assert.equal(loja.checklist.dados,true);
});
test('carrega acesso vinculado à conta e permite estado sem loja', async () => {
  assert.deepEqual(await carregarAcessoLojista(cliente()),{ usuario: { id:'a',email:'a@example.invalid' },lojas:[loja] });
  assert.deepEqual((await carregarAcessoLojista(cliente('a','a',{ data: [],error:null }))).lojas,[]);
});
test('sem sessão não consulta lojas', async () => {
  const c=cliente(null);assert.equal(await carregarAcessoLojista(c),null);assert.equal(c.chamadas,0);
});
test('troca de conta e logout durante leitura descartam os dados', async () => {
  for (const final of ['b',null]) await assert.rejects(carregarAcessoLojista(cliente('a',final)),/conta mudou/);
});
test('erro de sessão, rede ou RPC não é interpretado como acesso vazio', async () => {
  const c=cliente();c.auth.getSession=async()=>({ data:{ session:null },error:new Error('sem rede') });
  await assert.rejects(carregarAcessoLojista(c),/sessão/);assert.equal(c.chamadas,0);
  await assert.rejects(carregarAcessoLojista(cliente('a','a',{ error:new Error('negado') })),/carregar suas lojas/);
  const rede=cliente();rede.rpc=async()=>{ throw new Error('sem rede'); };
  await assert.rejects(carregarAcessoLojista(rede),/sem rede/);
  await assert.rejects(carregarAcessoLojista(cliente('a','a',{ data:null,error:null })),/conferir suas lojas/);
});
