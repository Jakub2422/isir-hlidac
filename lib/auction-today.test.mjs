import assert from 'node:assert/strict';
import {pragueDay,publishedToday} from './auction-today.ts';

const base={title:'Dům',url:'https://example.test/1',date:'',price:'',location:'Ostrava',msk:true,status:'Aktuální'};
const now=new Date('2026-09-30T10:30:00Z');
assert.equal(pragueDay(now),'2026-09-30');
const items=[
 {...base,source:'Portál dražeb',published:'2026-09-30T00:05:00+02:00'},
 {...base,url:'https://example.test/2',source:'CEVD',published:'2026-09-29T23:30:00Z'},
 {...base,url:'https://example.test/3',source:'Portál dražeb',published:'2026-09-29T21:30:00Z'},
 {...base,url:'https://example.test/4',source:'OKdražby',published:'2026-09-30T08:00:00+02:00'},
 {...base,url:'https://example.test/5',source:'Správa železnic – prodej',published:'2026-09-30T00:00:00'},
];
const result=publishedToday(items,now);
assert.deepEqual(result.map(x=>x.url),['https://example.test/1','https://example.test/2','https://example.test/5']);
console.log('auction-today: 3 publication-day checks passed');
