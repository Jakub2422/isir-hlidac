import type {AuctionPersistenceConfig} from './auction-persistence.ts';
export async function collectorLease(action:'acquire'|'renew'|'release',token:string,config:AuctionPersistenceConfig,fetcher:typeof fetch=fetch):Promise<boolean>{
 const response=await fetcher(`${config.url.replace(/\/$/,'')}/rest/v1/rpc/${action}_collector_lease`,{
  method:'POST',headers:{apikey:config.secret,Authorization:`Bearer ${config.secret}`,'Content-Type':'application/json'},
  body:JSON.stringify({p_name:'auctions',p_token:token}),signal:AbortSignal.timeout(30000),
 });
 if(!response.ok)throw new Error(`Collector lease ${action} failed (${response.status})`);
 if(action==='release')return true;
 return await response.json()===true;
}

export function startCollectorHeartbeat(token:string,config:AuctionPersistenceConfig,fetcher:typeof fetch=fetch,intervalMs=60000){
 let lost=false;
 let pending:Promise<void>|null=null;
 const renew=()=>{
  if(pending)return pending;
  pending=collectorLease('renew',token,config,fetcher).then(ok=>{if(!ok)lost=true;}).catch(()=>{lost=true;}).finally(()=>{pending=null;});
  return pending;
 };
 const timer=setInterval(()=>{void renew();},intervalMs);
 return {
  async ensure(){if(lost)throw Error('Collector lease lost');await renew();if(lost)throw Error('Collector lease lost');},
  async stop(){clearInterval(timer);if(pending)await pending;},
 };
}
