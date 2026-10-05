import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 const call=(success,complete,count=4,start='2026-10-05T10:00:00Z',end='2026-10-05T10:01:00Z')=>db.query('select public.record_auction_crawl_run($1,$2,$3,$4,$5,$6,$7) id',['cevd',start,end,success,complete,count,success?null:'timeout']);
 await db.exec('set role service_role');
 const first=(await call(false,true)).rows[0].id;
 await db.exec('reset role');
 let run=(await db.query('select * from public.auction_crawl_runs where id=$1',[first])).rows[0];
 assert.equal(run.fetched_count,4);assert.equal(run.is_complete_snapshot,false);assert.ok(run.completed_at);
 let source=(await db.query("select * from public.auction_sources where code='cevd'")).rows[0];
 assert.equal(source.last_error,'timeout');assert.ok(source.last_error_at);
 const errorAt=source.last_error_at;
 await db.exec('set role service_role');
 await call(true,false);
 await db.exec('reset role');
 source=(await db.query("select * from public.auction_sources where code='cevd'")).rows[0];
 assert.equal(source.last_error,null);assert.deepEqual(source.last_error_at,errorAt);assert.ok(source.last_success_at);
 await assert.rejects(()=>call(true,false,-1));
 await assert.rejects(()=>call(true,false,1,'2026-10-06','2026-10-05'));
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);
  await assert.rejects(()=>call(true,true));
 }
 await db.exec('set role service_role');
 const event={id:42,spis:'KSOS 1 INS 42/2026',published_at:'2026-10-05T10:00:00Z',description:'Property',verdict:'Review'};
 const finding={event_id:42,detected_at:'2026-10-05T10:01:00Z',district:'Ostrava',city:'Ostrava',kind:'house',lv:'12',parcel:'1/2'};
 const save=(f=finding)=>db.query('select public.upsert_insolvency_observation($1::jsonb,$2::jsonb)',[JSON.stringify(event),f===null?null:JSON.stringify(f)]);
 await save();await save();await save(null);
 await assert.rejects(()=>save({...finding,event_id:43}));
 await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int n from insolvency_events')).rows[0].n,1);
 const saved=(await db.query('select * from insolvency_findings')).rows;
 assert.equal(saved.length,1);assert.equal(saved[0].title_deed_number,'12');assert.equal(saved[0].parcel_number,'1/2');
 assert.equal(saved[0].detected_at.toISOString(),'2026-10-05T10:01:00.000Z');
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(()=>save());}
 await db.exec('reset role');
 const tables=await db.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity");
 assert.deepEqual(tables.rows,[]);
 console.log('PostgreSQL: all migrations, crawl writes, source health, validation and RPC permissions passed');
}finally{await db.close()}
