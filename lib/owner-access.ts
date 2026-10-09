// Owner identity comes only from the hosting platform's verified user header.
export function isOwnerUser(userId:string|null|undefined,ownerUserId:string|null|undefined):boolean{
 return Boolean(userId&&ownerUserId&&userId===ownerUserId);
}
export const isAuctionUuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
