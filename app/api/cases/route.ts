import {database} from '@/lib/isir';
export const runtime='edge';
export async function GET(request:Request){try{const u=new URL(request.url),city=(u.searchParams.get('city')||'').slice(0,80),district=(u.searchParams.get('district')||'').slice(0,80),kind=(u.searchParams.get('kind')||'').slice(0,80);const db=database();
 const rows=await db.prepare("SELECT event_id,spis,published_at,detected_at,district,city,kind,lv,parcel,description,document_url FROM findings WHERE (? = '' OR city LIKE ?) AND (? = '' OR district=?) AND (? = '' OR kind=?) ORDER BY detected_at DESC,event_id DESC LIMIT 150").bind(city,`%${city}%`,district,district,kind,kind).all();
 return Response.json({items:rows.results||[]},{headers:{'Cache-Control':'no-store'}});
}catch(e){return Response.json({error:e instanceof Error?e.message:'Data nejsou dostupná'},{status:503})}}
