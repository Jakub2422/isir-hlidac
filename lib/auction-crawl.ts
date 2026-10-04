import type {AuctionPersistenceConfig} from './auction-persistence.ts';
import type {AuctionSourceCode} from './auction-source-registry.ts';

export type AuctionCrawlRecord={
 sourceCode:AuctionSourceCode;
 startedAt:string;
 finishedAt:string;
 success:boolean;
 completeSnapshot:boolean;
 itemsSeen:number;
 error?:string;
};

export async function recordAuctionCrawl(
 record:AuctionCrawlRecord,
 config:AuctionPersistenceConfig,
 fetcher:typeof fetch=fetch,
):Promise<number>{
 const response=await fetcher(`${config.url.replace(/\/$/,'')}/rest/v1/rpc/record_auction_crawl_run`,{
  method:'POST',
  headers:{apikey:config.secret,Authorization:`Bearer ${config.secret}`,'Content-Type':'application/json'},
  body:JSON.stringify({
   p_source_code:record.sourceCode,
   p_started_at:record.startedAt,
   p_finished_at:record.finishedAt,
   p_success:record.success,
   p_is_complete_snapshot:record.completeSnapshot,
   p_items_seen:record.itemsSeen,
   p_error:record.error??null,
  }),
 });
 if(!response.ok)throw new Error(`Supabase crawl record failed (${response.status}): ${(await response.text()).slice(0,500)}`);
 const value=await response.json();
 const id=typeof value==='number'?value:Number(value);
 if(!Number.isSafeInteger(id)||id<=0)throw new Error('Supabase crawl record returned invalid run id');
 return id;
}
