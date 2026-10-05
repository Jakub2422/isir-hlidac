import {persistInsolvencyObservation,type StoredIsirEvent,type StoredIsirFinding} from './insolvency-persistence.ts';
import type {AuctionPersistenceConfig} from './auction-persistence.ts';
/** Replays immutable D1 event rows in ID order. A failed write never advances the checkpoint. */
export async function mirrorInsolvencyBatch(db:D1Database,config:AuctionPersistenceConfig,fetcher:typeof fetch=fetch){
 const key='supabase:mirror:cursor';
 const state=await db.prepare('SELECT value FROM sync_state WHERE key=?').bind(key).first<{value:string}>();
 let cursor=Number(state?.value??0);
 const rows=await db.prepare('SELECT * FROM events WHERE id>? ORDER BY id LIMIT 25').bind(cursor).all<StoredIsirEvent>();
 // Cycle after reaching the end: history imports can add lower IDs later.
 if(rows.results.length===0){
  await db.prepare('UPDATE sync_state SET value=?,updated_at=? WHERE key=? AND value=?').bind('0',new Date().toISOString(),key,String(cursor)).run();
  return {persisted:0,cursor:0,pending:false,failed:0};
 }
 let persisted=0;
 for(const event of rows.results){
  const finding=await db.prepare('SELECT * FROM findings WHERE event_id=?').bind(event.id).first<StoredIsirFinding>();
  try{await persistInsolvencyObservation(event,finding,config,fetcher)}
  catch{return {persisted,cursor,pending:true,failed:1};}
  await db.prepare(`INSERT INTO sync_state(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at WHERE CAST(sync_state.value AS INTEGER)<CAST(excluded.value AS INTEGER)`).bind(key,String(event.id),new Date().toISOString()).run();
  cursor=event.id;persisted++;
 }
 return {persisted,cursor,pending:rows.results.length===25,failed:0};
}
