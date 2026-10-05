import assert from 'node:assert/strict';
import {persistInsolvencyObservation} from './insolvency-persistence.ts';
const event={id:12,spis:'KSOS 1 INS 12/2026',published_at:'2026-10-05T10:00:00Z',description:'Nemovitost',document_url:'https://example.org/doc',verdict:'K ověření'};
const config={url:'https://example.supabase.co/',secret:'test-only'};
let calls=0;
await persistInsolvencyObservation(event,null,config,async(url,init)=>{
 calls++;assert.equal(url,'https://example.supabase.co/rest/v1/rpc/upsert_insolvency_observation');
 assert.deepEqual(JSON.parse(init.body),{p_event:event,p_finding:null});
 assert.equal(init.headers.Authorization,'Bearer test-only');return new Response(null,{status:204});
});
assert.equal(calls,1);
await assert.rejects(()=>persistInsolvencyObservation(event,null,config,async()=>new Response(null,{status:503})),/503/);
await assert.rejects(()=>persistInsolvencyObservation(event,{event_id:13},config),/mismatch/);
await assert.rejects(()=>persistInsolvencyObservation(event,null,{url:'',secret:''}),/configured/);
console.log('ISIR persistence: request mapping, failures and input validation passed');

// Simulated D1 tests checkpoint ordering, a failed RPC and safe replay.
const {mirrorInsolvencyBatch}=await import('./insolvency-mirror.ts');
let checkpoint=0;
const events=[event,{...event,id:13}];
const db={prepare(sql){return {bind(...args){return {
 async first(){return sql.includes('sync_state')?{value:String(checkpoint)}:null;},
 async all(){return {results:events.filter(e=>e.id>args[0])};},
 async run(){checkpoint=sql.startsWith('UPDATE')?Number(args[0]):Math.max(checkpoint,Number(args[1]));},
 };}};}};
let result=await mirrorInsolvencyBatch(db,config,async(_url,init)=>new Response(null,{status:JSON.parse(init.body).p_event.id===13?503:204}));
assert.equal(result.persisted,1);assert.equal(result.failed,1);assert.equal(checkpoint,12);
result=await mirrorInsolvencyBatch(db,config,async()=>new Response(null,{status:204}));
assert.equal(result.persisted,1);assert.equal(checkpoint,13);
result=await mirrorInsolvencyBatch(db,config,async()=>{throw new Error('must not repeat')});
assert.equal(result.persisted,0);assert.equal(result.failed,0);
console.log('ISIR mirror: failed write preserves cursor; restart resumes; completed rows skipped');

assert.equal(checkpoint,0);
events.push({...event,id:5});
result=await mirrorInsolvencyBatch(db,config,async()=>new Response(null,{status:204}));
assert.equal(result.persisted,3);
console.log('ISIR mirror: cyclic replay includes late historical events');
