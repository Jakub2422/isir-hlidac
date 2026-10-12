-- BYPASSRLS is not a SQL SELECT grant. Make server reads reproducible without
-- relying on hosted-project default privileges. No browser roles are broadened.
grant select on public.auctions,public.auction_occurrences,public.auction_sources,
 public.auction_changes,public.auction_crawl_runs,public.insolvency_events,
 public.insolvency_findings to service_role;
