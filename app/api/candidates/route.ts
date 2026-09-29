import {database} from '@/lib/isir';
export const runtime='edge';
export async function GET(){try{
  const db=database();
  const rows=await db.prepare("SELECT id,spis,published_at,description,document_url,verdict FROM events WHERE description LIKE '%Soupis majetkové podstaty%' ORDER BY published_at DESC,id DESC LIMIT 30").all();
  return Response.json({items:rows.results||[],notice:'Soupis majetku sám o sobě neprokazuje nemovitost ani umístění v MSK.'},{headers:{'Cache-Control':'no-store'}});
}catch{return Response.json({error:'Kandidáty nelze načíst'},{status:503})}}
