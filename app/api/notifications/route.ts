import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isOwnerUser,isAuctionUuid} from '@/lib/owner-access';
import {notifications} from '@/lib/notifications';
export const runtime='edge';
async function handle(request?:Request){
 if(!isOwnerUser((await getChatGPTUser())?.userId,env.OWNER_USER_ID))return Response.json({error:'Neautorizováno'},{status:401});
 const url=env.SUPABASE_URL,secret=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)return Response.json({error:'Upozornění nejsou nakonfigurována'},{status:503});
 let id:string|undefined;
 if(request){try{const body=await request.json() as {id?:unknown};if(typeof body.id!=='string')throw Error();id=body.id;if(id!=='all'&&!isAuctionUuid(id))throw Error();}catch{return Response.json({error:'Neplatné ID'},{status:400});}}
 try{return Response.json({notifications:await notifications({url,secret},id)},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Upozornění nejsou dostupná'},{status:503});}
}
export async function GET(){return handle();}
export async function PATCH(request:Request){return handle(request);}
