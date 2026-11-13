import type {AuctionIdentity} from './auction-dedup.ts';
export type Listing={potentialDuplicateIds?:string[];identity?:AuctionIdentity;provenance?:Array<{source:string;url:string}>;auctionId?:string;source:string;title:string;url:string;date:string;published:string;price:string;location:string;msk:boolean;status:string};
const region=/(?:moravskoslezsk|ostrav(?:a|ě|y)|karvin(?:á|é|ou)|havířov|bohumín|orlová|český těšín|frýdek.místek|třinec|opav(?:a|ě)|krnov|bruntál|nový jičín|kopřivnic(?:e|i)|rymařov|rýmařov|příbor|rychvald|komorní lhotka|milíkov|šilheřovic|jablunkov|frenštát|bílovec|fulnek|hlučín|petřvald|dolní lutyn|čeladn|frýdlant nad ostravic)/i;
const property=/(?:nemovit|pozem|parcel|rodinn|dům|domu|byt\b|bytov|budov|stavb|garáž|jednotk|chata|chalup)/i;
function decode(s:string){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&(?:amp|lt|gt|quot|apos|nbsp|#x[\da-f]+|#\d+);/gi,v=>{const m:Record<string,string>={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '};if(m[v])return m[v];let n=0;if(/^&#x/i.test(v))n=parseInt(v.slice(3,-1),16);else if(/^&#/.test(v))n=parseInt(v.slice(2,-1),10);return n>0&&n<0x110000?String.fromCodePoint(n):v}).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()}
function safeLink(value:string,base:string){try{const u=new URL(decode(value),base);return u.protocol==='https:'?u.href:''}catch{return ''}}
async function get(url:string,max=1_600_000){const res=await fetch(url,{signal:AbortSignal.timeout(18000),headers:{'Accept':'text/html, application/json, application/rss+xml, */*','User-Agent':'ISIR-Reality-MSK/1.0'}});if(!res.ok)throw Error('HTTP '+res.status);const len=Number(res.headers.get('content-length')||0);if(len>max)throw Error('Příliš velká odpověď');const body=await res.text();if(body.length>max)throw Error('Příliš velká odpověď');return {body,res}}
function unique(a:Listing[]){return [...new Map(a.filter(x=>x.url&&x.title).map(x=>[x.url,x])).values()]}
export async function cevd(msk:boolean):Promise<Listing[]>{
 const pageSize=100,maxPages=25;
 const p=new URLSearchParams({take:String(pageSize),skip:'0',categoryIds:'1',eventStartDateFrom:new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Prague'}),orderBy:'auction.publicationDate desc'});
 if(msk)p.set('regionIds','132');
 type Item={id:number;name:string;status:string;startingBid:number|null;description?:string;auction?:{eventStart?:string;publicationDate?:string;status?:string;number?:string}};
 const items:Item[]=[],seen=new Set<number>();let expectedTotal:number|undefined;
 for(let page=0;page<maxPages;page++){
  p.set('skip',String(page*pageSize));
  const {body}=await get('https://cevd.gov.cz/api/auctions/items?'+p,4_000_000);
  const j=JSON.parse(body) as {items:Item[];total?:number};
  if(!Array.isArray(j.items)||j.items.length>pageSize)throw Error('Neplatná odpověď CEVD');
  if(j.total!==undefined){
   if(!Number.isSafeInteger(j.total)||j.total<0)throw Error('CEVD: neplatný celkový počet');
   if(expectedTotal!==undefined&&j.total!==expectedTotal)throw Error('CEVD: katalog se během stránkování změnil; sběr není úplný');
   expectedTotal=j.total;
  }
  for(const item of j.items){
   if(!Number.isSafeInteger(item.id)||seen.has(item.id))throw Error('CEVD: opakovaná nebo neplatná stránka; sběr není úplný');
   seen.add(item.id);items.push(item);
  }
  if(expectedTotal!==undefined&&items.length>expectedTotal)throw Error('CEVD: nesouhlasí celkový počet');
  const done=expectedTotal!==undefined?items.length===expectedTotal:j.items.length<pageSize;
  if(done)return items.map(x=>({source:'CEVD',title:x.name||'Nemovitost',url:'https://cevd.gov.cz/seznam-drazeb/detail/'+x.id,date:x.auction?.eventStart||'',published:x.auction?.publicationDate||'',price:x.startingBid!=null?`${x.startingBid.toLocaleString('cs-CZ')} Kč`:'',location:x.name||'',msk:msk||region.test((x.name||'')+' '+(x.description||'').slice(0,500)),status:x.status||x.auction?.status||''})).filter(x=>x.status==='Published'&&x.url);
  if(j.items.length<pageSize)throw Error('CEVD: předčasný konec katalogu; sběr není úplný');
 }
 throw Error('CEVD: dosažen limit stránek; sběr není úplný');
}
export async function financial():Promise<Listing[]>{const {body}=await get('https://financnisprava.gov.cz/cs/financni-sprava/drazby-financni-spravy/drazby-prehled?rss=1');if(!/<rss\b/i.test(body))throw Error('Neplatný RSS');const out:Listing[]=[];for(const m of body.matchAll(/<item>([\s\S]*?)<\/item>/gi)){const field=(k:string)=>decode(new RegExp('<'+k+'>([\\s\\S]*?)<\\/'+k+'>','i').exec(m[1])?.[1]||'');const title=field('description'),location=title,url=safeLink(field('link'),'https://financnisprava.gov.cz');if(!property.test(title)||!url.startsWith('https://financnisprava.gov.cz/'))continue;out.push({source:'Finanční správa',title,url,date:field('pubDate'),published:'',price:'',location,msk:region.test(location),status:'Aktuální v RSS'})}return unique(out)}
export async function okdrazby():Promise<Listing[]>{const base='https://okdrazby.cz/';const {body}=await get(base);const a:Listing[]=[];for(const m of body.matchAll(/<a[^>]+class="AuctionsList_auctionName[^"\n]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)){const title=decode(m[2]);if(!property.test(title))continue;const tail=body.slice(m.index,m.index+850);const date=decode(/AuctionsList_auctionExactDateTime[^>]*>(.*?)<\/span>/i.exec(tail)?.[1]||'');const url=safeLink(m[1],base);a.push({source:'OKdražby',title,url,date,published:'',price:'',location:title,msk:region.test(title),status:'Zveřejněno na portálu'})}return unique(a)}
const prokonzultaOrigin='https://www.prokonzulta.cz';
const prokonzultaCategory='1921b5dd-a67e-40f8-9e32-b90e7cf40bda';
const prokonzultaMsk='3d23f9ff-1c39-4412-a18a-6098a8345381';
function attr(tag:string,name:string){return new RegExp('(?:^|\\s)'+name+'=(?:"([^"]*)"|\'([^\']*)\')','i').exec(tag)?.slice(1).find(x=>x!==undefined)||''}
async function scanProkonzulta(msk:boolean):Promise<{items:Listing[];complete:boolean}>{
 const categoryPath='/category/'+prokonzultaCategory;
 const first=new URL(categoryPath,prokonzultaOrigin);
 if(msk)first.searchParams.set('region',prokonzultaMsk);
 const seen=new Set<string>(),items:Listing[]=[];
 let next=first.href,total:number|undefined,read=0;
 const started=Date.now();
 for(let page=0;next&&page<20&&(page===0||Date.now()-started<45000);page++){
  if(seen.has(next))throw Error('Prokonzulta opakuje stránku');
  seen.add(next);
  const {body,res}=await get(next);
  if(res.url&&new URL(res.url).origin!==first.origin)throw Error('Prokonzulta přesměrovala katalog mimo zdroj');
  if(msk&&!/<span\b[^>]*class="badge badge--base badge--3"[^>]*>\s*Moravskoslezský kraj\b/i.test(body))throw Error('Prokonzulta nepotvrdila regionální filtr');
  const m=/(\d+)\s*(?:předmět(?:y|ů)?|nabídek)\s*<\//i.exec(body);
  if(!m)throw Error('Prokonzulta nepotvrdila počet nabídek');
  const expected=Number(m[1]);
  if(!Number.isSafeInteger(expected)||expected<0)throw Error('Prokonzulta: neplatný počet nabídek');
  if(total!==undefined&&total!==expected)throw Error('Počet nabídek Prokonzulta se během sběru změnil');
  total=expected;
  const list=body.slice(m.index+m[0].length).split('<transition name="map-slide"',1)[0];
  const cards=[...list.matchAll(/(<a\b[^>]*>)((?:(?!<\/a>)[\s\S])*)<\/a>/gi)].filter(x=>attr(x[1],'class').split(/\s+/).includes('offer-item'));
  if(!cards.length&&total!==0)throw Error('Prokonzulta: chybí karty nabídek');
  for(const card of cards){
   const url=safeLink(attr(card[1],'href'),next),html=card[2];
   if(!url||new URL(url).origin!==first.origin||!/^\/(?:drazba|aukce|prodej|primy-prodej|licitace|nabidka|vyberove-rizeni|pronajem)\//i.test(new URL(url).pathname))throw Error('Prokonzulta: neznámý odkaz na nabídku');
   const title=decode(/<div[^>]*class="[^"]*paragraph--medium[^"]*fw-bold[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1]||'');
   if(!title)throw Error('Prokonzulta: chybí název nabídky');
   const price=decode(/class="offer-item--content--price"[^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1]||'');
   const bottom=/<div[^>]*class="[^"]*offer-item--content--bottom[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1]||'';
   const date=decode(bottom).match(/\b\d{1,2}\.\s*\d{1,2}\.\s*\d{4}\b/)?.[0]||'';
   items.push({source:'Prokonzulta',title,url,date,published:'',price,location:title,msk:msk||region.test(title),status:'Zveřejněno na portálu'});
  }
  read+=cards.length;
  const nav=/<div class="pagination">([\s\S]*?)<\/div>/i.exec(body)?.[1]||'';
  const link=[...nav.matchAll(/<a\b[^>]*>/gi)].find(x=>attr(x[0],'class').split(/\s+/).includes('next'));
  if(!link){next='';break}
  const u=new URL(attr(link[0],'href').replace(/&amp;/g,'&'),next);
  if(u.origin!==first.origin||!(new RegExp('^(?:/nabidky|'+categoryPath+')/page-\\d+$').test(u.pathname)||(u.pathname===categoryPath&&/^\d+$/.test(u.searchParams.get('page')||'')))||(msk&&u.searchParams.get('region')!==prokonzultaMsk))throw Error('Prokonzulta: neplatný odkaz na další stránku');
  if(u.pathname!==categoryPath&&!u.pathname.startsWith(categoryPath+'/')&&u.searchParams.get('category')!==prokonzultaCategory)throw Error('Prokonzulta ztratila filtr nemovitostí');
  next=u.href;
 }
 const distinct=unique(items);
 if(!next&&(read!==total||distinct.length!==total))throw Error('Prokonzulta nepotvrdila celý katalog');
 // The national pass has no authoritative location on the list cards.
 return {items:distinct,complete:msk&&!next};
}
export async function prokonzulta(msk=false):Promise<Listing[]>{return (await scanProkonzulta(msk)).items}
export async function asis():Promise<Listing[]>{const base='https://portal.asis.cz/Katalog/-/1/';const {body}=await get(base);const a:Listing[]=[];for(const m of body.matchAll(/<a\s+href="([.\/]*Majetek\/Detail\/[^" ]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,170}?<p[^>]*>([\s\S]*?)<\/p>/gi)){const title=decode(m[3])||decode(m[2]);const url=safeLink(m[1],base);a.push({source:'ASIS – insolvenční majetek',title,url,date:'',published:'',price:'',location:title,msk:region.test(title),status:'Zveřejněno na portálu'})}return unique(a)}
export async function karvina():Promise<Listing[]>{const base='https://aukce.karvina.cz/';const {body}=await get(base);const a:Listing[]=[];for(const m of body.matchAll(/<div[^>]+class="[^"]*drazbaitem\s+([^"]+)"[\s\S]*?<a href="(https:\/\/aukce\.karvina\.cz\/drazba\/[^" ]+)"[^>]*>\s*<h4>([\s\S]*?)<\/h4>/gi)){if(/ended|ukončen/i.test(m[1]))continue;const title=decode(m[3]),url=safeLink(m[2],base);a.push({source:'Aukce města Karviná',title,url,date:'',published:'',price:'',location:'Karviná',msk:true,status:'Aktivní aukce'})}return unique(a)}
const mskDistricts=['Ostrava-město','Karviná','Frýdek-Místek','Opava','Nový Jičín','Bruntál'];
type PortalLocation={district_name?:string;county?:{county_name?:string};city?:{city_name?:string}};
type PortalAuction={item?:{title?:string;category?:{full_path?:string};location_district?:PortalLocation};location_district?:PortalLocation;hash?:string;status?:string;link?:string;start_at?:string;published_at?:string;item_price?:number};
async function portalDrazebPage(msk:boolean,page=0,info?:{count:number}):Promise<Listing[]>{
 const base='https://www.portaldrazeb.cz/drazby',offset=page*80;
 const {body,res}=await get(base);
 const csrf=/<meta name="csrf-token" content="([^"]+)"/.exec(body)?.[1];
 const cookieHeaders=typeof res.headers.getSetCookie==='function'?res.headers.getSetCookie():(res.headers as Headers&{getAll?:(name:string)=>string[]}).getAll?.('Set-Cookie')??[];
 const cookies=cookieHeaders.map(v=>v.split(';',1)[0]).join('; ');
 if(!csrf||!cookies)throw Error('Relace portálu není dostupná');
 const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Prague'});
 const filter:Record<string,unknown>={category:[1],sort:'asc',sort_by:'start',limit:80,offset,start_at_from:today};
 if(msk)filter.county_item=mskDistricts;
 const response=await fetch(base+'.json',{method:'PUT',headers:{'Accept':'application/json','Content-Type':'application/json','X-CSRF-TOKEN':csrf,'Cookie':cookies},body:JSON.stringify({filter}),signal:AbortSignal.timeout(18000)});
 if(!response.ok)throw Error('Portál dražeb HTTP '+response.status);
 const raw=await response.text();
 if(raw.length>3_000_000)throw Error('Příliš velká odpověď');
 const j=JSON.parse(raw) as Record<string,unknown>;
 if(!j||typeof j!=='object'||Array.isArray(j))throw Error('Portál dražeb: neplatná struktura');
 const total=j['@count'],records=Object.entries(j).filter(([k])=>/^\d+$/.test(k));
 if(typeof total!=='number'||!Number.isSafeInteger(total)||total<0||records.length!==Math.max(0,Math.min(80,total-offset)))throw Error('Portál dražeb: neověřený počet nabídek stránky');
 if(info)info.count=records.length;
 const a:Listing[]=[];
 for(const [,value] of records){
  if(!value||typeof value!=='object')throw Error('Portál dražeb: neplatná nabídka');
  const x=value as PortalAuction;
  const title=decode(x.item?.title||''),url=safeLink(x.link||'',base),d=x.item?.location_district||x.location_district;
  if(!title||!url||new URL(url).origin!==new URL(base).origin||!x.item?.category?.full_path)throw Error('Portál dražeb: chybí identita nabídky');
  if(!/^\/Nemovitosti(?:\/|$)/.test(x.item.category.full_path)||x.status==='finished')continue;
  const district=d?.district_name||'',regionName=d?.county?.county_name||'',municipality=d?.city?.city_name||'';
  const inRegion=regionName?regionName==='Moravskoslezský kraj':district?mskDistricts.includes(district):msk||region.test(title);
  a.push({source:'Portál dražeb',title,url,date:x.start_at||'',published:x.published_at||'',price:typeof x.item_price==='number'?`${x.item_price.toLocaleString('cs-CZ')} Kč`:'',location:municipality||district||title,msk:inRegion,status:x.status||'Aktuální'});
 }
 return unique(a);
}
export async function portalDrazeb(msk:boolean):Promise<Listing[]>{
 const items:Listing[]=[];for(let page=0;page<10;page++){const info={count:-1};items.push(...await portalDrazebPage(msk,page,info));if(info.count<80)return unique(items)}
 return unique(items)
}
export async function portalElektronickych(msk:boolean):Promise<Listing[]>{const base='https://www.portal-elektronickych-drazeb.cz'+(msk?'/kraj-moravskoslezsky/':'/drazby/');const {body}=await get(base);const a:Listing[]=[];for(const m of body.matchAll(/<div class="drazba-home">[\s\S]{0,700}?<div class="drazba-title"><a href="([^"]+)">([\s\S]*?)<\/a>/gi)){const title=decode(m[2]),url=safeLink(m[1],base);a.push({source:'Portál elektronických dražeb',title,url,date:'',published:'',price:'',location:title,msk:msk||region.test(title),status:'Zveřejněno na portálu'})}return unique(a)}
export async function drazbyProst():Promise<Listing[]>{const base='https://www.drazbyprost.cz/';const {body}=await get(base);const a:Listing[]=[];for(const m of body.matchAll(/<h2[^>]*><a href="(\/\d+-[^" ]+)"[^>]*>([\s\S]*?)<\/a><\/h2>/gi)){const title=decode(m[2]),url=safeLink(m[1],base);if(!property.test(title))continue;a.push({source:'DražbyProst',title,url,date:'',published:'',price:'',location:title,msk:region.test(title),status:'Zveřejněno na portálu'})}return unique(a)}
export async function elektronickeDrazby():Promise<Listing[]>{const base='https://www.elektronickedrazby.cz/';const {body}=await get(base);const a:Listing[]=[];for(const m of body.matchAll(/<div class='a-holder' data-href='(\/view\/\d+)'[\s\S]{0,850}?<h4><strong>([\s\S]*?)<\/strong><\/h4>/gi)){const title=decode(m[2]),url=safeLink(m[1],base);if(!property.test(title))continue;a.push({source:'Elektronické dražby',title,url,date:'',published:'',price:'',location:title,msk:region.test(title),status:'Zveřejněno na portálu'})}return unique(a)}
export async function uzsvm(msk:boolean):Promise<Listing[]>{const response=await fetch('https://www.nabidkamajetku.gov.cz/api/Property/AuctionList',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ListType:'all',Page:1,PageSize:msk?100:65,Order:'PublishedFrom',OrderDesc:'true',CategoryId:0,LocalityId:msk?'r0008':0}),signal:AbortSignal.timeout(18000)});if(!response.ok)throw Error('ÚZSVM HTTP '+response.status);const raw=await response.text();if(raw.length>4_000_000)throw Error('Příliš velká odpověď');const data=JSON.parse(raw) as {Auctions:Array<{Id:number;Name:string;CategoryName:string;DistrictName?:string;Price?:string;StartDate?:string;UpdatedDate?:string;StatusName?:string}>};if(!Array.isArray(data.Auctions))throw Error('Neplatná odpověď ÚZSVM');const districts=['Ostrava-město','Karviná','Frýdek-Místek','Opava','Nový Jičín','Bruntál'];return data.Auctions.filter(x=>/pozem|stavb|byt|dům|nemovit|garáž|jednotk|budov/i.test(x.CategoryName||'')).map(x=>({source:'ÚZSVM – aukce majetku',title:x.Name,url:`https://www.nabidkamajetku.gov.cz/Home/AuctionDetail/${x.Id}`,date:x.StartDate||'',published:x.UpdatedDate||'',price:x.Price?`${x.Price} Kč`:'',location:x.DistrictName||'',msk:districts.includes(x.DistrictName||''),status:x.StatusName||'Aktuální nabídka'}))}
export async function insolvencniZamery():Promise<Listing[]>{const base='https://www.portaldrazeb.cz/insolvencni-zamery';const {body}=await get(base,4_000_000);const encoded=/data-intentions="([^"]+)"/.exec(body)?.[1];if(!encoded)throw Error('Seznam záměrů není dostupný');const records=JSON.parse(decode(encoded)) as Array<{title:string;hash:string;status:string;publishedAt:string;monetizationTo?:string;minimumPrice?:number;item:{category?:string;location?:{county?:{name?:string};city?:{name?:string}}}}>;if(!Array.isArray(records))throw Error('Neplatný seznam záměrů');return records.filter(x=>x.item?.category?.startsWith('Nemovitosti')&&x.status!=='finished').map(x=>({source:'Insolvenční záměry',title:x.title,url:safeLink('/insolvencni-zamer/'+x.hash,base),date:x.monetizationTo||'',published:x.publishedAt||'',price:x.minimumPrice?`${x.minimumPrice.toLocaleString('cs-CZ')} Kč`:'',location:x.item.location?.city?.name||x.title,msk:x.item.location?.county?.name==='Moravskoslezský kraj'||region.test(x.title),status:'Záměr ke zpeněžení'}))}
export async function exdrazby(msk:boolean):Promise<Listing[]>{
 const filters:Array<{property:string;operator:string;value:string|number}>=[{property:'auction.status',operator:'eq',value:'prepared'}];
 if(msk)filters.push({property:'auctionAddress.region',operator:'eq',value:14});
 const params=new URLSearchParams({page:'1',perPage:'100',sort:JSON.stringify({property:'auction.timeCreated',direction:'DESC'}),filter:JSON.stringify(filters)});
 const {body}=await get('https://exdrazby.cz/api/web/auction/?'+params,4_000_000);
 const data=JSON.parse(body) as {data:Array<{id:number;title:string;startDt?:string;minimalBid?:number;parentStatus?:string;statusTranslation?:string;auctionCategory?:{parentTitle?:string};auctionAddress?:{city?:string;region?:{name?:string}}}>};
 if(!Array.isArray(data.data))throw Error('Neplatná odpověď exdrazby');
 return data.data.filter(x=>x.parentStatus==='prepared'&&x.auctionCategory?.parentTitle==='Nemovitosti').map(x=>({source:'exdrazby',title:x.title,url:`https://www.exdrazby.cz/drazba/${x.id}`,date:x.startDt||'',published:'',price:x.minimalBid?`${x.minimalBid.toLocaleString('cs-CZ')} Kč`:'',location:x.auctionAddress?.city||'',msk:x.auctionAddress?.region?.name==='Moravskoslezský kraj',status:x.statusTranslation||'Připravovaná dražba'}));
}
export async function spravaZeleznic():Promise<Listing[]>{
 const base='https://iframe.ipp.spravazeleznic.cz/prodeje-pronajmy/api/iframe/advertisements';
 const {body}=await get(base+'?PaymentType=Sell&pageSize=100',4_000_000);
 const result=JSON.parse(body) as {data:Array<{id:number;name:string;address?:string;region?:string;paymentType?:string;offerType?:string;publishFrom?:string;publishTo?:string;price?:number;showPrice?:boolean}>};
 if(!Array.isArray(result.data))throw Error('Neplatná odpověď Správy železnic');
 const now=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Prague'});
 return result.data.filter(x=>x.paymentType==='Sell'&&!!x.publishFrom&&x.publishFrom.slice(0,10)<=now&&(!x.publishTo||x.publishTo.slice(0,10)>=now)).map(x=>({source:'Správa železnic – prodej',title:x.name,url:`https://www.spravazeleznic.cz/nemovitosti/inzerat?id=${x.id}`,date:x.publishTo||'',published:x.publishFrom||'',price:x.showPrice&&x.price?`${x.price.toLocaleString('cs-CZ')} Kč`:'',location:x.address||'',msk:x.region==='Moravskoslezský kraj',status:x.offerType==='ETender'?'Elektronická aukce':'Výběrové řízení'}));
}
export async function drazbyExekutori():Promise<Listing[]>{
 const base='https://www.drazby-exekutori.cz/nove-drazby.aspx';const {body}=await get(base);
 const out:Listing[]=[];
 for(const m of body.matchAll(/<table\b[^>]*class="tblDrazbaMala"[\s\S]*?<a href="(\/DR\d+\/[^" ]+\/?)"[^>]*class="linkDrazbaMala"[\s\S]*?<h3>([\s\S]*?)<\/h3>[\s\S]*?<span id="zacatekDrazby">([^<]*)<\/span>[\s\S]*?<\/table>/gi)){
  const title=decode(m[2]),url=safeLink(m[1],base),date=decode(m[3]);if(!property.test(title)||!url)continue;
  out.push({source:'dražby-exekutoři',title,url,date,published:'',price:'',location:title,msk:region.test(title),status:'Připravovaná dražba'});
 }
 return unique(out);
}

/** Insolvency administrators' own marketplace: property sale tenders (not necessarily auctions). */
export function parseBurzaSpravcu(body:string):Listing[]{
 const base='https://www.burzaspravcu.cz/kategorie/nemovite-veci/';
 const out:Listing[]=[];
 // Only heading links are titles. Image and "Zobrazit" links share the same URL.
 for(const m of body.matchAll(/<h[23]\b[^>]*>\s*<a\b[^>]*href=["']([^"']*\/inzerat\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h[23]>/gi)){
  const url=safeLink(m[1],base),title=decode(m[2]);
  if(!url.startsWith('https://www.burzaspravcu.cz/inzerat/')||!title)continue;
  // Do not borrow locality from neighbouring cards or the administrator's address.
  out.push({source:'Burza správců – nemovitosti',title,url,date:'',published:'',price:'',location:title,msk:region.test(title),status:'Nabídka zpeněžení'});
 }
 if(!out.length)throw Error('Burza správců: nelze potvrdit strukturu nebo prázdný katalog');
 return unique(out);
}
export async function burzaSpravcu():Promise<Listing[]>{
 const {body}=await get('https://www.burzaspravcu.cz/kategorie/nemovite-veci/',3_000_000);
 return parseBurzaSpravcu(body);
}

/** Official RSS feed of Exekutorský úřad Ostrava; restrict to real estate. */
export function parseExekutorOstrava(body:string):Listing[]{
 const base='https://www.eurad-ova.cz/sitemap.xml?typ=rss';
 if(!/<rss\b|<rdf:RDF\b/i.test(body))throw Error('Neplatný RSS exekutora Ostrava');
 const out:Listing[]=[];
 for(const m of body.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){
  const field=(name:string)=>decode(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i').exec(m[1])?.[1]||'');
  const title=field('title'),description=field('description');
  const url=safeLink(field('link'),base);
  if(!property.test(title+' '+description)||!url.startsWith('https://www.eurad-ova.cz/'))continue;
  out.push({source:'Exekutorský úřad Ostrava',title:title||description.slice(0,120),url,date:'',published:field('pubDate'),price:'',location:title+' '+description.slice(0,150),msk:region.test(title+' '+description),status:/odročen|odrocen|odlož/i.test(title)?'Odročená dražba':/zrušen|zrusen/i.test(title)?'Zrušená dražba':'Zveřejněno exekutorem'});
 }
 return unique(out);
}

export async function exekutorOstrava():Promise<Listing[]>{
 const {body}=await get('https://www.eurad-ova.cz/sitemap.xml?typ=rss',2_000_000);
 return parseExekutorOstrava(body);
}
