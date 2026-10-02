import assert from 'node:assert/strict';
import {isoDate,normalizedAuctionStatus,parseCzk,toPersistableObservation} from './auction-observation.ts';

assert.equal(parseCzk('4 500 000 Kč'),4500000);
assert.equal(parseCzk('1.250.000 Kč'),1250000);
assert.equal(parseCzk(''),null);
assert.equal(normalizedAuctionStatus('Připravovaná dražba'),'scheduled');
assert.equal(normalizedAuctionStatus('Zrušeno'),'cancelled');
assert.equal(normalizedAuctionStatus('Zveřejněno na portálu'),'listed');
assert.equal(normalizedAuctionStatus('neznámý stav'),'unknown');
assert.equal(isoDate(''),null);
assert.ok(isoDate('2026-10-05T10:00:00+02:00')?.startsWith('2026-10-05T08:00:00.000Z'));

const listing={source:'CEVD',title:'Rodinný dům Ostrava',url:'https://cevd.gov.cz/seznam-drazeb/detail/42?utm_source=test',date:'2026-10-05T10:00:00+02:00',published:'2026-10-01T08:00:00+02:00',price:'4 500 000 Kč',location:'Ostrava',msk:true,status:'Published'};
const normalized=toPersistableObservation(listing);
assert.ok(normalized);
assert.equal(normalized.sourceCode,'cevd');
assert.equal(normalized.sourceUrl,'https://cevd.gov.cz/seznam-drazeb/detail/42');
assert.equal(normalized.category,'real_estate');
assert.equal(normalized.openingPrice,4500000);
assert.equal(normalized.status,'listed');
assert.equal(toPersistableObservation({...listing,source:'Neznámý zdroj'}),null);

console.log('auction-observation: 13 checks passed');
