import {toPersistableObservation} from './auction-observation.ts';
import type {Listing} from './auction-import.ts';

export type AuctionPersistenceConfig={
 url:string;
 secret:string;
};

export type AuctionPersistenceResult={
 persisted:number;
 created:number;
 skipped:number;
 failed:number;
 errors:Array<{url:string;error:string}>;
 occurrences:Array<{source:string;auctionId:string;occurrenceId:string;url:string}>;
};

type RpcResult={auction_id:string;occurrence_id:string;created:boolean};

function endpoint(config:AuctionPersistenceConfig){
 return `${config.url.replace(/\/$/,'')}/rest/v1/rpc/upsert_auction_observation`;
}

export async function persistAuctionListing(
 listing:Listing,
 config:AuctionPersistenceConfig,
 fetcher:typeof fetch=fetch,
):Promise<{created:boolean;auctionId:string;occurrenceId:string}|null>{
 const item=toPersistableObservation(listing);
 if(!item)return null;
 const response=await fetcher(endpoint(config),{
  method:'POST',
  headers:{
   apikey:config.secret,
   Authorization:`Bearer ${config.secret}`,
   'Content-Type':'application/json',
  },
  body:JSON.stringify({
   p_source_code:item.sourceCode,
   p_canonical_key:item.canonicalKey,
   p_source_external_id:item.externalId,
   p_source_url:item.sourceUrl,
   p_title:item.title,
   p_category:item.category,
   p_status:item.status,
   p_opening_price:item.openingPrice,
   p_auction_at:item.auctionAt,
   p_published_at:item.publishedAt,
   p_raw_data:item.rawData,
  }),
 });
 if(!response.ok){
  const detail=(await response.text()).slice(0,500);
  throw new Error(`Supabase auction upsert failed (${response.status}): ${detail}`);
 }
 const rows=await response.json() as RpcResult[];
 const row=rows[0];
 if(!row?.auction_id||!row.occurrence_id)throw new Error('Supabase auction upsert returned no identifiers');
 return {created:Boolean(row.created),auctionId:row.auction_id,occurrenceId:row.occurrence_id};
}

export async function persistAuctionListings(
 listings:Listing[],
 config:AuctionPersistenceConfig,
 options:{concurrency?:number;fetcher?:typeof fetch}={},
):Promise<AuctionPersistenceResult>{
 const result:AuctionPersistenceResult={persisted:0,created:0,skipped:0,failed:0,errors:[],occurrences:[]};
 const concurrency=Math.max(1,Math.min(options.concurrency??6,12));
 const fetcher=options.fetcher??fetch;
 let cursor=0;
 async function worker(){
  while(true){
   const index=cursor++;
   if(index>=listings.length)return;
   const listing=listings[index];
   try{
    const saved=await persistAuctionListing(listing,config,fetcher);
    if(!saved){result.skipped++;continue}
    result.persisted++;
    result.occurrences.push({source:listing.source,auctionId:saved.auctionId,occurrenceId:saved.occurrenceId,url:listing.url});
    if(saved.created)result.created++;
   }catch(error){
    result.failed++;
    result.errors.push({url:listing.url,error:error instanceof Error?error.message:'Unknown persistence error'});
   }
  }
 }
 await Promise.all(Array.from({length:Math.min(concurrency,listings.length)},()=>worker()));
 return result;
}
