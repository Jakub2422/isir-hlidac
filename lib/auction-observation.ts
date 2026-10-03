import {canonicalKey,classify,stableUrl,type AuctionObservation} from './auction-core.ts';
import {sourceCodeFor,type AuctionSourceCode} from './auction-source-registry.ts';
import type {Listing} from './auction-import.ts';

export type PersistableAuctionObservation={
 sourceCode:AuctionSourceCode;
 canonicalKey:string;
 externalId:string|null;
 sourceUrl:string;
 title:string;
 category:'real_estate'|'vehicle'|'other';
 status:'listed'|'scheduled'|'ongoing'|'postponed'|'cancelled'|'finished'|'unknown';
 openingPrice:number|null;
 auctionAt:string|null;
 publishedAt:string|null;
 rawData:Record<string,unknown>;
};

export function parseCzk(value?:string):number|null{
 if(!value)return null;
 const normalized=value.replace(/\u00a0/g,' ').replace(/[^\d,.-]/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.');
 const amount=Number(normalized);
 return Number.isFinite(amount)&&amount>=0?amount:null;
}

export function isoDate(value?:string):string|null{
 if(!value?.trim())return null;
 const time=Date.parse(value);
 return Number.isFinite(time)?new Date(time).toISOString():null;
}

export function normalizedAuctionStatus(value?:string):PersistableAuctionObservation['status']{
 const s=(value||'').toLocaleLowerCase('cs-CZ');
 if(/cancel|zruš|zrus/.test(s))return 'cancelled';
 if(/postpon|odroč|odroc|odlož|odloz/.test(s))return 'postponed';
 if(/finish|ukonč|ukonc|skonč|skonc/.test(s))return 'finished';
 if(/ongoing|probíh|probih|právě|prave/.test(s))return 'ongoing';
 if(/scheduled|připrav|priprav|plán|plan/.test(s))return 'scheduled';
 if(/publish|zveřej|zverej|aktuál|aktual|nabíd|nabid|záměr|zamer|aukce|řízení|rizeni/.test(s))return 'listed';
 return 'unknown';
}

export function externalIdFor(sourceCode:AuctionSourceCode,sourceUrl:string):string|null{
 try{
  const url=new URL(sourceUrl);
  const path=url.pathname.replace(/\/+$/,'');
  const patterns:Partial<Record<AuctionSourceCode,RegExp>>={
   'cevd':/\/detail\/([^/]+)$/i,
   'portal-drazeb':/\/drazba\/([^/]+)$/i,
   'uzsvm':/\/AuctionDetail\/([^/]+)$/i,
   'exdrazby':/\/drazba\/([^/]+)$/i,
   'portal-elektronickych':/\/(?:drazba|auction|detail)\/([^/]+)$/i,
   'elektronicke-drazby':/\/view\/([^/]+)$/i,
  };
  const match=patterns[sourceCode]?.exec(path);
  if(match?.[1])return decodeURIComponent(match[1]);
  if(sourceCode==='sprava-zeleznic')return url.searchParams.get('id');
  if(sourceCode==='insolvencni-zamery')return url.searchParams.get('hash');
 }catch{}
 return null;
}

export function toPersistableObservation(listing:Listing):PersistableAuctionObservation|null{
 const sourceCode=sourceCodeFor(listing);
 if(!sourceCode||!listing.url||!listing.title)return null;
 const observation:AuctionObservation={
  ...listing,
  openingPrice:parseCzk(listing.price)??undefined,
  auctionAt:isoDate(listing.date)??undefined,
  publishedAt:isoDate(listing.published)??undefined,
 };
 return {
  sourceCode,
  canonicalKey:canonicalKey(observation),
  externalId:externalIdFor(sourceCode,stableUrl(listing.url)),
  sourceUrl:stableUrl(listing.url),
  title:listing.title.trim(),
  category:classify(listing.title),
  status:normalizedAuctionStatus(listing.status),
  openingPrice:observation.openingPrice??null,
  auctionAt:observation.auctionAt??null,
  publishedAt:observation.publishedAt??null,
  rawData:{source:listing.source,location:listing.location,msk:listing.msk,sourceStatus:listing.status},
 };
}
