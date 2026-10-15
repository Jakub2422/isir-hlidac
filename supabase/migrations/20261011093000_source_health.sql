-- Server-only projection of durable crawl history, including healthy empty catalogs.
create view public.auction_source_health as
select s.code,s.name,s.enabled,
 latest.started_at last_attempt, latest.completed_at last_finished,
 successes.last_success, failures.last_failure,
 latest.fetched_count item_count, latest.success, failures.last_error,
 (select count(*)::integer from public.auction_crawl_runs r
  where r.source_id=s.id and r.success=false
  and (latest_success.id is null or (r.started_at,r.id)>(latest_success.started_at,latest_success.id))) consecutive_failures,
 nonempty.last_nonempty
from public.auction_sources s
left join lateral (select * from public.auction_crawl_runs r where r.source_id=s.id order by started_at desc,id desc limit 1) latest on true
left join lateral (select id,started_at from public.auction_crawl_runs r where r.source_id=s.id and success=true order by started_at desc,id desc limit 1) latest_success on true
left join lateral (select max(completed_at) last_success from public.auction_crawl_runs r where r.source_id=s.id and success=true) successes on true
left join lateral (select completed_at last_failure,error last_error from public.auction_crawl_runs r where r.source_id=s.id and success=false order by started_at desc,id desc limit 1) failures on true
left join lateral (select max(completed_at) last_nonempty from public.auction_crawl_runs r where r.source_id=s.id and success=true and fetched_count>0) nonempty on true;
revoke all on public.auction_source_health from public,anon,authenticated;
grant select on public.auction_source_health to service_role;
