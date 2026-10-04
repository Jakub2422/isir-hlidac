import assert from 'node:assert/strict';
import {recordAuctionCrawl} from './auction-crawl.ts';

const calls=[];
const id=await recordAuctionCrawl({
 sourceCode:'cevd',startedAt:'2026-10-04T20:00:00.000Z',finishedAt:'2026-10-04T20:00:05.000Z',
 success:true,completeSnapshot:false,itemsSeen:12,
},{url:'https://project.supabase.co/',secret:'server-secret'},async(url,init)=>{
 calls.push({url,headers:init.headers,body:JSON.parse(init.body)});
 return new Response('42',{status:200,headers:{'Content-Type':'application/json'}});
});
assert.equal(id,42);
assert.equal(calls[0].url,'https://project.supabase.co/rest/v1/rpc/record_auction_crawl_run');
assert.equal(calls[0].headers.Authorization,'Bearer server-secret');
assert.equal(calls[0].body.p_source_code,'cevd');
assert.equal(calls[0].body.p_items_seen,12);
assert.equal(calls[0].body.p_is_complete_snapshot,false);

await assert.rejects(()=>recordAuctionCrawl({
 sourceCode:'cevd',startedAt:'2026-10-04T20:00:00.000Z',finishedAt:'2026-10-04T20:00:05.000Z',
 success:false,completeSnapshot:false,itemsSeen:0,error:'down',
},{url:'https://project.supabase.co',secret:'secret'},async()=>new Response('failure',{status:503})),/503/);

console.log('auction-crawl: 7 checks passed');
