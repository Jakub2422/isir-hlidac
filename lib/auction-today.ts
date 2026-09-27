import type {Listing} from './auction-import';
const publicationSources=new Set(['CEVD','Portál dražeb','Insolvenční záměry','Správa železnic – prodej']);
export function pragueDay(value:Date){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(value)}
export function publishedToday(items:Listing[],now=new Date()){
 const day=pragueDay(now);
 return items.filter(x=>{if(!publicationSources.has(x.source)||!/^\d{4}-\d\d-\d\d[T ]/.test(x.published))return false; if(x.source==='Správa železnic – prodej')return x.published.slice(0,10)===day; return !Number.isNaN(Date.parse(x.published))&&pragueDay(new Date(x.published))===day});
}
