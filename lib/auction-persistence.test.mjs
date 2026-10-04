import assert from 'node:assert/strict';
import {persistAuctionListing,persistAuctionListings} from './auction-persistence.ts';

const listing={
 source:'CEVD',title:'Rodinný dům Ostrava',
 url:'https://cevd.gov.cz/seznam-drazeb/detail/42?utm_source=test',
 date:'2026-10-05T10:00:00+02:00',published:'2026-10-01T08:00:00+02:00',
 price:'4 500 000 Kč',location:'Ostrava',msk:true,status:'Published',
};
const calls=[];
const fetcher=async(url,init)=>{
 calls.push({url,init,body:JSON.parse(init.body)});
 return new Response(JSON.stringify([{auction_id:'a',occurrence_id:'o',created:true}]),{status:200,headers:{'Content-Type':'application/json'}});
};
const saved=await persistAuctionListing(listing,{url:'https://project.supabase.co/',secret:'server-secret'},fetcher);
assert.deepEqual(saved,{created:true,auctionId:'a',occurrenceId:'o'});
assert.equal(calls.length,1);
assert.equal(calls[0].url,'https://project.supabase.co/rest/v1/rpc/upsert_auction_observation');
assert.equal(calls[0].init.headers.apikey,'server-secret');
assert.equal(calls[0].init.headers.Authorization,'Bearer server-secret');
assert.equal(calls[0].body.p_source_code,'cevd');
assert.equal(calls[0].body.p_source_external_id,'42');
assert.equal(calls[0].body.p_source_url,'https://cevd.gov.cz/seznam-drazeb/detail/42');
assert.equal(calls[0].body.p_opening_price,4500000);

const mixed=await persistAuctionListings([
 listing,
 {...listing,url:'https://cevd.gov.cz/seznam-drazeb/detail/43'},
 {...listing,source:'Neznámý zdroj'},
],{url:'https://project.supabase.co',secret:'secret'},{
 concurrency:2,
 fetcher:async(_url,init)=>{
  const body=JSON.parse(init.body);
  if(body.p_source_external_id==='43')return new Response('temporary failure',{status:503});
  return new Response(JSON.stringify([{auction_id:'existing-auction',occurrence_id:'existing-occurrence',created:false}]),{status:200,headers:{'Content-Type':'application/json'}});
 },
});
assert.equal(mixed.persisted,1);
assert.equal(mixed.created,0);
assert.equal(mixed.skipped,1);
assert.equal(mixed.failed,1);
assert.equal(mixed.occurrences.length,1);
assert.equal(mixed.occurrences[0].occurrenceId,'existing-occurrence');
assert.equal(mixed.errors.length,1);
assert.match(mixed.errors[0].error,/503/);

const missingIds=await persistAuctionListings([listing],{url:'https://project.supabase.co',secret:'secret'},{
 fetcher:async()=>new Response(JSON.stringify([{created:true}]),{status:200,headers:{'Content-Type':'application/json'}}),
});
assert.equal(missingIds.persisted,0);
assert.equal(missingIds.failed,1);
assert.match(missingIds.errors[0].error,/no identifiers/);

console.log('auction-persistence: 20 checks passed');
