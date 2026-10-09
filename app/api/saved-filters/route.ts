import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isAuctionUuid,isOwnerUser} from '@/lib/owner-access';
import {deleteOwnerFilter,listSavedFilters,saveOwnerFilter} from '@/lib/owner-storage';
import {validateSavedFilter} from '@/lib/saved-filter';
export const runtime='edge';
const config=()=>{const url=env.SUPABASE_URL,secret=env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!secret)throw Error('Storage unavailable');return {url,secret}};
const owner=async()=>isOwnerUser((await getChatGPTUser())?.userId,env.OWNER_USER_ID);
const unauthorized=()=>Response.json({error:'Neautorizováno'},{status:401});
const unavailable=()=>Response.json({error:'Uložené filtry nejsou dostupné'},{status:503});
export async function GET(){
 if(!await owner())return unauthorized();
 try{return Response.json({filters:await listSavedFilters(config())},{headers:{'Cache-Control':'no-store'}})}catch{return unavailable()}
}
async function save(request:Request,id?:string){
 let filter;try{filter=validateSavedFilter(await request.json())}catch(e){return Response.json({error:e instanceof Error?e.message:'Neplatný filtr'},{status:400})}
 try{return Response.json({filter:await saveOwnerFilter(config(),filter,id)},{status:id?200:201})}catch{return unavailable()}
}
export async function POST(request:Request){if(!await owner())return unauthorized();return save(request)}
export async function PATCH(request:Request){
 if(!await owner())return unauthorized();const id=new URL(request.url).searchParams.get('id');
 if(!isAuctionUuid(id))return Response.json({error:'Neplatné ID filtru'},{status:400});return save(request,id);
}
export async function DELETE(request:Request){
 if(!await owner())return unauthorized();const id=new URL(request.url).searchParams.get('id');
 if(!isAuctionUuid(id))return Response.json({error:'Neplatné ID filtru'},{status:400});
 try{await deleteOwnerFilter(config(),id);return Response.json({ok:true})}catch{return unavailable()}
}
