import assert from 'node:assert/strict';
import {classify,changes,matchEvidence,sourceKey} from './auction-core.ts';

const a={source:'CEVD',externalId:'42',url:'https://example.test/drazba/42',title:'Dům v Ostravě',date:'2026-10-05',auctionAt:'2026-10-05T10:00:00+02:00',partyName:'Exekutorský úřad Ostrava',address:'Nádražní 5, Ostrava',openingPrice:4500000,parcel:'123/4',cadastralArea:'Moravská Ostrava'};
assert.equal(matchEvidence(a,{...a,source:'jiný web',url:'https://jiny.test/85'}),'parcel_day_party');
assert.equal(matchEvidence(a,{...a,source:'jiný web',url:'https://jiny.test/85',parcel:'123/5',address:'Nádražní 6, Ostrava'}),null);
assert.equal(matchEvidence(a,{...a,source:'jiný web',url:'https://jiny.test/85',parcel:'',address:'Nádražní 5, Ostrava'}),'address_day_party_price');
assert.equal(matchEvidence(a,{...a,source:'jiný web',url:'https://jiny.test/85',partyName:'jiný exekutor'}),null);
assert.equal(sourceKey(a),sourceKey({...a,url:'https://example.test/drazba/42?utm_source=ads'}));
assert.equal(matchEvidence(a,{...a,source:' cevd ',url:'https://other.test/42'}),'source_id');
const noExternal={...a,externalId:undefined,url:'https://example.test/drazba/42?b=2&a=1&utm_campaign=x'};
assert.equal(sourceKey(noExternal),sourceKey({...noExternal,url:'https://example.test/drazba/42?a=1&b=2'}));
assert.equal(classify('Škoda Octavia'), 'vehicle');
assert.deepEqual(changes({...a,status:'scheduled'}, {...a,status:'cancelled'}),[{field:'status',oldValue:'scheduled',newValue:'cancelled'}]);
console.log('auction-core: 9 checks passed');
