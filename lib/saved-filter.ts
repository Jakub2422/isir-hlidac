import {parseCzk} from './auction-observation.ts';
import type {Listing} from './auction-import.ts';
export type FilterCriteria={location:string;propertyType:string;minPrice:number|null;maxPrice:number|null;source:string};
export const emptyCriteria:FilterCriteria={location:'',propertyType:'',minPrice:null,maxPrice:null,source:''};
export function validateSavedFilter(value:unknown):{name:string;criteria:FilterCriteria;active:boolean}{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Neplatný filtr');
 const body=value as Record<string,unknown>;
 if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>100)throw Error('Název musí mít 1 až 100 znaků');
 if(typeof body.active!=='boolean')throw Error('Chybí stav filtru');
 const c=body.criteria;if(!c||typeof c!=='object'||Array.isArray(c))throw Error('Chybí podmínky');
 const raw=c as Record<string,unknown>;
 for(const k of ['location','propertyType','source'])if(typeof raw[k]!=='string'||(raw[k] as string).length>200)throw Error('Neplatné podmínky');
 if(!['','house','apartment','land','garage','other'].includes(raw.propertyType as string))throw Error('Neplatný typ nemovitosti');
 for(const k of ['minPrice','maxPrice'])if(raw[k]!==null&&(typeof raw[k]!=='number'||!Number.isFinite(raw[k])||(raw[k] as number)<0))throw Error('Cena musí být nezáporné číslo');
 if(typeof raw.minPrice==='number'&&typeof raw.maxPrice==='number'&&raw.minPrice>raw.maxPrice)throw Error('Minimální cena převyšuje maximální');
 return {name:body.name.trim(),active:body.active,criteria:{location:(raw.location as string).trim(),propertyType:raw.propertyType as string,source:(raw.source as string).trim(),minPrice:raw.minPrice as number|null,maxPrice:raw.maxPrice as number|null}};
}
const normalize=(s:string)=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
const types:Record<string,RegExp>={house:/rodinn|\bdum\b|\bdomu\b|chata|chalup/,apartment:/\bbyt\b|bytov|jednotk/,land:/pozem|parcel/,garage:/garaz/,other:/budov|stavb|objekt/};
export function matchesSavedFilter(item:Listing,criteria:FilterCriteria):boolean{
 const text=normalize(item.title+' '+item.location);
 if(criteria.location&&!text.includes(normalize(criteria.location)))return false;
 if(criteria.source&&item.source!==criteria.source)return false;
 if(criteria.propertyType&&!types[criteria.propertyType]?.test(text))return false;
 const price=parseCzk(item.price);
 if((criteria.minPrice!==null||criteria.maxPrice!==null)&&price===null)return false;
 return !(criteria.minPrice!==null&&price!<criteria.minPrice||criteria.maxPrice!==null&&price!>criteria.maxPrice);
}
