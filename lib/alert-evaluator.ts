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
export async function evaluatePendingAlerts(config:AuctionPersistenceConfig,fetcher:typeof fetch=fetch){
 if(!config.leaseToken)throw Error('Alert evaluator requires collector lease');
 const headers={apikey:config.secret,Authorization:`Bearer ${config.secret}`,'Content-Type':'application/json'};
 const base=config.url.replace(/\/$/,'')+'/rest/v1/';
 const filters=await listSavedFilters(config,fetcher);
 // Bound work per request; unevaluated events persist for subsequent runs.
 const response=await fetcher(base+'auction_alert_events?select=id,created_at,event_type,snapshot,metadata&evaluated_at=is.null&order=id&limit=500',{headers});
 if(!response.ok)throw Error(`Alert events unavailable (${response.status})`);
 const events=await response.json() as AlertEvent[];let notifications=0;
 for(const event of events){
  const result=await fetcher(base+'rpc/complete_auction_alert',{method:'POST',headers,body:JSON.stringify({p_event_id:event.id,p_filter_ids:matchingFilterIds(event,filters),p_lease_token:config.leaseToken})});
  if(!result.ok)throw Error(`Alert evaluation failed (${result.status})`);
  notifications+=Number(await result.json());
 }
 return {evaluated:events.length,notifications,pending:events.length===500};
}
