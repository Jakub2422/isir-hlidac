import assert from 'node:assert/strict';
import {externalIdFor,isoDate,normalizedAuctionStatus,parseCzk,toPersistableObservation} from './auction-observation.ts';

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
assert.equal(normalized.externalId,'42');
assert.equal(normalized.sourceUrl,'https://cevd.gov.cz/seznam-drazeb/detail/42');
assert.equal(normalized.category,'real_estate');
assert.equal(normalized.openingPrice,4500000);
assert.equal(normalized.status,'listed');
assert.equal(externalIdFor('portal-drazeb','https://www.portaldrazeb.cz/drazba/094ex14121-21-568-ng7ee'),'094ex14121-21-568-ng7ee');
assert.equal(externalIdFor('uzsvm','https://www.nabidkamajetku.gov.cz/Home/AuctionDetail/12345'),'12345');
assert.equal(externalIdFor('sprava-zeleznic','https://www.spravazeleznic.cz/prodej-majetku?id=987'),'987');
assert.equal(externalIdFor('elektronicke-drazby','https://www.elektronickedrazby.cz/view/456'),'456');
assert.equal(toPersistableObservation({...listing,source:'Neznámý zdroj'}),null);

console.log('auction-observation: 18 checks passed');
