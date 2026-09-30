import {database,detect,documentUrl,latestId,needsDocument,readDocument,readEvents} from '@/lib/isir';
export const runtime='edge';

export async function POST(request:Request){
 const db=database();
 const mode=new URL(request.url).searchParams.get('mode')==='history'?'history_cursor':'cursor';
 const lockKey=`lock:${mode}`;
 const lockToken=crypto.randomUUID();
 const now=new Date();
 const staleBefore=new Date(now.getTime()-2*60_000).toISOString();
 let locked=false;
 try{
  await db.prepare('INSERT OR IGNORE INTO sync_state(key,value,updated_at) VALUES(?,?,?)').bind(lockKey,lockToken,now.toISOString()).run();
  await db.prepare('UPDATE sync_state SET value=?,updated_at=? WHERE key=? AND updated_at < ?').bind(lockToken,now.toISOString(),lockKey,staleBefore).run();
  const lock=await db.prepare('SELECT value FROM sync_state WHERE key=?').bind(lockKey).first<{value:string}>();
  if(lock?.value!==lockToken)return Response.json({busy:true,mode},{status:409});
  locked=true;

  let row=await db.prepare('SELECT value FROM sync_state WHERE key=?').bind(mode).first<{value:string}>();
  if(!row){
   const latest=await latestId();
   const cursor=Math.max(0,latest-(mode==='history_cursor'?6000:1500));
   await db.prepare('INSERT OR IGNORE INTO sync_state(key,value,updated_at) VALUES(?,?,?)').bind(mode,String(cursor),new Date().toISOString()).run();
   row={value:String(cursor)};
  }
  let cursor=Number(row.value);
  if(mode==='history_cursor'){
   const recent=Math.max(0,(await latestId())-6000);
   if(cursor<recent){
    cursor=recent;
    await db.prepare('UPDATE sync_state SET value=?,updated_at=? WHERE key=?').bind(String(cursor),new Date().toISOString(),mode).run();
   }
  }
  const all=await readEvents(cursor);
  let processed=0,found=0,examined=0,last=cursor;
  for(const event of all){
   if(needsDocument(event)){
    if(examined>=12)break;
    examined++;
    let verdict='Nemovitost v MSK nezjištěna';
    try{
     const match=detect(await readDocument(event));
     if(match){
      verdict='K ověření';
      await db.prepare('INSERT OR IGNORE INTO findings(event_id,spis,published_at,detected_at,district,city,kind,lv,parcel,description,document_url) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(event.id,event.spis,event.publishedAt,new Date().toISOString(),match.district,match.city,match.kind,match.lv,match.parcel,event.description,documentUrl(event.documentId)).run();
      found++;
     }
    }catch(e){
     console.error('ISIR document failure',event.id,e);
     verdict='Dokument nedostupný – vynechán';
    }
    await db.prepare('INSERT OR IGNORE INTO events(id,spis,published_at,description,document_url,verdict) VALUES(?,?,?,?,?,?)').bind(event.id,event.spis,event.publishedAt,event.description,documentUrl(event.documentId),verdict).run();
   }
   last=event.id;
   processed++;
  }
  if(last>cursor)await db.prepare('UPDATE sync_state SET value=?,updated_at=? WHERE key=? AND CAST(value AS INTEGER) < ?').bind(String(last),new Date().toISOString(),mode,last).run();
  return Response.json({processed,examined,found,pending:processed<all.length||all.length>=1000,cursor:last,mode});
 }catch(e){
  return Response.json({error:e instanceof Error?e.message:'Synchronizace selhala'},{status:503});
 }finally{
  if(locked){
   try{await db.prepare('DELETE FROM sync_state WHERE key=? AND value=?').bind(lockKey,lockToken).run()}
   catch(e){console.error('ISIR sync lock release failure',e)}
  }
 }
}
