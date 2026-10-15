import {normalized} from './auction-core.ts';
import type {Listing} from './auction-import.ts';

/** Structured, lot-level evidence from an authoritative detail/document.
 * Never populate these fields by guessing from a generic listing title. */
export type AuctionIdentity={
 authority?:string;officialAuctionId?:string;lot?:string;
 proceeding?:string;notice?:string;
 cadastralCode?:string;parcels?:string[];share?:string;address?:string;
};
export type DedupEvidence={strongKeys:string[];reviewKeys:string[];facts:Record<string,string>};
const exact=(v?:string)=>v?.normalize('NFKC').toLowerCase().replace(/\s+/g,'').trim()||'';
const key=(kind:string,values:string[])=>values.every(Boolean)?JSON.stringify([kind,...values]):null;
export function dedupEvidence(item:Listing):DedupEvidence{
 const i=item.identity??{},strongKeys:string[]=[],reviewKeys:string[]=[];
 const add=(target:string[],value:string|null)=>{if(value)target.push(value)};
 // Local portal IDs are deliberately excluded. Both authority and lot matter.
 add(strongKeys,key('official-lot',[exact(i.authority),exact(i.officialAuctionId),exact(i.lot)]));
 add(strongKeys,key('notice-lot',[exact(i.authority),exact(i.proceeding),exact(i.notice),exact(i.lot)]));
 const at=Date.parse(item.date),when=Number.isFinite(at)?new Date(at).toISOString():'';
 const parcels=i.parcels?.length?[...new Set(i.parcels.map(exact))].sort().join(';'):'';
 // A parcel alone cannot distinguish shares, lots, or repeat auctions.
 add(strongKeys,key('parcel-sale',[exact(i.authority),exact(i.cadastralCode),parcels,exact(i.share),exact(i.lot),when]));
 add(reviewKeys,key('proceeding',[exact(i.authority),exact(i.proceeding)]));
 add(reviewKeys,key('address',[normalized(i.address),when]));
 add(reviewKeys,key('title-location-day',[normalized(item.title),normalized(item.location),when]));
 const facts=Object.fromEntries(Object.entries({authority:exact(i.authority),officialAuctionId:exact(i.officialAuctionId),lot:exact(i.lot),proceeding:exact(i.proceeding),cadastralCode:exact(i.cadastralCode),parcels,share:exact(i.share)}).filter(([,v])=>v));
 return {strongKeys,reviewKeys,facts};
}
export function dedupConfidence(a:DedupEvidence,b:DedupEvidence):'high'|'medium'|'none'{
 if(Object.entries(a.facts).some(([k,v])=>b.facts[k]&&b.facts[k]!==v))return 'none';
 if(a.strongKeys.some(k=>b.strongKeys.includes(k)))return 'high';
 return a.reviewKeys.some(k=>b.reviewKeys.includes(k))?'medium':'none';
}
