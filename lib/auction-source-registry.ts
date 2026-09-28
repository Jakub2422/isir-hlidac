import type {AuctionObservation} from './auction-core';

export const AUCTION_SOURCE_SEEDS = [
  ['cevd','CEVD','https://cevd.gov.cz','api'],
  ['portal-drazeb','Portál dražeb','https://www.portaldrazeb.cz','api'],
  ['financni-sprava','Finanční správa','https://financnisprava.gov.cz','rss'],
  ['uzsvm','ÚZSVM – aukce majetku','https://www.nabidkamajetku.gov.cz','api'],
  ['insolvencni-zamery','Insolvenční záměry','https://www.portaldrazeb.cz/insolvencni-zamery','html'],
  ['okdrazby','OKdražby','https://okdrazby.cz','html'],
  ['exdrazby','exdrazby','https://www.exdrazby.cz','api'],
  ['drazby-exekutori','dražby-exekutoři','https://www.drazby-exekutori.cz','html'],
  ['sprava-zeleznic','Správa železnic – prodej','https://www.spravazeleznic.cz','api'],
  ['prokonzulta','Prokonzulta','https://www.prokonzulta.cz','html'],
  ['asis','ASIS – insolvenční majetek','https://portal.asis.cz','html'],
  ['karvina','Aukce města Karviná','https://aukce.karvina.cz','html'],
  ['portal-elektronickych','Portál elektronických dražeb','https://www.portal-elektronickych-drazeb.cz','html'],
  ['drazbyprost','DražbyProst','https://www.drazbyprost.cz','html'],
  ['elektronicke-drazby','Elektronické dražby','https://www.elektronickedrazby.cz','html'],
] as const;

export type AuctionSourceCode = typeof AUCTION_SOURCE_SEEDS[number][0];

export function sourceCodeFor(observation:Pick<AuctionObservation,'source'>):AuctionSourceCode|undefined {
  const hit=AUCTION_SOURCE_SEEDS.find(([,name])=>name===observation.source);
  return hit?.[0];
}
