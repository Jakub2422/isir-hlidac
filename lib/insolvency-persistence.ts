import type {AuctionPersistenceConfig} from './auction-persistence.ts';
export type StoredIsirEvent={id:number;spis:string;published_at:string;description:string;document_url:string;verdict:string};
export type StoredIsirFinding={event_id:number;detected_at:string;district:string;city:string;kind:string;lv:string;parcel:string;description:string;document_url:string};
export async function persistInsolvencyObservation(event:StoredIsirEvent,finding:StoredIsirFinding|null,config:AuctionPersistenceConfig,fetcher:typeof fetch=fetch){
 if(!config.url||!config.secret)throw new Error('Supabase persistence is not configured');
 if(!Number.isSafeInteger(event.id)||event.id<=0||!event.spis)throw new Error('Invalid insolvency event');
 if(finding&&finding.event_id!==event.id)throw new Error('Finding event mismatch');
 const response=await fetcher(`${config.url.replace(/\/$/,'')}/rest/v1/rpc/upsert_insolvency_observation`,{
  method:'POST',headers:{apikey:config.secret,Authorization:`Bearer ${config.secret}`,'Content-Type':'application/json'},
  body:JSON.stringify({p_event:event,p_finding:finding}),signal:AbortSignal.timeout(20000),
 });
 if(!response.ok)throw new Error(`Supabase insolvency persistence failed (${response.status})`);
}
