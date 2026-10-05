create or replace function public.record_auction_crawl_run(
 p_source_code text,
 p_started_at timestamptz,
 p_finished_at timestamptz,
 p_success boolean,
 p_is_complete_snapshot boolean,
 p_items_seen integer,
 p_error text default null
) returns bigint
language plpgsql
security definer
set search_path=public
as $$
declare
 v_source_id uuid;
 v_run_id bigint;
begin
 if p_items_seen < 0 then raise exception 'items_seen cannot be negative'; end if;
 if p_finished_at < p_started_at then raise exception 'finished_at cannot precede started_at'; end if;
 select id into v_source_id from public.auction_sources where code=p_source_code and enabled=true;
 if v_source_id is null then raise exception 'auction source not found or disabled'; end if;
 insert into public.auction_crawl_runs(
  source_id,started_at,completed_at,success,is_complete_snapshot,fetched_count,error
 ) values (
  v_source_id,p_started_at,p_finished_at,p_success,
  p_success and p_is_complete_snapshot,p_items_seen,left(p_error,2000)
 ) returning id into v_run_id;
 update public.auction_sources set
  last_success_at=case when p_success then p_finished_at else last_success_at end,
  last_error_at=case when p_success then last_error_at else p_finished_at end,
  last_error=case when p_success then null else left(coalesce(p_error,'Unknown collector error'),2000) end
 where id=v_source_id;
 return v_run_id;
end;
$$;

revoke all on function public.record_auction_crawl_run(text,timestamptz,timestamptz,boolean,boolean,integer,text) from public,anon,authenticated;
grant execute on function public.record_auction_crawl_run(text,timestamptz,timestamptz,boolean,boolean,integer,text) to service_role;
