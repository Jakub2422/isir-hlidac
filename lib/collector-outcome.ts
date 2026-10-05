/** A successful HTTP response must include durable crawl tracking. */
export function collectorOutcome(sources:ReadonlyArray<{ok:boolean}>,persistenceFailures:number,crawlFailures:number){
 const complete=sources.every(source=>source.ok)&&persistenceFailures===0&&crawlFailures===0;
 return {complete,status:complete?200:207};
}
