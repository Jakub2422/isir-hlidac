'use client';
import {useEffect,useState} from 'react';
type Today={date:string;count:number;complete:boolean};
export function TodayAuctions(){const [today,setToday]=useState<Today|null>(null);const [error,setError]=useState(false);
 useEffect(()=>{let active=true;async function load(){try{const r=await fetch('/api/auctions?region=msk',{cache:'no-store'});if(!r.ok)throw Error();const data=await r.json() as {today:Today};if(active){setToday(data.today);setError(false)}}catch{if(active)setError(true)}}void load();const timer=setInterval(()=>void load(),300000);return()=>{active=false;clearInterval(timer)}},[]);
 return <section className="panel today-card"><div><span className="today-label">Nově zveřejněné dnes · MSK</span><strong aria-live="polite">{today?today.count:error?'—':'Načítám…'}</strong><p>{today?`Dne ${new Date(today.date+'T12:00:00').toLocaleDateString('cs-CZ')} · ${today.complete?'':'Některý zdroj je nedostupný; počet může být nižší. '}Počítáme jen nabídky s doloženým datem zveřejnění (CEVD, Portál dražeb, insolvenční záměry, Správa železnic).`:error?'Aktuální počet se nepodařilo načíst.':'Zjišťuji dnešní zveřejněné nabídky.'}</p></div><a href="/drazby">Zobrazit dražby →</a></section>
}
