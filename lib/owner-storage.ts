export type OwnerFeature = 'favorite' | 'saved_filter';
export type OwnerStorageConfig = { url: string; secret: string };
export type SavedFilter = { id: string; name: string; criteria: Record<string, unknown>; active: boolean; created_at: string; updated_at: string };

const base=(config:OwnerStorageConfig,path:string)=>`${config.url.replace(/\/$/,'')}/rest/v1/${path}`;
const headers=(config:OwnerStorageConfig,extra:Record<string,string>={})=>({apikey:config.secret,Authorization:`Bearer ${config.secret}`,'Content-Type':'application/json',...extra});
const check=async(response:Response)=>{if(!response.ok)throw new Error(`Owner storage failed (${response.status}): ${(await response.text()).slice(0,500)}`)};

export async function listFavoriteIds(config:OwnerStorageConfig,fetcher:typeof fetch=fetch):Promise<string[]>{
 const response=await fetcher(base(config,'owner_favorites?select=auction_id&order=created_at.desc'),{headers:headers(config)});
 await check(response); return (await response.json() as {auction_id:string}[]).map(x=>x.auction_id);
}
export async function addFavorite(config:OwnerStorageConfig,auctionId:string,fetcher:typeof fetch=fetch){
 const response=await fetcher(base(config,'owner_favorites'),{method:'POST',headers:headers(config,{Prefer:'resolution=ignore-duplicates'}),body:JSON.stringify({auction_id:auctionId})});
 await check(response);
}
export async function removeFavorite(config:OwnerStorageConfig,auctionId:string,fetcher:typeof fetch=fetch){
 const response=await fetcher(base(config,`owner_favorites?auction_id=eq.${encodeURIComponent(auctionId)}`),{method:'DELETE',headers:headers(config)});
 await check(response);
}
export async function listSavedFilters(config:OwnerStorageConfig,fetcher:typeof fetch=fetch):Promise<SavedFilter[]>{
 const response=await fetcher(base(config,'owner_saved_filters?select=id,name,criteria,active,created_at,updated_at&order=created_at.desc'),{headers:headers(config)});
 await check(response); return response.json() as Promise<SavedFilter[]>;
}
