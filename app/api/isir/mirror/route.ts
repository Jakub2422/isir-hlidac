import {env} from 'cloudflare:workers';
import {mirrorInsolvencyBatch} from '@/lib/insolvency-mirror';
export const runtime='edge';
export async function POST(request:Request){
 if(!env.SYNC_SECRET)return Response.json({error:'Synchronizace není nakonfigurována'},{status:503});
 if(request.headers.get('authorization')!==`Bearer ${env.SYNC_SECRET}`)return Response.json({error:'Neautorizováno'},{status:401});
 if(!env.DB||!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)return Response.json({error:'Ukládání není nakonfigurováno'},{status:503});
 try{
  const result=await mirrorInsolvencyBatch(env.DB,{url:env.SUPABASE_URL,secret:env.SUPABASE_SERVICE_ROLE_KEY});
  return Response.json(result,{status:result.failed?207:200,headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Kopírování ISIR selhalo'},{status:503});}
}
