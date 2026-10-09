import assert from 'node:assert/strict';
import {addFavorite,listFavoriteIds,listSavedFilters,removeFavorite,saveOwnerFilter,deleteOwnerFilter} from './owner-storage.ts';

import {isOwnerUser,isAuctionUuid} from './owner-access.ts';
assert.equal(isOwnerUser('owner','owner'),true);
assert.equal(isOwnerUser('other','owner'),false);
assert.equal(isOwnerUser('owner',undefined),false);
assert.equal(isOwnerUser(null,'owner'),false);
assert.equal(isAuctionUuid('11111111-2222-4333-8444-555555555555'),true);
assert.equal(isAuctionUuid('live-url'),false);
const config={url:'https://project.supabase.co/',secret:'server-secret'};
const calls=[];
const fetcher=async(url,init={})=>{
 calls.push({url,init});
 if(url.includes('owner_favorites?select='))return new Response(JSON.stringify([{auction_id:'a-1'},{auction_id:'a-2'}]),{status:200});
 if(url.includes('owner_saved_filters?'))return new Response(JSON.stringify([{id:'f-1',name:'MSK domy',criteria:{location:'Ostrava'},active:true,created_at:'2026-10-07',updated_at:'2026-10-07'}]),{status:200});
 return new Response(null,{status:204});
};
assert.deepEqual(await listFavoriteIds(config,fetcher),['a-1','a-2']);
await addFavorite(config,'11111111-2222-4333-8444-555555555555',fetcher);
await removeFavorite(config,'11111111-2222-4333-8444-555555555555',fetcher);
const filters=await listSavedFilters(config,fetcher);
assert.equal(filters[0].name,'MSK domy');
assert.equal(calls[0].init.headers.Authorization,'Bearer server-secret');
assert.equal(calls[1].init.method,'POST');
assert.match(calls[1].init.body,/11111111-2222-4333-8444-555555555555/);
assert.equal(calls[2].init.method,'DELETE');
assert.match(calls[2].url,/auction_id=eq/);
await assert.rejects(()=>listFavoriteIds(config,async()=>new Response('denied',{status:403})),/403/);
console.log('owner-storage: 9 checks passed');

const saved={name:'Ostrava',criteria:{location:'Ostrava'},active:true};
let write;
const writer=async(url,init)=>{write={url,init};return Response.json([{id:'f-1',...saved}])};
assert.equal((await saveOwnerFilter(config,saved,undefined,writer)).name,'Ostrava');
assert.equal(write.init.method,'POST');
await saveOwnerFilter(config,saved,'f-1',writer);assert.equal(write.init.method,'PATCH');assert.match(write.url,/id=eq.f-1/);
await deleteOwnerFilter(config,'f-1',writer);assert.equal(write.init.method,'DELETE');
await assert.rejects(()=>saveOwnerFilter(config,saved,'absent',async()=>Response.json([])),/nenalezen/);
