-- Conservative cross-source identity. Existing UUIDs and occurrences stay intact.
create function public.auction_dedup_confidence(a jsonb,b jsonb) returns text
language sql immutable set search_path=public as $$
 select case
 when exists(select 1 from jsonb_each_text(coalesce(a->'facts','{}')) f
   where coalesce(b->'facts'->>f.key,'')<>'' and b->'facts'->>f.key<>f.value) then 'none'
 when exists(select 1 from jsonb_array_elements_text(coalesce(a->'strongKeys','[]')) k
   where coalesce(b->'strongKeys','[]') ? k) then 'high'
 when exists(select 1 from jsonb_array_elements_text(coalesce(a->'reviewKeys','[]')) k
   where coalesce(b->'reviewKeys','[]') ? k) then 'medium'
 else 'none' end;
$$;
revoke all on function public.auction_dedup_confidence(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.auction_dedup_confidence(jsonb,jsonb) to service_role;
create table public.auction_duplicate_candidates(
 auction_id uuid not null references public.auctions(id) on delete cascade,
 other_auction_id uuid not null references public.auctions(id) on delete cascade,
 confidence text not null check(confidence in ('high','medium')),
 first_seen_at timestamptz not null default now(),last_seen_at timestamptz not null default now(),
 primary key(auction_id,other_auction_id),check(auction_id<other_auction_id)
);
alter table public.auction_duplicate_candidates enable row level security;
revoke all on public.auction_duplicate_candidates from public,anon,authenticated;
grant select on public.auction_duplicate_candidates to service_role;

-- Qualify occurrence columns: auction_id is also an RPC output parameter.
-- Serialize first-seen identity decisions for one canonical auction key.
-- This closes the SELECT -> INSERT race when two collectors observe the same
-- new auction concurrently, while keeping unrelated auctions concurrent.
create or replace function public.upsert_auction_observation(
 p_source_code text,
 p_canonical_key text,
 p_source_external_id text,
 p_source_url text,
 p_title text,
 p_category text,
 p_status text,
 p_opening_price numeric,
 p_auction_at timestamptz,
 p_published_at timestamptz,
 p_raw_data jsonb default '{}'::jsonb
) returns table(auction_id uuid, occurrence_id uuid, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
 v_source_id uuid;
 v_auction_id uuid;
 v_occurrence_id uuid;
 v_created boolean := false;
 v_candidates uuid[];
 v_primary_source uuid;
 v_old_title text;
 v_old_opening_price numeric(18,2);
 v_old_auction_at timestamptz;
 v_old_published_at timestamptz;
 v_old_status text;
begin
 if nullif(trim(p_canonical_key),'') is null
    or nullif(trim(p_source_url),'') is null
    or nullif(trim(p_title),'') is null then
   raise exception 'canonical key, source URL and title are required';
 end if;
 if p_category not in ('real_estate','vehicle','other') then raise exception 'invalid auction category'; end if;
 if p_status not in ('listed','scheduled','ongoing','postponed','cancelled','finished','unknown') then raise exception 'invalid auction status'; end if;

 select id into v_source_id from public.auction_sources where code=p_source_code and enabled=true;
 if v_source_id is null then raise exception 'auction source not found or disabled'; end if;

 -- Transaction-scoped advisory lock. hashtextextended produces a stable bigint;
 -- the lock is released automatically on commit/rollback.
 perform pg_advisory_xact_lock(hashtextextended('auction-cross-source-identity-v1',0));
 perform pg_advisory_xact_lock(hashtextextended(p_canonical_key,0));

 if nullif(trim(p_source_external_id),'') is not null then
   select o.id,o.auction_id into v_occurrence_id,v_auction_id
   from public.auction_occurrences o
   where o.source_id=v_source_id and o.source_external_id=p_source_external_id
   for update;
 end if;
 if v_occurrence_id is null then
   select o.id,o.auction_id into v_occurrence_id,v_auction_id
   from public.auction_occurrences o
   where o.source_id=v_source_id and o.source_url=p_source_url
   for update;
 end if;
 if v_auction_id is null then
   select id into v_auction_id from public.auctions where canonical_key=p_canonical_key for update;
 end if;

 if v_auction_id is null and jsonb_array_length(coalesce(p_raw_data#>'{dedup,strongKeys}','[]'))>0 then
   select array_agg(distinct o.auction_id) into v_candidates
   from public.auction_occurrences o join public.auctions a on a.id=o.auction_id
   where o.source_id<>v_source_id and a.category=p_category
    and not exists(select 1 from auction_occurrences existing where existing.auction_id=o.auction_id and existing.source_id=v_source_id)
    and public.auction_dedup_confidence(p_raw_data->'dedup',o.raw_data->'dedup')='high';
   -- Ambiguous evidence must not silently choose one canonical auction.
   if cardinality(v_candidates)=1 then v_auction_id:=v_candidates[1]; end if;
 end if;

 if v_auction_id is null then
   insert into public.auctions(
     canonical_key,title,category,status,primary_url,opening_price,
     auction_at,published_at,first_seen_at,last_seen_at,last_updated_at,metadata
   ) values (
     p_canonical_key,p_title,p_category,p_status,p_source_url,p_opening_price,
     p_auction_at,p_published_at,now(),now(),now(),coalesce(p_raw_data,'{}'::jsonb)
   ) returning id into v_auction_id;
   v_created := true;
 else
   select o.source_id into v_primary_source from public.auction_occurrences o
   where o.auction_id=v_auction_id order by o.first_seen_at,o.id limit 1;
   -- Secondary mirrors retain their own values, but cannot oscillate canonical
   -- price/status/date on every replay. The first source remains authoritative.
   if v_primary_source=v_source_id or v_primary_source is null then
   select title,opening_price,auction_at,published_at,status
   into v_old_title,v_old_opening_price,v_old_auction_at,v_old_published_at,v_old_status
   from public.auctions where id=v_auction_id for update;

   if p_title is distinct from v_old_title then
     insert into public.auction_changes(auction_id,field_name,old_value,new_value,source_id)
     values(v_auction_id,'title',to_jsonb(v_old_title),to_jsonb(p_title),v_source_id);
   end if;
   if p_opening_price is not null and p_opening_price is distinct from v_old_opening_price then
     insert into public.auction_changes(auction_id,field_name,old_value,new_value,source_id)
     values(v_auction_id,'openingPrice',to_jsonb(v_old_opening_price),to_jsonb(p_opening_price),v_source_id);
   end if;
   if p_auction_at is not null and p_auction_at is distinct from v_old_auction_at then
     insert into public.auction_changes(auction_id,field_name,old_value,new_value,source_id)
     values(v_auction_id,'auctionAt',to_jsonb(v_old_auction_at),to_jsonb(p_auction_at),v_source_id);
   end if;
   if p_published_at is not null and p_published_at is distinct from v_old_published_at then
     insert into public.auction_changes(auction_id,field_name,old_value,new_value,source_id)
     values(v_auction_id,'publishedAt',to_jsonb(v_old_published_at),to_jsonb(p_published_at),v_source_id);
   end if;
   if p_status is distinct from v_old_status then
     insert into public.auction_changes(auction_id,field_name,old_value,new_value,source_id)
     values(v_auction_id,'status',to_jsonb(v_old_status),to_jsonb(p_status),v_source_id);
   end if;

   update public.auctions set
     title=p_title, category=p_category, status=p_status,
     primary_url=coalesce(nullif(primary_url,''),p_source_url),
     opening_price=coalesce(p_opening_price,opening_price),
     auction_at=coalesce(p_auction_at,auction_at),
     published_at=coalesce(p_published_at,published_at),
     last_seen_at=now(), last_updated_at=now(), missing_since=null,
     metadata=coalesce(metadata,'{}'::jsonb)||coalesce(p_raw_data,'{}'::jsonb)
   where id=v_auction_id;
   else
    update public.auctions set last_seen_at=now(),missing_since=null where id=v_auction_id;
   end if;
 end if;

 if v_occurrence_id is null then
   insert into public.auction_occurrences(
     auction_id,source_id,source_external_id,source_url,source_status,raw_data,
     first_seen_at,last_seen_at,missing_since
   ) values (
     v_auction_id,v_source_id,nullif(trim(p_source_external_id),''),p_source_url,p_status,
     coalesce(p_raw_data,'{}'::jsonb),now(),now(),null
   ) returning id into v_occurrence_id;
 else
   update public.auction_occurrences set
     source_external_id=coalesce(nullif(trim(p_source_external_id),''),source_external_id),
     source_url=p_source_url, source_status=p_status,
     raw_data=coalesce(p_raw_data,'{}'::jsonb), last_seen_at=now(), missing_since=null
   where id=v_occurrence_id;
 end if;

 update public.auctions a set metadata=jsonb_set(coalesce(a.metadata,'{}'),'{provenance}',
  (select jsonb_agg(jsonb_build_object('source',o.raw_data->>'source','url',o.source_url) order by o.first_seen_at,o.id)
   from public.auction_occurrences o where o.auction_id=v_auction_id)) where a.id=v_auction_id;

 -- Keep review candidates instead of auto-merging weak/ambiguous matches.
 insert into public.auction_duplicate_candidates(auction_id,other_auction_id,confidence)
 select least(v_auction_id,o.auction_id),greatest(v_auction_id,o.auction_id),
  case when bool_or(public.auction_dedup_confidence(p_raw_data->'dedup',o.raw_data->'dedup')='high') then 'high' else 'medium' end
 from public.auction_occurrences o where o.auction_id<>v_auction_id and o.source_id<>v_source_id
 and public.auction_dedup_confidence(p_raw_data->'dedup',o.raw_data->'dedup') in ('high','medium')
 group by o.auction_id
 on conflict on constraint auction_duplicate_candidates_pkey do update set last_seen_at=now();
 return query select v_auction_id,v_occurrence_id,v_created;
end;
$$;

revoke all on function public.upsert_auction_observation(
 text,text,text,text,text,text,text,numeric,timestamptz,timestamptz,jsonb
) from public, anon, authenticated;
grant execute on function public.upsert_auction_observation(
 text,text,text,text,text,text,text,numeric,timestamptz,timestamptz,jsonb
) to service_role;
