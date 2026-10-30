import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
if (!process.env.PGLITE_MODULE) throw new Error('Defina PGLITE_MODULE para executar a verificação SQL local.');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated;
    create table events(id integer primary key, place_id text, lat double precision, lng double precision, status text, motivo_status text);
    create table event_reminder_deliveries(event_id integer);
    insert into events values(1,null,-22,-43,'publicado','antigo');
    insert into event_reminder_deliveries values(1);`);
  const sql = await readFile(new URL('../migrations/20270108230000_eventos_reanalise_local.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql);
  await db.exec('update events set lat=lat where id=1');
  assert.equal((await db.query('select status from events')).rows[0].status, 'publicado');
  await db.exec('update events set lng=-44 where id=1');
  assert.equal((await db.query('select status from events')).rows[0].status, 'em_analise');
  assert.equal((await db.query('select motivo_status from events')).rows[0].motivo_status, null);
  assert.equal((await db.query('select * from event_reminder_deliveries')).rows.length, 0);
  await db.exec("update events set status='publicado'; update events set place_id='novo' where id=1");
  assert.equal((await db.query('select status from events')).rows[0].status, 'em_analise');
  await db.exec("update events set status='cancelado'; update events set lat=-23 where id=1");
  assert.equal((await db.query('select status from events')).rows[0].status, 'cancelado');
  console.log('OK: coordenadas, Place ID, atualização sem mudança, cancelamento e reaplicação.');
} finally { await db.close(); }
