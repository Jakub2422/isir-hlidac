import {env} from 'cloudflare:workers';
import {persistAuctionListings} from '@/lib/auction-persistence';
import {recordAuctionCrawl} from '@/lib/auction-crawl';
import {collectorOutcome} from '@/lib/collector-outcome';
import {sourceCodeFor} from '@/lib/auction-source-registry';
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

 const startedAt=new Date().toISOString();
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

 const finishedAt=new Date().toISOString();
 const config={url:supabaseUrl,secret:supabaseSecret};
 const crawlRecords=await Promise.allSettled(sources.map(async source=>{
  const sourceCode=sourceCodeFor({source:source.name});
  if(!sourceCode)throw new Error(`Unregistered auction source: ${source.name}`);
  const runId=await recordAuctionCrawl({
   sourceCode,startedAt,finishedAt,success:source.ok,completeSnapshot:false,
   itemsSeen:source.count,error:source.error,
  },config);
  return {source:source.name,runId};
 }));

 const unique=[...new Map(listings.map(item=>[`${item.source}\n${item.url}`,item])).values()];
 const persistence=await persistAuctionListings(unique,config);
 const crawlTracking={recorded:crawlRecords.filter(x=>x.status==='fulfilled').length,failed:crawlRecords.filter(x=>x.status==='rejected').length};
 const outcome=collectorOutcome(sources,persistence.failed,crawlTracking.failed);
 return Response.json({
  fetched:unique.length,
  persistence,
  sources,
  crawlTracking,
  complete:outcome.complete,
  finalizedMissing:false,
  fetchedAt:new Date().toISOString(),
 },{
  status:outcome.status,
  headers:{'Cache-Control':'no-store'},
 });
}
