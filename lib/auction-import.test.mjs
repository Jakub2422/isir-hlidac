import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cevd,parseBurzaSpravcu,parseExekutorOstrava} from './auction-import.ts';
import {toPersistableObservation} from './auction-observation.ts';
const html=readFileSync(new URL('./fixtures/burza-spravcu.html',import.meta.url),'utf8');
const burza=parseBurzaSpravcu(html);
assert.equal(burza.length,30);
assert.equal(burza.filter(x=>x.msk).length,4);
assert.ok(burza.every(x=>x.title!=='Zobrazit'));
const card='<h2><a href="/inzerat/brno/">Rodinný dům Brno</a></h2><a href="/inzerat/brno/">Zobrazit</a>';
assert.equal(parseBurzaSpravcu(card+'<p>Správce Ostrava</p>')[0].msk,false);
assert.equal(parseBurzaSpravcu(card+card).length,1);
assert.throws(()=>parseBurzaSpravcu('<html>Maintenance</html>'),/strukturu/);
const ostrava=parseExekutorOstrava(readFileSync(new URL('./fixtures/exekutor-ostrava.xml',import.meta.url),'utf8'));
assert.equal(ostrava.length,4);
assert.ok(ostrava.every(x=>!x.msk)); // Office address does not establish the property's location.
assert.equal(toPersistableObservation(ostrava.find(x=>/odročen/.test(x.title))).status,'postponed');
assert.throws(()=>parseExekutorOstrava('<html>Error</html>'),/RSS/);
for(const x of [...burza,...ostrava]){
 const p=toPersistableObservation(x);
 assert.ok(p?.sourceCode);assert.ok(p.canonicalKey);assert.equal(p.sourceUrl,x.url.replace(/\/$/,''));
 assert.equal(p.title,x.title);assert.equal(p.rawData.msk,x.msk);
}
console.log('collector regression: real Burza (30) and Ostrava (4), titles, region, status, normalization passed');

// The live CEVD API reports total before filtering Published items. Traverse
// every raw page, including a full page containing only unpublished entries.
const originalFetch=globalThis.fetch;
const item=id=>({id,name:'Pozemek Ostrava '+id,status:'Published',startingBid:0,auction:{}});
const page=Array.from({length:100},(_,i)=>item(i+1));
async function collect(pages,msk=false){
 const requests=[];
 globalThis.fetch=async input=>{
  const url=new URL(input);requests.push(url);
  const response=pages[requests.length-1];
  if(response instanceof Error)throw response;
  assert.ok(response,'Unexpected additional CEVD request');
  return Response.json(response);
 };
 try{return {items:await cevd(msk),requests};}finally{globalThis.fetch=originalFetch;}
}
const paginated=await collect([{total:149,items:page},{total:149,items:Array.from({length:49},(_,i)=>item(i+101))}]);
assert.equal(paginated.items.length,149);
assert.deepEqual(paginated.requests.map(u=>u.searchParams.get('skip')),['0','100']);
assert.ok(paginated.requests.every(u=>u.searchParams.get('categoryIds')==='1'));
assert.equal(paginated.items.at(-1).url,'https://cevd.gov.cz/seznam-drazeb/detail/149');
const regional=await collect([{total:101,items:page.map(x=>({...x,status:'Draft'}))},{total:101,items:[item(101)]}],true);
assert.equal(regional.items.length,1);
assert.ok(regional.requests.every(u=>u.searchParams.get('regionIds')==='132'));
assert.deepEqual((await collect([{total:0,items:[]}])).items,[]);
assert.equal((await collect([{items:page},{items:[item(101)]}])).items.length,101);
assert.equal((await collect([{total:100,items:page}])).requests.length,1);
await assert.rejects(()=>collect([{total:149,items:page},{total:149,items:page.slice(0,49)}]),/opakovaná/);
await assert.rejects(()=>collect([{total:149,items:page},{total:149,items:[]}]),/předčasný/);
await assert.rejects(()=>collect([{total:149,items:page},{total:150,items:[item(101)]}]),/změnil/);
await assert.rejects(()=>collect([{items:page},new Error('HTTP 503')]),/HTTP 503/);
await assert.rejects(()=>collect([{total:1,items:{}}]),/Neplatná/);
const overLimit=Array.from({length:25},(_,p)=>({total:2501,items:page.map(x=>item(p*100+x.id))}));
await assert.rejects(()=>collect(overLimit),/limit stránek/);
console.log('CEVD pagination: 149 items, region, raw status pages, exact boundary, empty, unknown total and incomplete/error cases passed');
