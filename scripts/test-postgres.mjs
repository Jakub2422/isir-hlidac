import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {parseBurzaSpravcu,parseExekutorOstrava} from '../lib/auction-import.ts';
import {persistAuctionListing} from '../lib/auction-persistence.ts';
import {auctionRowToListing} from '../lib/auction-reader.ts';
const db=new PGlite();
try{
 const schema=await readFile('supabase/schema.sql','utf8');
 assert.match(schema,/create or replace function public\.upsert_auction_observation/);
 assert.match(schema,/pg_advisory_xact_lock/);
 assert.match(schema,/create or replace function public\.upsert_insolvency_observation/);
 assert.doesNotMatch(schema,/\nas \$\ndeclare/);
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
 const realListings=[...parseBurzaSpravcu(await readFile('lib/fixtures/burza-spravcu.html','utf8')),...parseExekutorOstrava(await readFile('lib/fixtures/exekutor-ostrava.xml','utf8'))];
 const rpcFetch=async(_url,init)=>{
  const body=JSON.parse(init.body);
  const keys=['p_source_code','p_canonical_key','p_source_external_id','p_source_url','p_title','p_category','p_status','p_opening_price','p_auction_at','p_published_at','p_raw_data'];
  const values=keys.map(k=>k==='p_raw_data'?JSON.stringify(body[k]):body[k]);
  const result=await db.query('select * from public.upsert_auction_observation($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)',values);
  return Response.json(result.rows);
 };
 await db.exec('set role service_role');
 for(const item of realListings){
  const config={url:'https://local.test',secret:'test-only'};
  const first=await persistAuctionListing(item,config,rpcFetch);
  const repeat=await persistAuctionListing(item,config,rpcFetch);
  assert.equal(first.created,true);assert.equal(repeat.created,false);assert.equal(first.auctionId,repeat.auctionId);
 }
 await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int n from auctions')).rows[0].n,34);
 assert.equal((await db.query('select count(*)::int n from auction_occurrences')).rows[0].n,34);
 const rows=(await db.query(`select a.*,jsonb_agg(jsonb_build_object('source_url',o.source_url,'raw_data',o.raw_data,'last_seen_at',o.last_seen_at,'auction_sources',jsonb_build_object('name',s.name))) auction_occurrences from auctions a join auction_occurrences o on o.auction_id=a.id join auction_sources s on s.id=o.source_id group by a.id`)).rows;
 const listings=rows.map(auctionRowToListing);
 assert.equal(listings.length,34);assert.equal(listings.filter(x=>x.msk).length,4);
 assert.ok(listings.every(x=>x.auctionId&&x.title!=='Zobrazit'));
 console.log('Real source fixtures → parser → normalization → persistence RPC → PostgreSQL → reader: 34 offers, repeat without duplicates, 4 MSK passed');
 const tables=await db.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity");
 assert.deepEqual(tables.rows,[]);
 console.log('PostgreSQL: all migrations, crawl writes, source health, validation and RPC permissions passed');
}finally{await db.close()}
