'use client';
import Link from 'next/link';
import {useCallback,useEffect,useState} from 'react';
import type {Notification} from '@/lib/notifications';
const reasons:Record<string,string>={NEW_MATCH:'Nová odpovídající nabídka',PRICE_CHANGED:'Změna ceny',DATE_CHANGED:'Změna termínu',STATUS_CHANGED:'Změna stavu'};
const safeUrl=(url?:string)=>{try{const parsed=new URL(url||'');return ['http:','https:'].includes(parsed.protocol)?parsed.href:null;}catch{return null;}};
export default function Inbox(){
 const [items,setItems]=useState<Notification[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{const response=await fetch('/api/notifications',{cache:'no-store'});if(!response.ok)throw Error('Upozornění nejsou dostupná nebo nejste přihlášený majitel.');const data=await response.json() as {notifications:Notification[]};return data.notifications;},[]);
 useEffect(()=>{let active=true;void load().then(data=>{if(active)setItems(data);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[load]);
 async function read(id:string){setBusy(true);setError('');try{const response=await fetch('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});if(!response.ok)throw Error('Označení se nepodařilo uložit');setItems(await load());}catch(e){setError(e instanceof Error?e.message:'Chyba');}finally{setBusy(false);}}
 return <main className="content"><h1>Upozornění</h1><Link href="/drazby">← Dražby</Link><p>Nepřečtené v posledních 200 upozorněních: {items.filter(x=>!x.read_at).length}</p><button disabled={busy||!items.some(x=>!x.read_at)} onClick={()=>void read('all')}>Označit všechna jako přečtená</button>{error&&<p role="alert">{error}</p>}{items.map(item=><section className="panel" key={item.id}><h2>{reasons[item.event_type]||item.event_type}</h2><p>{item.metadata.title} · {item.metadata.filterName}</p><p>{new Date(item.created_at).toLocaleString('cs-CZ')} · {item.read_at?'Přečtené':'Nepřečtené'}</p>{item.metadata.old!==undefined&&<p>{String(item.metadata.old??'—')} → {String(item.metadata.new??'—')}</p>}{safeUrl(item.metadata.url)&&<a href={safeUrl(item.metadata.url)!} target="_blank" rel="noopener noreferrer">Původní nabídka ↗</a>}{!item.read_at&&<button disabled={busy} onClick={()=>void read(item.id)}>Označit jako přečtené</button>}</section>)}</main>;
}
