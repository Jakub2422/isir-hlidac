-- Server-only tables are accessed exclusively through authenticated application
-- routes using the privileged backend key. Keep them unreachable to Data API
-- anon/authenticated roles even if platform default grants change.
revoke all on table
 public.auction_alert_events,
 public.auction_duplicate_candidates,
 public.collector_leases,
 public.collector_state,
 public.owner_favorites,
 public.owner_notifications,
 public.owner_saved_filters
from anon, authenticated;

grant select, insert, update, delete on table
 public.auction_alert_events,
 public.auction_duplicate_candidates,
 public.collector_leases,
 public.collector_state,
 public.owner_favorites,
 public.owner_notifications,
 public.owner_saved_filters
to service_role;
