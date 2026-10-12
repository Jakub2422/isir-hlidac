-- Renewal never resurrects an expired lease. Row locks fence each write in
-- the same transaction, preventing takeover while an accepted write is active.
create function public.renew_collector_lease(p_name text,p_token uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update collector_leases set expires_at=clock_timestamp()+interval '15 minutes'
 where name=p_name and token=p_token and expires_at>clock_timestamp();
 return found;
end;$$;
create function public.assert_collector_lease(p_token uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 perform 1 from collector_leases where name='auctions' and token=p_token
 and expires_at>clock_timestamp() for update;
 if not found then raise exception 'Collector lease lost' using errcode='55000'; end if;
end;$$;
create function public.upsert_leased_auction_observation(
 p_lease_token uuid,p_source_code text,p_canonical_key text,
 p_source_external_id text,p_source_url text,p_title text,p_category text,
 p_status text,p_opening_price numeric,p_auction_at timestamptz,
 p_published_at timestamptz,p_raw_data jsonb default '{}'::jsonb
) returns table(auction_id uuid,occurrence_id uuid,created boolean)
language plpgsql security definer set search_path=public as $$
begin
 perform public.assert_collector_lease(p_lease_token);
 return query select * from public.upsert_auction_observation(p_source_code,
 p_canonical_key,p_source_external_id,p_source_url,p_title,p_category,p_status,
 p_opening_price,p_auction_at,p_published_at,p_raw_data);
end;$$;
create function public.record_leased_auction_crawl_run(
 p_lease_token uuid,p_source_code text,p_started_at timestamptz,
 p_finished_at timestamptz,p_success boolean,p_is_complete_snapshot boolean,
 p_items_seen integer,p_error text default null
) returns bigint language plpgsql security definer set search_path=public as $$
begin
 perform public.assert_collector_lease(p_lease_token);
 return public.record_auction_crawl_run(p_source_code,p_started_at,p_finished_at,
 p_success,p_is_complete_snapshot,p_items_seen,p_error);
end;$$;
revoke all on function public.renew_collector_lease(text,uuid) from public,anon,authenticated;
revoke all on function public.assert_collector_lease(uuid) from public,anon,authenticated,service_role;
revoke all on function public.upsert_leased_auction_observation(uuid,text,text,text,text,text,text,text,numeric,timestamptz,timestamptz,jsonb) from public,anon,authenticated;
revoke all on function public.record_leased_auction_crawl_run(uuid,text,timestamptz,timestamptz,boolean,boolean,integer,text) from public,anon,authenticated;
grant execute on function public.renew_collector_lease(text,uuid) to service_role;
grant execute on function public.upsert_leased_auction_observation(uuid,text,text,text,text,text,text,text,numeric,timestamptz,timestamptz,jsonb) to service_role;
grant execute on function public.record_leased_auction_crawl_run(uuid,text,timestamptz,timestamptz,boolean,boolean,integer,text) to service_role;
