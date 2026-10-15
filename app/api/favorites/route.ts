import {env} from 'cloudflare:workers';
import {isAuctionUuid,isOwnerUser} from '@/lib/owner-access';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {addFavorite,listFavoriteIds,removeFavorite} from '@/lib/owner-storage';

export const runtime='edge';
const config=()=>{
 const url=env.SUPABASE_URL;
 const secret=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)throw new Error('Supabase owner storage není nakonfigurováno');
 return {url,secret};
};
const unauthorized=()=>Response.json({error:'Neautorizováno'},{status:401});

export async function GET(){
 if(!isOwnerUser((await getChatGPTUser())?.userId,env.OWNER_USER_ID))return unauthorized();
 try{return Response.json({auctionIds:await listFavoriteIds(config())},{headers:{'Cache-Control':'no-store'}})}
 catch(e){return Response.json({error:e instanceof Error?e.message:'Favorites nejsou dostupné'},{status:503})}
}
export async function POST(request:Request){
 if(!isOwnerUser((await getChatGPTUser())?.userId,env.OWNER_USER_ID))return unauthorized();
 const body=await request.json().catch(()=>null) as {auctionId?:unknown}|null;
 if(!isAuctionUuid(body?.auctionId))return Response.json({error:'Chybí auctionId'},{status:400});
 try{await addFavorite(config(),body.auctionId);return Response.json({ok:true},{status:201})}
 catch(e){return Response.json({error:e instanceof Error?e.message:'Favorite nelze uložit'},{status:503})}
}
export async function DELETE(request:Request){
 if(!isOwnerUser((await getChatGPTUser())?.userId,env.OWNER_USER_ID))return unauthorized();
 const auctionId=new URL(request.url).searchParams.get('auctionId');
 if(!isAuctionUuid(auctionId))return Response.json({error:'Chybí auctionId'},{status:400});
 try{await removeFavorite(config(),auctionId);return Response.json({ok:true})}
 catch(e){return Response.json({error:e instanceof Error?e.message:'Favorite nelze odebrat'},{status:503})}
}
