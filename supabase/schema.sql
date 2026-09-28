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
 is_complete_snapshot boolean not null default false
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
alter table public.user_profiles enable row level security;
alter table public.user_favorites enable row level security;
alter table public.saved_filters enable row level security;

create policy sources_read on public.auction_sources for select to authenticated using (true);
create policy parties_read on public.auction_parties for select to authenticated using (true);
create policy auctions_read on public.auctions for select to authenticated using (true);
create policy assets_read on public.auction_assets for select to authenticated using (true);
create policy occurrences_read on public.auction_occurrences for select to authenticated using (true);
create policy documents_read on public.auction_documents for select to authenticated using (true);
create policy photos_read on public.auction_photos for select to authenticated using (true);
create policy changes_read on public.auction_changes for select to authenticated using (true);
create policy own_profile on public.user_profiles for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy own_favorites on public.user_favorites for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy own_filters on public.saved_filters for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

grant select on public.auction_sources, public.auction_parties, public.auctions,
 public.auction_assets, public.auction_occurrences, public.auction_documents,
 public.auction_photos, public.auction_changes to authenticated;
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

alter table public.alert_rules enable row level security;
alter table public.notification_queue enable row level security;
create policy own_alert_rules on public.alert_rules for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy own_notification_queue on public.notification_queue for select to authenticated
 using (exists (
   select 1 from public.alert_rules r
   where r.id=alert_rule_id and r.user_id=(select auth.uid())
 ));
grant select,insert,update,delete on public.alert_rules to authenticated;
grant select on public.notification_queue to authenticated;
