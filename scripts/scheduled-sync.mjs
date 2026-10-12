import {pathToFileURL} from 'node:url';

export async function runScheduledSync(config, fetcher=fetch, report=console.log){
 const url=new URL(config.url);
 if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash)throw new Error('SYNC_BASE_URL must be an HTTPS origin');
 if(!config.collectorSecret || !config.syncSecret)throw new Error('Collector and ISIR secrets are required');
 const results=[];
 async function call(path,secret){
  const startedAt=new Date().toISOString();
  let response;
  try{response=await fetcher(new URL(path,url),{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${secret}`,Accept:'application/json'},signal:AbortSignal.timeout(240_000)});}
  catch{throw new Error(`Request failed: ${path}`);}
  let body;try{body=await response.json();}catch{throw new Error(`Invalid JSON: ${path} (${response.status})`);}
  const skipped=body.busy===true || body.skipped===true;
  const failed=!skipped && (!response.ok || response.status===207 || body.persistence?.failed>0 || body.crawlTracking?.failed>0 || body.mirror?.failed>0 || body.alerts?.failed===true || body.alerts?.pending===true);
  const result={path,startedAt,finishedAt:new Date().toISOString(),status:response.status,skipped,failed,fetched:body.fetched??null,found:body.found??null,created:body.persistence?.created??null,alertsEvaluated:body.alerts?.evaluated??null,alertsPending:body.alerts?.pending??null,stage:body.stage??null};
  results.push(result);report(JSON.stringify(result));return result;
 }
 // Keep independent collectors running if another area fails, but never retry a mutation blindly.
 const errors=[];
 try{await call('/api/auctions/sync',config.collectorSecret);}catch(e){errors.push(e.message);}
 let blocked=false;
 for(let i=0;i<3;i++){
  try{const r=await call('/api/sync',config.syncSecret);if(r.skipped || r.failed){blocked=true;break;}}
  catch(e){errors.push(e.message);blocked=true;break;}
 }
 if(!blocked){try{await call('/api/sync?mode=history',config.syncSecret);}catch(e){errors.push(e.message);}}
 if(errors.length || results.some(r=>r.failed))throw new Error(`Scheduled sync incomplete: ${errors.join('; ') || 'endpoint reported partial failure'}`);
 return results;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 runScheduledSync({url:process.env.SYNC_BASE_URL,collectorSecret:process.env.COLLECTOR_SECRET,syncSecret:process.env.SYNC_SECRET}).catch(e=>{console.error(e.message);process.exitCode=1;});
}
