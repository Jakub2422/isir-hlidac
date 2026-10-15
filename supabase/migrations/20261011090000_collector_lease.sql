-- A single fenced, renewable lease serializes auction collection across workers.
create table public.collector_leases (
 name text primary key,
 token uuid not null,
 expires_at timestamptz not null
);
alter table public.collector_leases enable row level security;
revoke all on public.collector_leases from anon, authenticated;
create function public.acquire_collector_lease(p_name text, p_token uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare acquired boolean;
begin
 insert into public.collector_leases(name,token,expires_at)
 values(p_name,p_token,now()+interval '15 minutes')
 on conflict(name) do update set token=excluded.token,expires_at=excluded.expires_at
 where collector_leases.expires_at < now();
 select token=p_token into acquired from public.collector_leases where name=p_name;
 return coalesce(acquired,false);
end;$$;
create function public.release_collector_lease(p_name text, p_token uuid)
returns void language sql security definer set search_path=public as $$
 delete from public.collector_leases where name=p_name and token=p_token;
$$;
revoke all on function public.acquire_collector_lease(text,uuid) from public,anon,authenticated;
revoke all on function public.release_collector_lease(text,uuid) from public,anon,authenticated;
grant execute on function public.acquire_collector_lease(text,uuid) to service_role;
grant execute on function public.release_collector_lease(text,uuid) to service_role;
