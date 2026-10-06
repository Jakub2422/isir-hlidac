import type {Listing} from './auction-import.ts';

export type AuctionReadConfig={url:string;secret:string};
type Source={name?:string};
type Occurrence={source_url?:string;source_status?:string;raw_data?:Record<string,unknown>;last_seen_at?:string;auction_sources?:Source|Source[]};
type AuctionRow={
 title?:string;status?:string;primary_url?:string;opening_price?:number|string|null;
 auction_at?:string|null;published_at?:string|null;metadata?:Record<string,unknown>;
 auction_occurrences?:Occurrence[];
};

const text=(v:unknown)=>typeof v==='string'?v:'';
const bool=(v:unknown)=>v===true;
const price=(v:unknown)=>v===null||v===undefined||v===''?'':Number.isFinite(Number(v))?`${Number(v).toLocaleString('cs-CZ')} Kč`:'';

function newestOccurrence(rows:Occurrence[]=[]){
 return [...rows].sort((a,b)=>Date.parse(b.last_seen_at||'')-Date.parse(a.last_seen_at||''))[0];
}

export function auctionRowToListing(row:AuctionRow):Listing|null{
 const occurrence=newestOccurrence(row.auction_occurrences);
 const raw=occurrence?.raw_data||row.metadata||{};
 const sourceRef=occurrence?.auction_sources;
 const sourceName=Array.isArray(sourceRef)?sourceRef[0]?.name:sourceRef?.name;
 const url=text(occurrence?.source_url)||text(row.primary_url);
 const title=text(row.title);
 if(!title||!url)return null;
 return {
  source:text(raw.source)||text(sourceName)||'Uložená dražba',
  title,url,
  date:text(row.auction_at),
  published:text(row.published_at),
  price:price(row.opening_price),
  location:text(raw.location),
  msk:bool(raw.msk),
  status:text(raw.sourceStatus)||text(occurrence?.source_status)||text(row.status),
 };
}

export async function readPersistedAuctions(
 config:AuctionReadConfig,
 options:{limit?:number;msk?:boolean;fetcher?:typeof fetch}={},
):Promise<Listing[]>{
 const limit=Math.max(1,Math.min(options.limit??250,1000));
 const select='title,status,primary_url,opening_price,auction_at,published_at,metadata,auction_occurrences(source_url,source_status,raw_data,last_seen_at,auction_sources(name))';
 const url=`${config.url.replace(/\/$/,'')}/rest/v1/auctions?select=${encodeURIComponent(select)}&order=published_at.desc.nullslast,last_seen_at.desc&limit=${limit}`;
 const response=await (options.fetcher??fetch)(url,{headers:{apikey:config.secret,Authorization:`Bearer ${config.secret}`}});
 if(!response.ok)throw new Error(`Supabase auction read failed (${response.status}): ${(await response.text()).slice(0,500)}`);
 const rows=await response.json() as AuctionRow[];
 return rows.map(auctionRowToListing).filter((x):x is Listing=>Boolean(x)).filter(x=>!options.msk||x.msk);
}
