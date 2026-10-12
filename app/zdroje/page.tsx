import Link from 'next/link';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isOwnerUser} from '@/lib/owner-access';
import {readSourceHealth} from '@/lib/source-health';

export const dynamic='force-dynamic';
const time=(value:string|null)=>value?new Date(value).toLocaleString('cs-CZ',{timeZone:'Europe/Prague'}):'Dosud neproběhlo';
export default async function SourceHealthPage(){
 if(!isOwnerUser((await getChatGPTUser())?.userId,env.OWNER_USER_ID))return <main className="content"><h1>Přehled zdrojů</h1><p>Přístup je povolen pouze přihlášenému majiteli.</p><Link href="/drazby">Zpět na dražby</Link></main>;
 const url=env.SUPABASE_URL,secret=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)return <main className="content"><h1>Přehled zdrojů</h1><p>Monitoring není nakonfigurován.</p></main>;
 let sources;
 try{sources=await readSourceHealth({url,secret});}catch{return <main className="content"><h1>Přehled zdrojů</h1><p role="alert">Historie sběru není dostupná.</p></main>;}
 return <main className="content"><h1>Zdraví zdrojů</h1><Link href="/drazby">← Dražby</Link><p>Prázdný ověřený katalog není chyba. Varování upozorňují na chyby, dlouhou neaktivitu nebo podezřelé vymizení nabídek. Tento přehled neprokazuje úplné pokrytí zdrojů.</p>{sources.map(source=><section className="panel" key={source.code}><h2>{source.name}</h2><p>{!source.enabled?'Vypnuto':source.success===null?'Dosud nekontrolováno':source.success?'Poslední sběr úspěšný':'Poslední sběr selhal'} · Položky: {source.item_count??'—'}</p><dl><dt>Poslední pokus</dt><dd>{time(source.last_attempt)}</dd><dt>Poslední úspěch</dt><dd>{time(source.last_success)}</dd><dt>Poslední chyba</dt><dd>{time(source.last_failure)}</dd><dt>Chyby za sebou</dt><dd>{source.consecutive_failures}</dd></dl>{source.last_error&&<p>Chyba: {source.last_error}</p>}{source.warnings.map(warning=><p role="status" key={warning}>{warning}</p>)}</section>)}</main>;
}
