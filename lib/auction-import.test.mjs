import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBurzaSpravcu,parseExekutorOstrava} from './auction-import.ts';
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
