-- Připravené schéma pro samostatný projekt Supabase.
-- Po výběru projektu se uloží jako verzovaná migrace příkazem Supabase CLI.
create table if not exists public.auction_sources (
 id uuid primary key default gen_random_uuid(), code text not null unique,
 name text not null, homepage_url text not null, method text not null,
 enabled boolean not null default true, last_success_at timestamptz,
 last_error_at timestamptz, last_error text,
 created_at timestamptz not null default now()
);

create table if not exists public.auction_parties (
 id uuid primary key default gen_random_uuid(), name text not null,
 type text not null check (type in ('auctioneer','executor','insolvency_administrator','state','municipality','other')),
 registration_number text, website_url text, metadata jsonb not null default '{}'::jsonb,
 unique (type, name)
);

create table if not exists public.auctions (
 id uuid primary key default gen_random_uuid(), canonical_key text not null unique,
 title text not null, category text not null check (category in ('real_estate','vehicle','other')),
 subcategory text, proceeding text not null default 'other'
   check (proceeding in ('execution','insolvency','state','municipality','other')),
 status text not null default 'listed'
   check (status in ('listed','scheduled','ongoing','postponed','cancelled','finished','unknown')),
 primary_url text not null, party_id uuid references public.auction_parties(id),
 address text, municipality text, district text, region text,
 latitude numeric(10,7), longitude numeric(10,7),
 opening_price numeric(18,2), estimated_price numeric(18,2), currency text not null default 'CZK',
 auction_at timestamptz, published_at timestamptz,
 first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
 last_updated_at timestamptz not null default now(), missing_since timestamptz,
 description text, metadata jsonb not null default '{}'::jsonb
);
create index if not exists auctions_first_seen_idx on public.auctions(first_seen_at desc);
create index if not exists auctions_region_category_idx on public.auctions(region,category,first_seen_at desc);
create index if not exists auctions_date_idx on public.auctions(auction_at);
create index if not exists auctions_status_idx on public.auctions(status);

create table if not exists public.auction_assets (
 id uuid primary key default gen_random_uuid(), auction_id uuid not null references public.auctions(id) on delete cascade,
 asset_type text not null check (asset_type in ('real_estate','vehicle','other')),
 subtype text, address text, municipality text, district text, region text,
 latitude numeric(10,7), longitude numeric(10,7), parcel_number text, cadastral_area text,
 title_deed_number text, vin text, registration_plate text,
 make text, model text, manufacture_year integer, description text,
 metadata jsonb not null default '{}'::jsonb
);
create index if not exists auction_assets_parcel_idx on public.auction_assets(cadastral_area,parcel_number);
create index if not exists auction_assets_vin_idx on public.auction_assets(vin);

create table if not exists public.auction_occurrences (
 id uuid primary key default gen_random_uuid(), auction_id uuid not null references public.auctions(id) on delete cascade,
 source_id uuid not null references public.auction_sources(id), source_external_id text,
 source_url text not null, source_status text, raw_data jsonb not null default '{}'::jsonb,
 first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
 missing_since timestamptz,
 unique (source_id,source_url)
);
create unique index if not exists auction_occurrences_external_idx
 on public.auction_occurrences(source_id,source_external_id) where source_external_id is not null;
create index if not exists auction_occurrences_auction_idx on public.auction_occurrences(auction_id);

create table if not exists public.auction_documents (
 id uuid primary key default gen_random_uuid(), auction_id uuid not null references public.auctions(id) on delete cascade,
 occurrence_id uuid references public.auction_occurrences(id) on delete set null,
 url text not null, document_type text not null default 'other', title text,
 mime_type text, published_at timestamptz, content_sha256 text,
 ai_analysis_status text not null default 'not_requested',
 metadata jsonb not null default '{}'::jsonb, first_seen_at timestamptz not null default now(),
 unique (auction_id,url)
);
create table if not exists public.auction_photos (
 id uuid primary key default gen_random_uuid(), auction_id uuid not null references public.auctions(id) on delete cascade,
 url text not null, sort_order integer not null default 0, unique (auction_id,url)
);
create table if not exists public.auction_changes (
 id bigint generated always as identity primary key,
 auction_id uuid not null references public.auctions(id) on delete cascade,
 field_name text not null, old_value jsonb, new_value jsonb,
 detected_at timestamptz not null default now(),
 source_id uuid references public.auction_sources(id)
);
create index if not exists auction_changes_lookup_idx on public.auction_changes(auction_id,detected_at desc);
create table if not exists public.auction_crawl_runs (
 id bigint generated always as identity primary key,
 source_id uuid not null references public.auction_sources(id),
 started_at timestamptz not null default now(), completed_at timestamptz,
 success boolean, fetched_count integer not null default 0, error text,
 is_complete_snapshot boolean not null default false,
 metadata jsonb not null default '{}'::jsonb
);
create index if not exists auction_crawl_runs_source_started_idx
 on public.auction_crawl_runs(source_id,started_at desc);


create table if not exists public.insolvency_events (
 id bigint primary key,
 case_number text not null,
 published_at timestamptz,
 description text not null default '',
 document_url text,
 verdict text,
 first_seen_at timestamptz not null default now()
);
create index if not exists insolvency_events_case_idx on public.insolvency_events(case_number);
create index if not exists insolvency_events_published_idx on public.insolvency_events(published_at desc);

create table if not exists public.insolvency_findings (
 id bigint generated always as identity primary key,
 event_id bigint not null references public.insolvency_events(id) on delete cascade,
 case_number text not null,
 published_at timestamptz,
 detected_at timestamptz not null default now(),
 district text, city text, kind text, title_deed_number text, parcel_number text,
 description text not null default '', document_url text,
 unique (event_id)
);
create index if not exists insolvency_findings_detected_idx on public.insolvency_findings(detected_at desc);
create index if not exists insolvency_findings_location_idx on public.insolvency_findings(district,city);

create table if not exists public.collector_state (
 key text primary key,
 value text not null,
 updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text, home_region text default 'Moravskoslezský kraj',
 created_at timestamptz not null default now()
);
create table if not exists public.user_favorites (
 user_id uuid not null references auth.users(id) on delete cascade,
 auction_id uuid not null references public.auctions(id) on delete cascade,
 created_at timestamptz not null default now(), primary key (user_id,auction_id)
);
create table if not exists public.saved_filters (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null, criteria jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.auction_sources enable row level security;
alter table public.auction_parties enable row level security;
alter table public.auctions enable row level security;
alter table public.auction_assets enable row level security;
alter table public.auction_occurrences enable row level security;
alter table public.auction_documents enable row level security;
alter table public.auction_photos enable row level security;
alter table public.auction_changes enable row level security;
alter table public.auction_crawl_runs enable row level security;

alter table public.insolvency_events enable row level security;
alter table public.insolvency_findings enable row level security;
alter table public.collector_state enable row level security;
drop policy if exists insolvency_events_read on public.insolvency_events;
create policy insolvency_events_read on public.insolvency_events for select to authenticated using (true);
drop policy if exists insolvency_findings_read on public.insolvency_findings;
create policy insolvency_findings_read on public.insolvency_findings for select to authenticated using (true);
grant select on public.insolvency_events, public.insolvency_findings to authenticated;
alter table public.user_profiles enable row level security;
alter table public.user_favorites enable row level security;
alter table public.saved_filters enable row level security;

drop policy if exists sources_read on public.auction_sources;
create policy sources_read on public.auction_sources for select to authenticated using (true);
drop policy if exists parties_read on public.auction_parties;
create policy parties_read on public.auction_parties for select to authenticated using (true);
drop policy if exists auctions_read on public.auctions;
create policy auctions_read on public.auctions for select to authenticated using (true);
drop policy if exists assets_read on public.auction_assets;
create policy assets_read on public.auction_assets for select to authenticated using (true);
drop policy if exists occurrences_read on public.auction_occurrences;
create policy occurrences_read on public.auction_occurrences for select to authenticated using (true);
drop policy if exists documents_read on public.auction_documents;
create policy documents_read on public.auction_documents for select to authenticated using (true);
drop policy if exists photos_read on public.auction_photos;
create policy photos_read on public.auction_photos for select to authenticated using (true);
drop policy if exists changes_read on public.auction_changes;
create policy changes_read on public.auction_changes for select to authenticated using (true);
drop policy if exists crawl_runs_read on public.auction_crawl_runs;
create policy crawl_runs_read on public.auction_crawl_runs for select to authenticated using (true);
drop policy if exists own_profile on public.user_profiles;
create policy own_profile on public.user_profiles for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists own_favorites on public.user_favorites;
create policy own_favorites on public.user_favorites for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists own_filters on public.saved_filters;
create policy own_filters on public.saved_filters for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

grant select on public.auction_sources, public.auction_parties, public.auctions,
 public.auction_assets, public.auction_occurrences, public.auction_documents,
 public.auction_photos, public.auction_changes, public.auction_crawl_runs to authenticated;
grant select,insert,update,delete on public.user_profiles, public.user_favorites,
 public.saved_filters to authenticated;
-- Řádková práva a zápis do katalogu se ověřují až při nasazení do projektu.


-- Monitoring: uložená kritéria mohou samostatně řídit upozornění.
create table if not exists public.alert_rules (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 saved_filter_id uuid references public.saved_filters(id) on delete cascade,
 name text not null,
 enabled boolean not null default true,
 channel text not null default 'email' check (channel in ('email')),
 recipient text,
 last_checked_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists alert_rules_user_enabled_idx on public.alert_rules(user_id,enabled);

-- Fronta je oddělena od odesílací služby. Unikátní klíč brání dvojímu upozornění
-- na stejnou dražbu pro stejné pravidlo i při opakovaném běhu synchronizace.
create table if not exists public.notification_queue (
 id bigint generated always as identity primary key,
 alert_rule_id uuid not null references public.alert_rules(id) on delete cascade,
 auction_id uuid not null references public.auctions(id) on delete cascade,
 channel text not null default 'email' check (channel in ('email')),
 recipient text not null,
 status text not null default 'pending'
   check (status in ('pending','processing','sent','failed','cancelled')),
 attempts integer not null default 0,
 last_error text,
 queued_at timestamptz not null default now(),
 sent_at timestamptz,
 unique (alert_rule_id,auction_id,channel)
);
create index if not exists notification_queue_pending_idx
 on public.notification_queue(status,queued_at) where status in ('pending','failed');

-- Notification identity is event-scoped: a listing may legitimately notify again
-- after a later change/cancellation/republish, while retries of the same event stay idempotent.
alter table public.notification_queue
 add column if not exists event_type text not null default 'first_seen';
alter table public.notification_queue
 add column if not exists event_key text not null default 'first_seen';
alter table public.notification_queue
 drop constraint if exists notification_queue_alert_rule_id_auction_id_channel_key;
create unique index if not exists notification_queue_event_unique_idx
 on public.notification_queue(alert_rule_id,auction_id,channel,event_type,event_key);

alter table public.alert_rules enable row level security;
alter table public.notification_queue enable row level security;
drop policy if exists own_alert_rules on public.alert_rules;
create policy own_alert_rules on public.alert_rules for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists own_notification_queue on public.notification_queue;
create policy own_notification_queue on public.notification_queue for select to authenticated
 using (exists (
   select 1 from public.alert_rules r
   where r.id=alert_rule_id and r.user_id=(select auth.uid())
 ));
grant select,insert,update,delete on public.alert_rules to authenticated;
grant select on public.notification_queue to authenticated;


-- Missing/disappeared state may be advanced only after a complete successful
-- snapshot of one source. Partial/failed crawls must never hide listings.
create or replace function public.finalize_auction_crawl(
 p_run_id bigint,
 p_seen_occurrence_ids uuid[],
 p_completed_at timestamptz default now()
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
 v_source uuid;
 v_success boolean;
 v_complete boolean;
begin
 select source_id, success, is_complete_snapshot
 into v_source, v_success, v_complete
 from public.auction_crawl_runs where id=p_run_id for update;

 if v_source is null then raise exception 'crawl run not found'; end if;
 if coalesce(v_success,false) is not true or coalesce(v_complete,false) is not true then
   raise exception 'only successful complete snapshots can finalize missing state';
 end if;

 update public.auction_occurrences
 set last_seen_at=p_completed_at, missing_since=null
 where source_id=v_source and id=any(coalesce(p_seen_occurrence_ids,'{}'::uuid[]));

 update public.auction_occurrences
 set missing_since=coalesce(missing_since,p_completed_at)
 where source_id=v_source
   and not (id=any(coalesce(p_seen_occurrence_ids,'{}'::uuid[])));

 update public.auctions a
 set missing_since = desired.missing_since,
     last_updated_at=p_completed_at
 from (
   select a2.id,
     case
       when exists(select 1 from public.auction_occurrences o where o.auction_id=a2.id and o.missing_since is null)
         then null
       else coalesce(a2.missing_since,p_completed_at)
     end as missing_since
   from public.auctions a2
   where exists(select 1 from public.auction_occurrences o where o.auction_id=a2.id and o.source_id=v_source)
 ) desired
 where a.id=desired.id
   and a.missing_since is distinct from desired.missing_since;

 update public.auction_crawl_runs set completed_at=p_completed_at where id=p_run_id;
 update public.auction_sources set last_success_at=p_completed_at,last_error=null where id=v_source;
end;
$$;
revoke all on function public.finalize_auction_crawl(bigint,uuid[],timestamptz) from public, anon, authenticated;
grant execute on function public.finalize_auction_crawl(bigint,uuid[],timestamptz) to service_role;


-- Signed-out clients do not need direct access to application tables.
-- Keep SQL grants aligned with RLS; server collection uses the secret/service role.
revoke all privileges on table
 public.auction_sources, public.auction_parties, public.auctions,
 public.auction_assets, public.auction_occurrences, public.auction_documents,
 public.auction_photos, public.auction_changes, public.auction_crawl_runs,
 public.insolvency_events, public.insolvency_findings, public.collector_state,
 public.user_profiles, public.user_favorites, public.saved_filters,
 public.alert_rules, public.notification_queue
from anon;
revoke all privileges on all sequences in schema public from anon;


-- Idempotent seed of sources already implemented by the recovered application.
insert into public.auction_sources(code,name,homepage_url,method) values
 ('cevd','CEVD','https://cevd.gov.cz','api'),
 ('portal-drazeb','Portál dražeb','https://www.portaldrazeb.cz','api'),
 ('financni-sprava','Finanční správa','https://financnisprava.gov.cz','rss'),
 ('uzsvm','ÚZSVM – aukce majetku','https://www.nabidkamajetku.gov.cz','api'),
 ('insolvencni-zamery','Insolvenční záměry','https://www.portaldrazeb.cz/insolvencni-zamery','html'),
 ('okdrazby','OKdražby','https://okdrazby.cz','html'),
 ('exdrazby','exdrazby','https://www.exdrazby.cz','api'),
 ('drazby-exekutori','dražby-exekutoři','https://www.drazby-exekutori.cz','html'),
 ('sprava-zeleznic','Správa železnic – prodej','https://www.spravazeleznic.cz','api'),
 ('prokonzulta','Prokonzulta','https://www.prokonzulta.cz','html'),
 ('asis','ASIS – insolvenční majetek','https://portal.asis.cz','html'),
 ('karvina','Aukce města Karviná','https://aukce.karvina.cz','html'),
 ('portal-elektronickych','Portál elektronických dražeb','https://www.portal-elektronickych-drazeb.cz','html'),
 ('drazbyprost','DražbyProst','https://www.drazbyprost.cz','html'),
 ('elektronicke-drazby','Elektronické dražby','https://www.elektronickedrazby.cz','html')
on conflict (code) do update set
 name=excluded.name, homepage_url=excluded.homepage_url, method=excluded.method;
