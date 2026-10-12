import {env} from 'cloudflare:workers';
import {persistAuctionListings} from '@/lib/auction-persistence';
import {recordAuctionCrawl} from '@/lib/auction-crawl';
import {collectorLease,startCollectorHeartbeat} from '@/lib/collector-lease';
import {collectorOutcome} from '@/lib/collector-outcome';
import {evaluatePendingAlerts} from '@/lib/alert-evaluator';
import {sourceCodeFor} from '@/lib/auction-source-registry';
import {exekutorOstrava,asis,burzaSpravcu,cevd,drazbyExekutori,drazbyProst,elektronickeDrazby,exdrazby,financial,insolvencniZamery,karvina,okdrazby,portalDrazeb,portalElektronickych,prokonzulta,spravaZeleznic,uzsvm,type Listing} from '@/lib/auction-import';

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

 const leaseToken=crypto.randomUUID();
 const config={url:supabaseUrl,secret:supabaseSecret,leaseToken};
 try{
  if(!await collectorLease('acquire',leaseToken,config))return Response.json({busy:true},{status:409});
 }catch{return Response.json({error:'Collector lock unavailable'},{status:503});}
 const heartbeat=startCollectorHeartbeat(leaseToken,config);
 try{
 const tasks=[
  ['CEVD',()=>cevd(false)],['Portál dražeb',()=>portalDrazeb(false)],
  ['Finanční správa',financial],['ÚZSVM – aukce majetku',()=>uzsvm(false)],
  ['Insolvenční záměry',insolvencniZamery],['OKdražby',okdrazby],
  ['exdrazby',()=>exdrazby(false)],['dražby-exekutoři',drazbyExekutori],
  ['Správa železnic – prodej',spravaZeleznic],['Prokonzulta',prokonzulta],
  ['ASIS – insolvenční majetek',asis],['Burza správců – nemovitosti',burzaSpravcu],['Exekutorský úřad Ostrava',exekutorOstrava],['Aukce města Karviná',karvina],
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
 await heartbeat.ensure();
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
 await heartbeat.ensure();
 const persistence=await persistAuctionListings(unique,config);
 await heartbeat.ensure();
 const alerts=await evaluatePendingAlerts(config);
 const crawlTracking={recorded:crawlRecords.filter(x=>x.status==='fulfilled').length,failed:crawlRecords.filter(x=>x.status==='rejected').length};
 const outcome=collectorOutcome(sources,persistence.failed,crawlTracking.failed);
 return Response.json({
  fetched:unique.length,
  persistence,
  alerts,
  sources,
  crawlTracking,
  complete:outcome.complete,
  finalizedMissing:false,
  fetchedAt:new Date().toISOString(),
 },{
  status:outcome.status,
  headers:{'Cache-Control':'no-store'},
 });
 }catch{
  return Response.json({error:'Collector stopped: lease or database unavailable'},{status:503});
 }finally{
  await heartbeat.stop();
  await collectorLease('release',leaseToken,config).catch(()=>console.error('Collector lease release failed'));
 }
}
