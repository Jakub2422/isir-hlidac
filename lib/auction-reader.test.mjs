import assert from 'node:assert/strict';
import {auctionRowToListing,readPersistedAuctions} from './auction-reader.ts';

const row={
 title:'Rodinný dům Ostrava',status:'listed',primary_url:'https://fallback.test/a',
 opening_price:'4500000',auction_at:'2026-10-20T08:00:00Z',published_at:'2026-10-06T07:00:00Z',
 auction_occurrences:[
  {source_url:'https://old.test/a',last_seen_at:'2026-10-05T08:00:00Z',raw_data:{source:'Starý',location:'Opava',msk:true}},
  {source_url:'https://cevd.gov.cz/a',source_status:'Published',last_seen_at:'2026-10-06T08:00:00Z',raw_data:{source:'CEVD',location:'Ostrava',msk:true,sourceStatus:'Published'},auction_sources:{name:'CEVD'}},
 ],
};
const mapped=auctionRowToListing(row);
assert.equal(mapped.source,'CEVD');
assert.equal(mapped.url,'https://cevd.gov.cz/a');
assert.equal(mapped.location,'Ostrava');
assert.equal(mapped.msk,true);
assert.equal(mapped.status,'Published');
assert.match(mapped.price,/4.*500.*000.*Kč/);
assert.equal(auctionRowToListing({title:'Bez URL'}),null);

const calls=[];
const items=await readPersistedAuctions({url:'https://project.supabase.co/',secret:'server-secret'},{msk:true,limit:500,fetcher:async(url,init)=>{
 calls.push({url,init});
 return new Response(JSON.stringify([row,{...row,title:'Praha',auction_occurrences:[{source_url:'https://x.test',last_seen_at:'2026-10-06T09:00:00Z',raw_data:{source:'CEVD',location:'Praha',msk:false}}]}]),{status:200,headers:{'Content-Type':'application/json'}});
}});
assert.equal(items.length,1);
assert.equal(items[0].title,'Rodinný dům Ostrava');
assert.match(calls[0].url,/rest\/v1\/auctions/);
assert.match(calls[0].url,/limit=500/);
assert.equal(calls[0].init.headers.apikey,'server-secret');
assert.equal(calls[0].init.headers.Authorization,'Bearer server-secret');

await assert.rejects(()=>readPersistedAuctions({url:'https://project.supabase.co',secret:'secret'},{fetcher:async()=>new Response('bad',{status:503})}),/503/);
console.log('auction-reader: 13 checks passed');
