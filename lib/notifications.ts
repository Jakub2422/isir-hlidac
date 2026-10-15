import type {OwnerStorageConfig} from './owner-storage.ts';
export type Notification={id:string;auction_id:string;event_type:string;created_at:string;read_at:string|null;metadata:{title?:string;url?:string;filterName?:string;old?:unknown;new?:unknown}};
export async function notifications(config:OwnerStorageConfig,id?:string,fetcher:typeof fetch=fetch){
 const url=config.url.replace(/\/$/,'')+'/rest/v1/owner_notifications';
 const headers={apikey:config.secret,Authorization:`Bearer ${config.secret}`,'Content-Type':'application/json'};
 const response=id===undefined?await fetcher(url+'?select=id,auction_id,event_type,created_at,read_at,metadata&order=created_at.desc&limit=200',{headers}):await fetcher(url+'?read_at=is.null'+(id==='all'?'':'&id=eq.'+encodeURIComponent(id)),{method:'PATCH',headers,body:JSON.stringify({read_at:new Date().toISOString()})});
 if(!response.ok)throw Error(`Notifications unavailable (${response.status})`);
 return id===undefined?await response.json() as Notification[]:[];
}
