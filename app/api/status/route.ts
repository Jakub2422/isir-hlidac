import {env} from 'cloudflare:workers';
import {database} from '@/lib/isir';
export const runtime='edge';
export async function GET(request:Request){
 const secret=env.SYNC_SECRET;
 if(!secret)return Response.json({error:'Stav není nakonfigurován'},{status:503});
 if((request.headers.get('authorization')||'')!==`Bearer ${secret}`)return Response.json({error:'Neautorizováno'},{status:401});
 try{
  const db=database();
  const row=await db.prepare("SELECT value,updated_at FROM sync_state WHERE key='cursor'").first<{value:string,updated_at:string}>();
  const count=await db.prepare('SELECT count(*) AS n FROM findings').first<{n:number}>();
  return Response.json({initialized:!!row,cursor:row?.value||null,updated_at:row?.updated_at||null,findings:count?.n||0},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Stav není dostupný'},{status:503})}
}
