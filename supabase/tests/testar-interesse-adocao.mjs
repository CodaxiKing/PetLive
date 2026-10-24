import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
const uid = (n) => `49000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [a,b,ong] = [1,2,3].map(uid), g=uid(10), pet=uid(100);
async function entrar(id, role='authenticated') {
  await db.exec(`reset role;set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
const detalhe = (tutor=a,id=pet) => db.query('select adocao_detalhe($1,$2) as r',[tutor,id]).then(r=>r.rows[0].r);
const enviar = (tutor=a,id=pet,msg='Quero conhecer este pet.',email=' Eu@exemplo.com ',concordo=true) =>
  db.query('select adocao_enviar_interesse($1,$2,$3,$4,$5) as r',[tutor,id,msg,email,concordo]).then(r=>r.rows[0].r);
try {
  await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;
    create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon,service_role;
    create table profiles(id uuid primary key);
    create function public.exportar_meus_dados() returns jsonb language sql as $$select '{"anterior":true}'::jsonb$$;
    insert into profiles values('${a}'),('${b}'),('${ong}');`);
  await db.exec(await readFile(new URL('../migrations/20261206000000_catalogo_adocao.sql',import.meta.url),'utf8'));
  const sql=await readFile(new URL('../migrations/20261209000000_interesse_adocao.sql',import.meta.url),'utf8');
  await db.exec(sql); await db.exec(sql);
  await db.exec(`insert into adocao_ongs(id,responsavel_id,nome,cidade,bairro,status) values('${g}','${ong}','Abrigo','Nova Iguaçu','Centro','aprovada');
    insert into adocao_pets(id,ong_id,nome,especie,porte,sexo,descricao,status)
    select ('49000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'${g}','Mia','gato','pequeno','femea','Calma','publicado' from generate_series(100,106) i;`);
  await entrar('', 'anon'); await assert.rejects(detalhe(),/permission denied/); await assert.rejects(enviar(),/permission denied/);
  await entrar(a); assert.equal((await detalhe()).pet.nome,'Mia'); assert.equal((await detalhe()).contato,null);
  assert(!JSON.stringify(await detalhe()).includes('responsavel_id'));
  await assert.rejects(detalhe(b),/nesta conta/); await assert.rejects(enviar(b),/nesta conta/);
  await assert.rejects(enviar(a,pet,'Curta'),/10 a 1000/); await assert.rejects(enviar(a,pet,'x'.repeat(1001)),/10 a 1000/);
  await assert.rejects(enviar(a,pet,undefined,'invalido'),/e-mail válido/);
  await assert.rejects(enviar(a,pet,undefined,undefined,false),/compartilhamento/);
  await assert.rejects(enviar(a,pet,undefined,undefined,null),/compartilhamento/);
  const recibo=await enviar(); assert(recibo.id); assert.equal((await enviar()).id,recibo.id,'retry idempotente');
  assert.equal((await detalhe()).contato.id,recibo.id);
  assert.equal((await db.query('select * from adocao_contatos')).rows[0].email_resposta,'eu@exemplo.com');
  assert(!('email_resposta' in (await detalhe()).contato));
  await assert.rejects(db.exec(`insert into adocao_contatos(tutor_id,pet_id,mensagem) values('${a}','${pet}','Sem RPC')`),/permission denied/);
  const exp=(await db.query('select exportar_meus_dados() as r')).rows[0].r;
  assert(exp.anterior); assert.equal(exp.adocao_contatos_enviados[0].email_resposta,'eu@exemplo.com');
  await entrar(b); assert.equal((await detalhe(b)).contato,null); assert.equal((await db.query('select * from adocao_contatos')).rows.length,0);
  await entrar(ong); assert.equal((await db.query('select * from adocao_contatos')).rows.length,1);
  await assert.rejects(enviar(ong),/responsável/);
  await entrar(a);
  for(let i=101;i<=104;i++) await enviar(a,uid(i));
  await assert.rejects(enviar(a,uid(105)),/cinco interesses/); assert.equal((await enviar()).id,recibo.id,'retry não conta no limite');
  for(const alteracao of ["update adocao_pets set status='adotado'", "update adocao_pets set status='publicado',confirmado_em=now()-interval '60 days'", "update adocao_pets set confirmado_em=now()+interval '1 day'", "update adocao_pets set confirmado_em=now();update adocao_ongs set status='suspensa'"]) {
    await db.exec(`reset role;${alteracao}`); await entrar(a); assert.equal(await detalhe(),null);
    await assert.rejects(enviar(),/não está disponível/);
  }
  await db.exec(`reset role;delete from profiles where id='${a}'`);
  assert.equal((await db.query('select * from adocao_contatos')).rows.length,0,'cascata remove contatos e e-mail');
  console.log('OK: detalhe privado, conta, consentimento, validação, retry, limite 24h, disponibilidade, ONG, LGPD e cascata.');
} catch(e) { console.error(e); process.exitCode=1; } finally { await db.close(); }
