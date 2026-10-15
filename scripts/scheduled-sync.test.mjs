import assert from 'node:assert/strict';
import {runScheduledSync} from './scheduled-sync.mjs';
const config={url:'https://example.test',collectorSecret:'collector',syncSecret:'isir'};
const calls=[];
const mock=async(url,options)=>{calls.push({url:String(url),options});return Response.json({found:0});};
assert.equal((await runScheduledSync(config,mock,()=>{})).length,5);
assert.equal(calls[0].options.headers.Authorization,'Bearer collector');
assert.equal(calls[1].options.headers.Authorization,'Bearer isir');
assert.equal(calls[0].options.redirect,'error');
let count=0;
await runScheduledSync(config,async()=>{count++;return count===2?Response.json({busy:true},{status:409}):Response.json({});},()=>{});
assert.equal(count,2,'busy prevents subsequent ISIR mutations including history');
count=0;
await assert.rejects(()=>runScheduledSync(config,async()=>{count++;return count===1?Response.json({persistence:{failed:1}},{status:207}):Response.json({});},()=>{}),/incomplete/);
assert.equal(count,5,'auction failure does not block independent ISIR');
await assert.rejects(()=>runScheduledSync({...config,url:'http://example.test'},mock),/HTTPS/);
await assert.rejects(()=>runScheduledSync({...config,syncSecret:''},mock),/required/);
console.log('Scheduled sync regressions passed');
for(const body of [{alerts:{pending:true}},{alerts:{failed:true}}]){
 let n=0;
 await assert.rejects(()=>runScheduledSync(config,async()=>Response.json(++n===1?body:{}),()=>{}),/incomplete/);
 assert.equal(n,5,'alert failure must not block ISIR');
}
