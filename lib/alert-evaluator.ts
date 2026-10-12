import {auctionRowToListing} from './auction-reader.ts';
import {listSavedFilters} from './owner-storage.ts';
import {matchesSavedFilter,validateSavedFilter} from './saved-filter.ts';
import type {SavedFilter} from './owner-storage.ts';
import type {AuctionPersistenceConfig} from './auction-persistence.ts';
export type AlertEvent={id:number;created_at:string;event_type:string;snapshot:Parameters<typeof auctionRowToListing>[0];metadata?:{previousSnapshot?:Parameters<typeof auctionRowToListing>[0]}};
export function matchingFilterIds(event:AlertEvent,filters:SavedFilter[]):string[]{
 const item=auctionRowToListing(event.snapshot);if(!item)return [];
 const previous=event.event_type!=='NEW_MATCH'&&event.metadata?.previousSnapshot?auctionRowToListing(event.metadata.previousSnapshot):null;
 return filters.filter(filter=>{
  if(!filter.active||Date.parse(filter.created_at)>Date.parse(event.created_at))return false;
  const validated=validateSavedFilter(filter);
  return matchesSavedFilter(item,validated.criteria)||Boolean(previous&&matchesSavedFilter(previous,validated.criteria));
 }).map(filter=>filter.id);
}
export async function evaluatePendingAlerts(config:AuctionPersistenceConfig,fetcher:typeof fetch=fetch,options:{maxBatches?:number;budgetMs?:number;now?:()=>number}={}){
 if(!config.leaseToken)throw Error('Alert evaluator requires collector lease');
 const headers={apikey:config.secret,Authorization:`Bearer ${config.secret}`,'Content-Type':'application/json'};
 const base=config.url.replace(/\/$/,'')+'/rest/v1/';
 const filters=await listSavedFilters(config,fetcher);
 // Bounded drain: committed events disappear from the pending query. A failed
 // completion is retried next run; its RPC is transactional and idempotent.
 const now=options.now??Date.now,start=now();
 const maxBatches=Math.max(1,Math.min(options.maxBatches??10,20));
 const budgetMs=Math.max(1,Math.min(options.budgetMs??90000,180000));
 let evaluated=0,notifications=0;
 for(let batch=0;batch<maxBatches;batch++){
  const response=await fetcher(base+'auction_alert_events?select=id,created_at,event_type,snapshot,metadata&evaluated_at=is.null&order=id&limit=500',{headers});
  if(!response.ok)throw Error(`Alert events unavailable (${response.status})`);
  const events=await response.json() as AlertEvent[];
  for(const event of events){
   if(now()-start>=budgetMs)return {evaluated,notifications,pending:true};
   const result=await fetcher(base+'rpc/complete_auction_alert',{method:'POST',headers,body:JSON.stringify({p_event_id:event.id,p_filter_ids:matchingFilterIds(event,filters),p_lease_token:config.leaseToken})});
   if(!result.ok)throw Error(`Alert evaluation failed (${result.status})`);
   notifications+=Number(await result.json());evaluated++;
  }
  if(events.length<500)return {evaluated,notifications,pending:false};
 }
 // Exact probe avoids reporting a full last batch as a backlog when drained.
 const remaining=await fetcher(base+'auction_alert_events?select=id&evaluated_at=is.null&order=id&limit=1',{headers});
 if(!remaining.ok)throw Error(`Alert backlog unavailable (${remaining.status})`);
 return {evaluated,notifications,pending:(await remaining.json() as unknown[]).length>0};
}

/** Visible even when the previous evaluator run failed before replying. */
export async function readAlertHealth(config:AuctionPersistenceConfig,fetcher:typeof fetch=fetch){
 const response=await fetcher(config.url.replace(/\/$/,'')+'/rest/v1/auction_alert_events?select=id,created_at&evaluated_at=is.null&order=id&limit=1',{
  headers:{apikey:config.secret,Authorization:`Bearer ${config.secret}`,Prefer:'count=exact'},
 });
 if(!response.ok)throw Error(`Alert health unavailable (${response.status})`);
 const rows=await response.json() as Array<{id:number;created_at:string}>;
 const total=response.headers.get('content-range')?.split('/')[1];
 const pendingCount=total&&/^\d+$/.test(total)?Number(total):null;
 return {pending:rows.length>0,pendingCount,oldestPendingAt:rows[0]?.created_at??null};
}
