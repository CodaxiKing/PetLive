import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
assert(process.env.PGLITE_MODULE, 'Defina PGLITE_MODULE.');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
const uid = (n) => `44000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [a, b, ong, outra] = [1, 2, 3, 4].map(uid), g = uid(10), h = uid(11), pet = uid(100);
async function entrar(id, role = 'authenticated') { await db.exec(`reset role;set role ${role}`); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); }
const listar = async (tutor = a, especie = null, filhote = false, porte = null, sexo = null, cidade = null, favoritos = false, cursor = null) =>
  (await db.query('select adocao_listar($1,$2,$3,$4,$5,$6,$7,$8,$9) as r', [tutor, especie, filhote, porte, sexo, cidade, favoritos, cursor?.criado_em ?? null, cursor?.id ?? null])).rows[0].r;
const fav = (tutor = a, id = pet, ativo = true) => db.query('select adocao_favoritar($1,$2,$3)', [tutor, id, ativo]);
try {
  await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;
    create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon,service_role;
    create table profiles(id uuid primary key);
    create function public.exportar_meus_dados() returns jsonb language sql as $$select '{"anterior":true}'::jsonb$$;
    insert into profiles values('${a}'),('${b}'),('${ong}'),('${outra}');`);
  const sql = await readFile(new URL('../migrations/20261206000000_catalogo_adocao.sql', import.meta.url), 'utf8');
  await db.exec(sql); await db.exec(sql);
  await db.exec(`insert into adocao_ongs(id,responsavel_id,nome,cidade,bairro,status) values
    ('${g}','${ong}','Abrigo Verificado','Nova Iguaçu','Centro','aprovada'),('${h}','${outra}','Pendente','Rio de Janeiro','Centro','pendente');
    insert into adocao_pets(id,ong_id,nome,especie,nascimento,porte,sexo,descricao,status,confirmado_em) values
    ('${pet}','${g}','Mia','gato',current_date-interval '3 months','pequeno','femea','Calma','publicado',now()),
    ('${uid(101)}','${g}','Antigo','cao',null,'grande','macho','Antigo','publicado',now()-interval '60 days'),
    ('${uid(102)}','${g}','Adotado','cao',null,'grande','macho','Adotado','adotado',now()),
    ('${uid(103)}','${g}','Rascunho','cao',null,'grande','macho','Rascunho','rascunho',now()),
    ('${uid(104)}','${h}','Sem aprovação','cao',null,'grande','macho','Pendente','publicado',now()),
    ('${uid(105)}','${g}','Oculto','cao',null,'grande','macho','Moderado','oculto',now()),
    ('${uid(106)}','${g}','Futuro','cao',null,'grande','macho','Data futura','publicado',now()+interval '1 day');`);
  await entrar('', 'anon'); await assert.rejects(listar(), /permission denied/);
  await entrar(a);
  const pagina = await listar(); assert.equal(pagina.itens.length, 1); assert.equal(pagina.itens[0].nome, 'Mia');
  assert.equal(pagina.itens[0].ong_nome, 'Abrigo Verificado'); assert.equal(pagina.tem_mais, false);
  assert(!JSON.stringify(pagina).includes('responsavel_id'));
  await assert.rejects(listar(b), /nesta conta/); await assert.rejects(listar(a, 'ave'), /Filtros inválidos/);
  assert.equal((await listar(a, 'gato', true, 'pequeno', 'femea', '  iguacu ')).itens.length, 1, 'filtros combinados e cidade sem acento');
  assert.equal((await listar(a, 'cao')).itens.length, 0);
  await fav(); await fav(); assert.equal((await listar(a, null, false, null, null, null, true)).itens.length, 1);
  assert.equal((await db.query('select * from adocao_favoritos')).rows.length, 1, 'favoritar é idempotente');
  await assert.rejects(fav(b), /nesta conta/); await assert.rejects(fav(a, uid(101)), /não está disponível/);
  await assert.rejects(db.exec(`insert into adocao_favoritos values('${b}','${pet}',now())`), /permission denied/);
  await assert.rejects(db.exec(`update adocao_ongs set status='aprovada'`), /permission denied/);
  await assert.rejects(db.exec(`insert into adocao_contatos(tutor_id,pet_id,mensagem) values('${a}','${pet}','Sem API de contato')`), /permission denied/);
  assert.equal((await db.query('select * from adocao_ongs')).rows.length, 0, 'tutor não lê cadastro da ONG');
  assert.equal((await db.query('select * from adocao_pets')).rows.length, 0, 'catálogo só por RPC com projeção pública');
  await db.exec(`reset role;insert into adocao_contatos(tutor_id,pet_id,mensagem) values('${a}','${pet}','Interesse privado')`);
  await entrar(b); assert.equal((await db.query('select * from adocao_favoritos')).rows.length, 0);
  assert.equal((await db.query('select * from adocao_contatos')).rows.length, 0);
  await entrar(a); const exp = (await db.query('select exportar_meus_dados() as r')).rows[0].r;
  assert.equal(exp.anterior, true); assert.equal(exp.adocao_favoritos.length, 1); assert.equal(exp.adocao_contatos_enviados.length, 1);
  await assert.rejects(db.query('select adocao_confirmar_pet($1,$2)', [a, uid(101)]), /Somente a ONG/);
  await entrar(ong); assert.equal((await db.query('select * from adocao_contatos')).rows.length, 1, 'ONG responsável lê contato');
  await db.query('select adocao_confirmar_pet($1,$2)', [ong, uid(101)]);
  await assert.rejects(db.query('select adocao_confirmar_pet($1,$2)', [ong, uid(105)]), /Somente a ONG/);
  await entrar(a); assert.equal((await listar(a, 'cao')).itens.length, 1, 'ONG confirma e pet vencido volta ao catálogo');
  await db.exec(`reset role;update adocao_ongs set status='suspensa' where id='${g}'`);
  await entrar(a); assert.equal((await listar()).itens.length, 0, 'suspender ONG esconde todos os pets e favoritos');
  await fav(a, pet, false); assert.equal((await db.query('select * from adocao_favoritos')).rows.length, 0, 'pode remover favorito oculto');
  await db.exec(`reset role;update adocao_ongs set status='aprovada' where id='${g}';
    insert into adocao_pets(id,ong_id,nome,especie,porte,sexo,descricao,status,criado_em)
    select ('44000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'${g}','Pet '||i,'cao','medio','macho','Descrição','publicado','2026-01-01T00:00:00Z'
      from generate_series(200,224) i;`);
  await entrar(a); const primeira = await listar(a, 'cao', false, 'medio');
  assert.equal(primeira.itens.length, 20); assert.equal(primeira.tem_mais, true);
  const segunda = await listar(a, 'cao', false, 'medio', null, null, false, primeira.itens.at(-1));
  assert.equal(segunda.itens.length, 5); assert.equal(segunda.tem_mais, false);
  assert.equal(new Set([...primeira.itens, ...segunda.itens].map((p) => p.id)).size, 25, 'cursor estável com timestamps iguais');
  assert.equal((await listar(a, 'cao', true, 'medio')).itens.length, 0, 'idade desconhecida fora de filhotes');
  await db.exec('reset role');
  await assert.rejects(db.exec(`update adocao_pets set fotos=array['file:///privado'] where id='${pet}'`), /check constraint/);
  await assert.rejects(db.exec(`update adocao_pets set fotos=array['https://login:senha@exemplo.com/foto'] where id='${pet}'`), /check constraint/);
  await assert.rejects(db.exec(`update adocao_pets set fotos=array_fill('https://exemplo.com/foto.jpg'::text,array[7]) where id='${pet}'`), /check constraint/);
  await db.exec(`delete from profiles where id='${ong}'`);
  assert.equal((await db.query('select * from adocao_pets')).rows.length, 1, 'cascata remove somente os pets desta ONG');
  assert.equal((await db.query('select * from adocao_contatos')).rows.length, 0);
  console.log('OK: catálogo verificado, 60 dias, confirmação da ONG, filtros, cursor, favoritos privados, contatos RLS, LGPD e cascata.');
} catch (e) { console.error(e.message); process.exitCode = 1; } finally { await db.close(); }
