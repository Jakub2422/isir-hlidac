# Lease checkpoint — 2026-10-12

The auction collector renews its 15-minute lease every minute and immediately
before persistence. Renewal failure is fail-closed. Timers are stopped in finally;
release only deletes the matching token. An expired token cannot renew.

Collector writes use leased RPC wrappers. Each wrapper locks and validates the
lease row within the write transaction, so takeover cannot race an accepted write.
A stale token cannot update auctions, history, occurrences or crawl/source state.
The old unleased RPCs remain available for existing explicit imports and fixtures;
scheduled collection always uses the fenced wrappers.

Apply `20261012090000_renew_and_fence_collector.sql` before deploying this code.
No destructive migration or production deployment was performed.

Verified locally: migrations and token acquisition/renewal/release/expiry tests;
stale auction/crawl writes rejected; 34 real-response fixture offers replay without
duplicate auctions or occurrences; heartbeat cleanup and failure tests.

External prerequisites: authorize access to the existing Supabase `isir-drazby`
project (connect its management connector). Never paste service-role secrets into
chat or commit them. Hosted schema inspection and replay are still unverified.
Vercel project search for `isir` returned no existing accessible project. Sites
deployment URLs are production, so the backup Site must not be used for preview.
Owner browser tests and scheduler dispatch remain blocked on a verified isolated
deployment with server-side identity, database and sync configuration.
