-- Atomic mirror of D1 observations. Replays preserve first-seen/detected timestamps.
create or replace function public.upsert_insolvency_observation(p_event jsonb,p_finding jsonb default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_id bigint;
begin
 v_id=(p_event->>'id')::bigint;
 if v_id is null or v_id<=0 or coalesce(p_event->>'spis','')='' then
  raise exception 'Invalid insolvency event';
 end if;
 insert into public.insolvency_events(id,case_number,published_at,description,document_url,verdict)
 values(v_id,p_event->>'spis',nullif(p_event->>'published_at','')::timestamptz,
 coalesce(p_event->>'description',''),p_event->>'document_url',p_event->>'verdict')
 on conflict(id) do update set case_number=excluded.case_number,published_at=excluded.published_at,
 description=excluded.description,document_url=excluded.document_url,verdict=excluded.verdict;
 if p_finding is not null and p_finding<>'null'::jsonb then
  if (p_finding->>'event_id')::bigint is distinct from v_id then raise exception 'Finding event mismatch'; end if;
  insert into public.insolvency_findings(event_id,case_number,published_at,detected_at,district,city,kind,title_deed_number,parcel_number,description,document_url)
  values(v_id,p_event->>'spis',nullif(p_event->>'published_at','')::timestamptz,
  coalesce(nullif(p_finding->>'detected_at','')::timestamptz,now()),p_finding->>'district',p_finding->>'city',p_finding->>'kind',
  p_finding->>'lv',p_finding->>'parcel',coalesce(p_finding->>'description',''),p_finding->>'document_url')
  on conflict(event_id) do update set district=excluded.district,city=excluded.city,kind=excluded.kind,
  title_deed_number=excluded.title_deed_number,parcel_number=excluded.parcel_number,
  description=excluded.description,document_url=excluded.document_url;
 end if;
end;
$$;
revoke all on function public.upsert_insolvency_observation(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.upsert_insolvency_observation(jsonb,jsonb) to service_role;
