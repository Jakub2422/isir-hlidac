import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isOwnerUser} from '@/lib/owner-access';
import {readSourceHealth} from '@/lib/source-health';
export const runtime='edge';
export async function GET(){
 if(!isOwnerUser((await getChatGPTUser())?.userId,env.OWNER_USER_ID))return Response.json({error:'Neautorizováno'},{status:401});
 const url=env.SUPABASE_URL,secret=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)return Response.json({error:'Monitoring není nakonfigurován'},{status:503});
 try{return Response.json({sources:await readSourceHealth({url,secret})},{headers:{'Cache-Control':'no-store'}})}
 catch{return Response.json({error:'Historie sběru není dostupná'},{status:503})}
}
