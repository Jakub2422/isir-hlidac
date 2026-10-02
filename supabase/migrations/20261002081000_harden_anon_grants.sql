-- Harden the exposed public schema before the first production deployment.
-- RLS policies and SQL grants are separate controls; signed-out clients need no
-- direct access to the monitoring catalog or user data.
revoke all privileges on table
 public.auction_sources,
 public.auction_parties,
 public.auctions,
 public.auction_assets,
 public.auction_occurrences,
 public.auction_documents,
 public.auction_photos,
 public.auction_changes,
 public.auction_crawl_runs,
 public.insolvency_events,
 public.insolvency_findings,
 public.collector_state,
 public.user_profiles,
 public.user_favorites,
 public.saved_filters,
 public.alert_rules,
 public.notification_queue
from anon;

-- Identity sequences are internal implementation details. They are never needed
-- by browser clients; backend collection uses the server secret/service role.
revoke all privileges on all sequences in schema public from anon;
