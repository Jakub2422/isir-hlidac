import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isOwnerUser} from '@/lib/owner-access';
import {readAlertHealth} from '@/lib/alert-evaluator';
import {readSourceHealth} from '@/lib/source-health';
export const runtime='edge';
export async function GET(){
 if(!isOwnerUser((await getChatGPTUser())?.userId,env.OWNER_USER_ID))return Response.json({error:'Neautorizováno'},{status:401});
 const url=env.SUPABASE_URL,secret=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)return Response.json({error:'Monitoring není nakonfigurován'},{status:503});
 try{const [sources,alerts]=await Promise.all([readSourceHealth({url,secret}),readAlertHealth({url,secret})]);return Response.json({sources,alerts},{headers:{'Cache-Control':'no-store'}})}
 catch{return Response.json({error:'Historie sběru není dostupná'},{status:503})}
}
