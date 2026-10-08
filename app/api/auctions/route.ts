import {env} from 'cloudflare:workers';
import {readPersistedAuctions} from '@/lib/auction-reader';
import {publishedToday,pragueDay} from '@/lib/auction-today';
import {exekutorOstrava,asis,burzaSpravcu,cevd,drazbyExekutori,drazbyProst,elektronickeDrazby,exdrazby,financial,insolvencniZamery,karvina,okdrazby,portalDrazeb,portalElektronickych,prokonzulta,spravaZeleznic,uzsvm,type Listing} from '@/lib/auction-import';
export const runtime='edge';
 export async function GET(request:Request){const msk=new URL(request.url).searchParams.get('region')==='msk';
 const supabaseUrl=env.SUPABASE_URL,supabaseSecret=env.SUPABASE_SERVICE_ROLE_KEY;
 if(supabaseUrl&&supabaseSecret){
  try{
   const persisted=await readPersistedAuctions({url:supabaseUrl,secret:supabaseSecret},{limit:500,msk});
   if(persisted.length){
    const now=new Date();
    const sourceCounts=new Map<string,number>();
    for(const item of persisted)sourceCounts.set(item.source,(sourceCounts.get(item.source)||0)+1);
    const persistedSources=[...sourceCounts].map(([name,count])=>({name,ok:true,count}));
    return Response.json({items:persisted.slice(0,250),sources:persistedSources,region:msk?'msk':'all',fetchedAt:now.toISOString(),dataSource:'supabase',today:{date:pragueDay(now),count:publishedToday(persisted,now).length,complete:false}},{headers:{'Cache-Control':'public, max-age=60'}});
   }
  }catch(error){console.error('Persisted auction read failed; falling back to live sources',error)}
 }
 const tasks=[['CEVD',()=>cevd(msk)],['Portál dražeb',()=>portalDrazeb(msk)],['Finanční správa',financial],['ÚZSVM – aukce majetku',()=>uzsvm(msk)],['Insolvenční záměry',insolvencniZamery],['OKdražby',okdrazby],['exdrazby',()=>exdrazby(msk)],['dražby-exekutoři',drazbyExekutori],['Správa železnic – prodej',spravaZeleznic],['Prokonzulta',prokonzulta],['ASIS – insolvenční majetek',asis],['Burza správců – nemovitosti',burzaSpravcu],['Exekutorský úřad Ostrava',exekutorOstrava],['Aukce města Karviná',karvina],['Portál elektronických dražeb',()=>portalElektronickych(msk)],['DražbyProst',drazbyProst],['Elektronické dražby',elektronickeDrazby]] as const;
 const settled=await Promise.allSettled(tasks.map(async([name,task])=>({name,items:await task()})));const items:Listing[]=[],sources:Array<{name:string;ok:boolean;count:number;error?:string}>=[];
 for(let i=0;i<settled.length;i++){const result=settled[i];if(result.status==='fulfilled'){const filtered=msk?result.value.items.filter(x=>x.msk):result.value.items;items.push(...filtered);sources.push({name:tasks[i][0],ok:true,count:filtered.length})}else sources.push({name:tasks[i][0],ok:false,count:0,error:result.reason instanceof Error?result.reason.message:'Zdroj není dostupný'})}
 const deduplicated=[...new Map(items.map(x=>[x.url,x])).values()].sort((a,b)=>{const da=Date.parse(a.published||a.date)||0,db=Date.parse(b.published||b.date)||0;return db-da});const now=new Date();const datedSources=['CEVD','Portál dražeb','Insolvenční záměry','Správa železnic – prodej'];return Response.json({items:deduplicated.slice(0,250),sources,region:msk?'msk':'all',fetchedAt:now.toISOString(),dataSource:'live',today:{date:pragueDay(now),count:publishedToday(deduplicated,now).length,complete:datedSources.every(name=>sources.some(s=>s.name===name&&s.ok))}},{headers:{'Cache-Control':'public, max-age=300'}})}
