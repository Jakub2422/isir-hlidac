import {env} from 'cloudflare:workers';
import {persistAuctionListings} from '@/lib/auction-persistence';
import {asis,cevd,drazbyExekutori,drazbyProst,elektronickeDrazby,exdrazby,financial,insolvencniZamery,karvina,okdrazby,portalDrazeb,portalElektronickych,prokonzulta,spravaZeleznic,uzsvm,type Listing} from '@/lib/auction-import';

export const runtime='edge';

export async function POST(request:Request){
 const secret=env.COLLECTOR_SECRET;
 if(!secret)return Response.json({error:'Collector není nakonfigurován'},{status:503});
 if((request.headers.get('authorization')||'')!==`Bearer ${secret}`)
  return Response.json({error:'Neautorizováno'},{status:401});

 const supabaseUrl=env.SUPABASE_URL;
 const supabaseSecret=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!supabaseUrl||!supabaseSecret)
  return Response.json({error:'Supabase persistence není nakonfigurována'},{status:503});

 const tasks=[
  ['CEVD',()=>cevd(false)],['Portál dražeb',()=>portalDrazeb(false)],
  ['Finanční správa',financial],['ÚZSVM – aukce majetku',()=>uzsvm(false)],
  ['Insolvenční záměry',insolvencniZamery],['OKdražby',okdrazby],
  ['exdrazby',()=>exdrazby(false)],['dražby-exekutoři',drazbyExekutori],
  ['Správa železnic – prodej',spravaZeleznic],['Prokonzulta',prokonzulta],
  ['ASIS – insolvenční majetek',asis],['Aukce města Karviná',karvina],
  ['Portál elektronických dražeb',()=>portalElektronickych(false)],
  ['DražbyProst',drazbyProst],['Elektronické dražby',elektronickeDrazby],
 ] as const;

 const settled=await Promise.allSettled(tasks.map(async([name,task])=>({name,items:await task()})));
 const listings:Listing[]=[];
 const sources:Array<{name:string;ok:boolean;count:number;error?:string}>=[];
 for(let i=0;i<settled.length;i++){
  const value=settled[i];
  if(value.status==='fulfilled'){
   listings.push(...value.value.items);
   sources.push({name:tasks[i][0],ok:true,count:value.value.items.length});
  }else{
   sources.push({name:tasks[i][0],ok:false,count:0,error:value.reason instanceof Error?value.reason.message:'Zdroj není dostupný'});
  }
 }

 const unique=[...new Map(listings.map(item=>[`${item.source}\n${item.url}`,item])).values()];
 const persistence=await persistAuctionListings(unique,{url:supabaseUrl,secret:supabaseSecret});
 const allSourcesOk=sources.every(source=>source.ok);
 return Response.json({
  fetched:unique.length,
  persistence,
  sources,
  complete:allSourcesOk,
  finalizedMissing:false,
  fetchedAt:new Date().toISOString(),
 },{
  status:persistence.failed>0?207:200,
  headers:{'Cache-Control':'no-store'},
 });
}
