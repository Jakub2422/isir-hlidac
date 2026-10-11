import type {AuctionPersistenceConfig} from './auction-persistence.ts';
export async function collectorLease(action:'acquire'|'release',token:string,config:AuctionPersistenceConfig,fetcher:typeof fetch=fetch):Promise<boolean>{
 const response=await fetcher(`${config.url.replace(/\/$/,'')}/rest/v1/rpc/${action}_collector_lease`,{
  method:'POST',headers:{apikey:config.secret,Authorization:`Bearer ${config.secret}`,'Content-Type':'application/json'},
  body:JSON.stringify({p_name:'auctions',p_token:token}),
 });
 if(!response.ok)throw new Error(`Collector lease ${action} failed (${response.status})`);
 if(action==='release')return true;
 return await response.json()===true;
}
