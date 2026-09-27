import { env } from 'cloudflare:workers';
import { extractText, getDocumentProxy } from 'unpdf';

const ENDPOINT = 'https://isir.justice.cz:8443/isir_public_ws/IsirWsPublicService';
const SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';
const TYPES = 'http://isirpublicws.cca.cz/types/';
const hints = /soupis|majetkov|zpeněž|prodej|dražb|nemovit|znaleck/i;
const property = /nemovit|pozem|parcel|rodinn.{0,8}d(?:ům|om)|bytov.{0,8}jednot|list.{0,8}vlastnictv|\bLV\s*\d/i;
const places: Record<string, string> = {
  'Ostrava': 'Ostrava-město', 'Havířov': 'Karviná', 'Karviná': 'Karviná',
  'Orlová': 'Karviná', 'Bohumín': 'Karviná', 'Český Těšín': 'Karviná',
  'Frýdek-Místek': 'Frýdek-Místek', 'Třinec': 'Frýdek-Místek',
  'Opava': 'Opava', 'Kravaře': 'Opava', 'Nový Jičín': 'Nový Jičín',
  'Kopřivnice': 'Nový Jičín', 'Příbor': 'Nový Jičín',
  'Bruntál': 'Bruntál', 'Krnov': 'Bruntál', 'Rýmařov': 'Bruntál',
};
const aliases: Record<string, string> = { 'Ostravě':'Ostrava','Ostravy':'Ostrava','Havířově':'Havířov','Opavě':'Opava','Bruntále':'Bruntál' };
function decode(s: string) { return s.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, v => {
  const map: Record<string,string> = {'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};
  if (map[v]) return map[v];
  if (v.startsWith('&#')) { const n = v[2]?.toLowerCase()==='x' ? parseInt(v.slice(3,-1),16) : parseInt(v.slice(2,-1),10); return n>0&&n<0x110000 ? String.fromCodePoint(n) : v; }
  return v;
}); }
function field(xml:string, name:string) { const m=xml.match(new RegExp('<(?:[\\w-]+:)?'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?'+name+'>'));return m?decode(m[1].trim()):''; }
async function soap(inner:string) {
  const body=`<soapenv:Envelope xmlns:soapenv="${SOAP}" xmlns:typ="${TYPES}"><soapenv:Header/><soapenv:Body>${inner}</soapenv:Body></soapenv:Envelope>`;
  const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'text/xml; charset=utf-8'},body,signal:AbortSignal.timeout(16000)});
  if(!response.ok)throw Error(`ISIR HTTP ${response.status}`);
  const xml=await response.text();
  if(xml.length>14_000_000||xml.includes('<soap:Fault')||field(xml,'stav')!=='OK')throw Error('Neplatná odpověď služby ISIR');
  return xml;
}
export async function latestId(){const xml=await soap('<typ:getIsirWsPublicPosledniIdDataRequest/>');const id=Number(field(xml,'cisloPosledniId'));if(!Number.isSafeInteger(id)||id<1)throw Error('Chybí poslední ID');return id;}
export type IsirEvent={id:number;spis:string;publishedAt:string;description:string;documentId:string};
export async function readEvents(cursor:number){const xml=await soap(`<typ:getIsirWsPublicIdDataRequest><idPodnetu>${cursor}</idPodnetu></typ:getIsirWsPublicIdDataRequest>`);const out:IsirEvent[]=[];
  for(const match of xml.matchAll(/<data>([\s\S]*?)<\/data>/g)){const part=match[1],id=Number(field(part,'id'));if(!Number.isSafeInteger(id)||id<=cursor)continue;
    const url=field(part,'dokumentUrl');const documentId=/[?&]idDokument=(\d+)/.exec(url)?.[1]||'';
    out.push({id,spis:field(part,'spisovaZnacka'),publishedAt:field(part,'datumZverejneniUdalosti'),description:field(part,'popisUdalosti'),documentId});
  }return out;
}
export function documentUrl(id:string){return `https://isir.justice.cz:8443/isir_public_ws/doc/Document?idDokument=${id}`}
export function needsDocument(event:IsirEvent){return !!event.documentId&&!!event.spis&&hints.test(event.description)}
export async function readDocument(event:IsirEvent){
  const response=await fetch(documentUrl(event.documentId),{signal:AbortSignal.timeout(18000)});
  if(!response.ok)throw Error(`Dokument HTTP ${response.status}`);
  const length=Number(response.headers.get('content-length')||0);if(length>5_000_000) return '';
  const raw=new Uint8Array(await response.arrayBuffer());if(raw.length>5_000_000) return '';
  if(new TextDecoder().decode(raw.slice(0,4))!=='%PDF')return '';
  const pdf=await getDocumentProxy(raw);
  if(pdf.numPages>25)return ''
  const result=await extractText(pdf,{mergePages:true});return String(result.text).slice(0,350_000)
}
export function detect(text:string){
  if(!property.test(text))return null;
  const names={...places,...aliases};
  for(const label of Object.keys(names).sort((a,b)=>b.length-a.length)){
    const re=new RegExp('(?<![\\p{L}])'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![\\p{L}])','iu');
    const hit=re.exec(text);if(!hit)continue;
    const near=text.slice(Math.max(0,hit.index-180),Math.min(text.length,hit.index+180));
    if(!property.test(near) || !/katastr|obec|pozem|parcel|LV\s*\d|list.{0,8}vlastnictv|adresa|ulice/i.test(near))continue;
    const city=aliases[label]||label;
    const kind=/rodinn.{0,8}d(?:ům|om)/i.test(near)?'Rodinný dům':/bytov.{0,8}jednot|\bbyt\b/i.test(near)?'Byt':/pozem|parcel/i.test(near)?'Pozemek':'Nemovitost – neurčeno';
    const lv=/(?:\bLV|list.{0,8}vlastnictv)\s*(?:č\.?\s*)?(\d{1,8})/i.exec(near)?.[1]||'';
    const parcel=/parc\.?\s*(?:č\.?)?\s*(\d{1,7}(?:\/\d{1,5})?)/i.exec(near)?.[1]||'';
    return {city,district:places[city],kind,lv,parcel};
  }return null;
}
export function database(){if(!env.DB)throw Error('Databáze není dostupná');return env.DB}
