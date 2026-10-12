create table public.auction_alert_events (
 id bigint generated always as identity primary key,
 auction_id uuid not null references public.auctions(id) on delete cascade,
 event_type text not null check(event_type in ('NEW_MATCH','PRICE_CHANGED','DATE_CHANGED','STATUS_CHANGED')),
 created_at timestamptz not null default clock_timestamp(),
 snapshot jsonb not null, metadata jsonb not null default '{}', evaluated_at timestamptz
);
create index auction_alert_pending on public.auction_alert_events(id) where evaluated_at is null;
create table public.owner_notifications (
 id uuid primary key default gen_random_uuid(),
 event_id bigint not null references public.auction_alert_events(id) on delete cascade,
 auction_id uuid not null references public.auctions(id) on delete cascade,
 saved_filter_id uuid references public.owner_saved_filters(id) on delete set null,
 event_type text not null, created_at timestamptz not null default clock_timestamp(),
 read_at timestamptz, metadata jsonb not null,
 unique(event_id,saved_filter_id)
);
alter table public.auction_alert_events enable row level security;
alter table public.owner_notifications enable row level security;
revoke all on public.auction_alert_events,public.owner_notifications from public,anon,authenticated;
grant select on public.auction_alert_events to service_role;
grant select,update on public.owner_notifications to service_role;
create function public.capture_auction_alert() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if TG_OP='INSERT' then
  insert into auction_alert_events(auction_id,event_type,snapshot) values(new.id,'NEW_MATCH',to_jsonb(new));
 else
  if new.opening_price is distinct from old.opening_price then
   insert into auction_alert_events(auction_id,event_type,snapshot,metadata) values(new.id,'PRICE_CHANGED',to_jsonb(new),jsonb_build_object('old',old.opening_price,'new',new.opening_price,'previousSnapshot',to_jsonb(old)));
  end if;
  if new.auction_at is distinct from old.auction_at then
   insert into auction_alert_events(auction_id,event_type,snapshot,metadata) values(new.id,'DATE_CHANGED',to_jsonb(new),jsonb_build_object('old',old.auction_at,'new',new.auction_at,'previousSnapshot',to_jsonb(old)));
  end if;
  if new.status is distinct from old.status then
   insert into auction_alert_events(auction_id,event_type,snapshot,metadata) values(new.id,'STATUS_CHANGED',to_jsonb(new),jsonb_build_object('old',old.status,'new',new.status,'previousSnapshot',to_jsonb(old)));
  end if;
 end if;
 return new;
end;$$;
create trigger auction_alert_capture after insert or update on public.auctions
for each row execute function public.capture_auction_alert();
create function public.complete_auction_alert(p_event_id bigint,p_filter_ids uuid[],p_lease_token uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare e auction_alert_events; n integer;
begin
 perform public.assert_collector_lease(p_lease_token);
 select * into e from auction_alert_events where id=p_event_id for update;
 if not found then raise exception 'Alert event not found'; end if;
 if e.evaluated_at is not null then return 0; end if;
 insert into owner_notifications(event_id,auction_id,saved_filter_id,event_type,metadata)
 select e.id,e.auction_id,f.id,e.event_type,
 e.metadata||jsonb_build_object('title',e.snapshot->>'title','url',e.snapshot->>'primary_url','filterName',f.name)
 from owner_saved_filters f where f.id=any(p_filter_ids) and f.active and f.created_at<=e.created_at
 on conflict(event_id,saved_filter_id) do nothing;
 get diagnostics n=row_count;
 update auction_alert_events set evaluated_at=clock_timestamp() where id=e.id;
 return n;
end;$$;
revoke all on function public.capture_auction_alert() from public,anon,authenticated,service_role;
revoke all on function public.complete_auction_alert(bigint,uuid[],uuid) from public,anon,authenticated;
grant execute on function public.complete_auction_alert(bigint,uuid[],uuid) to service_role;
