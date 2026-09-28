import type {Listing} from './auction-import';

export type AuctionCategory='real_estate'|'vehicle'|'other';
export type AuctionObservation=Listing&{
 externalId?:string;category?:AuctionCategory;subcategory?:string;proceeding?:string;
 address?:string;municipality?:string;district?:string;region?:string;
 cadastralArea?:string;parcel?:string;titleDeed?:string;vin?:string;
 partyRegistration?:string;partyName?:string;openingPrice?:number;estimatedPrice?:number;
 auctionAt?:string;publishedAt?:string;documents?:Array<{url:string;title?:string;type?:string}>;
 photos?:string[];description?:string;
};

function normalized(value?:string){return (value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('cs-CZ').replace(/[^a-z0-9]+/g,' ').trim()}
function day(value?:string){if(!value)return '';const m=/^(\d{4}-\d\d-\d\d)/.exec(value);return m?.[1]||''}
export function stableUrl(value:string){try{const u=new URL(value);u.hash='';for(const key of [...u.searchParams.keys()]){if(/^(utm_.+|fbclid|gclid)$/i.test(key))u.searchParams.delete(key)}u.searchParams.sort();return u.toString().replace(/\/$/,'')}catch{return value}}

/** A weak title match must never merge two distinct lots. */
export function matchEvidence(a:AuctionObservation,b:AuctionObservation):string|null{
 if(normalized(a.source)===normalized(b.source)&&a.externalId&&b.externalId&&a.externalId===b.externalId)return 'source_id';
 if(stableUrl(a.url)===stableUrl(b.url))return 'source_url';
 const sameDay=!!day(a.auctionAt||a.date)&&day(a.auctionAt||a.date)===day(b.auctionAt||b.date);
 const sameParty=!!normalized(a.partyRegistration||a.partyName)&&normalized(a.partyRegistration||a.partyName)===normalized(b.partyRegistration||b.partyName);
 if(!sameDay||!sameParty)return null;
 if(a.vin&&b.vin&&normalized(a.vin)===normalized(b.vin))return 'vin_day_party';
 if(a.parcel&&b.parcel&&a.cadastralArea&&b.cadastralArea&&normalized(a.parcel)===normalized(b.parcel)&&normalized(a.cadastralArea)===normalized(b.cadastralArea))return 'parcel_day_party';
 if(a.address&&b.address&&normalized(a.address)===normalized(b.address)&&a.openingPrice!=null&&a.openingPrice===b.openingPrice)return 'address_day_party_price';
 return null;
}

export function sourceKey(x:AuctionObservation){return `${normalized(x.source)}:${x.externalId||stableUrl(x.url)}`}
export function canonicalKey(x:AuctionObservation){
 const category=classify(x.title,x.category);
 if(x.vin)return `${category}:vin:${normalized(x.vin)}`;
 if(x.parcel&&x.cadastralArea)return `${category}:parcel:${normalized(x.cadastralArea)}:${normalized(x.parcel)}`;
 return `${category}:source:${sourceKey(x)}`;
}
export function classify(title:string,sourceCategory?:string):AuctionCategory{
 if(sourceCategory==='real_estate'||sourceCategory==='vehicle')return sourceCategory;
 if(/(?:byt|dům|domu|pozem|nemovit|parcel|stavb|garáž|chalup|chata|budov|jednotk)/i.test(title))return 'real_estate';
 if(/(?:vozidl|auto\b|automobil|motocykl|nákladní|traktor|přívěs|škoda|volkswagen|bmw|mercedes|ford)/i.test(title))return 'vehicle';
 return 'other';
}

export const TRACKED_FIELDS=['title','openingPrice','estimatedPrice','auctionAt','publishedAt','status','description'] as const;
export function changes(previous:AuctionObservation,next:AuctionObservation){return TRACKED_FIELDS.flatMap(field=>{
 const oldValue=previous[field],newValue=next[field];
 if(newValue===undefined||newValue===''||oldValue===newValue)return [];
 return [{field,oldValue:oldValue??null,newValue}];
});}
