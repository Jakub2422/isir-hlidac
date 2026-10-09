create table if not exists public.owner_favorites (
 auction_id uuid primary key references public.auctions(id) on delete cascade,
 created_at timestamptz not null default now()
);

create table if not exists public.owner_saved_filters (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 criteria jsonb not null default '{}'::jsonb,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

alter table public.owner_favorites enable row level security;
alter table public.owner_saved_filters enable row level security;

revoke all on public.owner_favorites, public.owner_saved_filters from anon, authenticated;
grant select, insert, update, delete on public.owner_favorites, public.owner_saved_filters to service_role;

create or replace function public.touch_owner_saved_filter_updated_at()
returns trigger language plpgsql set search_path = public as $body$
begin
 new.updated_at = now();
 return new;
end;
$body$;

drop trigger if exists owner_saved_filters_updated_at on public.owner_saved_filters;
create trigger owner_saved_filters_updated_at before update on public.owner_saved_filters
for each row execute function public.touch_owner_saved_filter_updated_at();
