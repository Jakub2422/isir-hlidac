/** Conservative metadata extraction from a public Portál dražeb detail page.
 * A proceeding reference alone is review evidence, NEVER a strong lot identity.
 * Do not derive a lot or officialAuctionId from the URL slug. */
export function portalDrazebDetailIdentity(html:string){
 const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ')
  .replace(/&amp;/gi,'&').replace(/\s+/g,' ');
 const match=/Spisov[aá]\s+zna[cč]ka\s*:?\s*(\d{2,3}\s*(?:EX|DD)\s*\d+\s*\/\s*\d{2,4}(?:\s*[-–]\s*[\w\d]+)?)/i.exec(text);
 if(!match)return undefined;
 const proceeding=match[1].replace(/\s+/g,'').toUpperCase().replace('–','-');
 const authority=/^(\d{2,3})(?:EX|DD)/.exec(proceeding)?.[1];
 return authority?{authority,proceeding}:undefined;
}
