import type {AuctionPersistenceConfig} from './auction-persistence.ts';
export type SourceHealth={code:string;name:string;enabled:boolean;last_attempt:string|null;last_finished:string|null;last_success:string|null;last_failure:string|null;item_count:number|null;success:boolean|null;last_error:string|null;consecutive_failures:number;last_nonempty:string|null};
export function healthWarnings(source:SourceHealth,now=Date.now()):string[]{
 if(!source.enabled)return [];
 const warnings:string[]=[];
 const age=(value:string|null)=>value&&Number.isFinite(Date.parse(value))?now-Date.parse(value):Infinity;
 if(!source.last_attempt)warnings.push('Sběr ještě neproběhl');
 else if(age(source.last_attempt)>12*3600000)warnings.push('Zdroj nebyl kontrolován více než 12 hodin');
 if(source.success===false)warnings.push('Poslední sběr selhal');
 if(source.consecutive_failures>=3)warnings.push('Nejméně tři po sobě jdoucí chyby');
 if(source.last_attempt&&age(source.last_success)>12*3600000)warnings.push('Více než 12 hodin bez úspěšného sběru');
 if(source.success===true&&source.item_count===0&&source.last_nonempty&&age(source.last_nonempty)>12*3600000)warnings.push('Dříve neprázdný zdroj více než 12 hodin nevrátil nabídky');
 return warnings;
}
export async function readSourceHealth(config:AuctionPersistenceConfig,fetcher:typeof fetch=fetch){
 const response=await fetcher(`${config.url.replace(/\/$/,'')}/rest/v1/auction_source_health?select=*&order=name`,{headers:{apikey:config.secret,Authorization:`Bearer ${config.secret}`}});
 if(!response.ok)throw Error(`Source health unavailable (${response.status})`);
 const sources=await response.json() as SourceHealth[];
 return sources.map(source=>({...source,warnings:healthWarnings(source)}));
}
