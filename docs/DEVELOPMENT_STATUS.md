# Development checkpoint — 2026-10-12

Branch: automation/single-user-features, draft PR #2. Production main and the existing Site have not been changed.

## Added in the current run

- Renewable collector lease with transactional write fencing; wrong/expired tokens cannot renew or write auction/crawl state. First commit ef5363cc53bae8b0074520c482ab6c8907678072 has successful GitHub CI.
- Owner-only source health API and /zdroje overview, healthy-empty distinction, consecutive failures and stale-success warnings. Commit e969bbf90a2805a4fca2827f0b27610b3865dcc9 has successful GitHub CI.
- Durable auction-event outbox, shared saved-filter evaluator, idempotent owner notification queue, /api/notifications and /upozorneni read/read-all UI. See docs/ALERTS.md and docs/LEASE_CHECKPOINT.md for exact contracts and deployment prerequisites.
- Local real-response fixtures replay through PostgreSQL and the alert evaluator. 34 new-offer events plus price/date/status events; unchanged replay emits none; queue completion replay is idempotent. No fresh source collection or hosted/browser success is claimed.
- Supabase tools and configured credentials are unavailable. Vercel project queries by name and repository return no accessible existing project. No new paid resource, deployment, schedule activation or merge was performed.

## Previously verified collector and owner foundation

- Live Burza správců category response: 30 property listings, four with Ostrava established in the title. Heading-only parser avoids image/button links overwriting names and neighbouring cards leaking locality. Missing/unrecognized markup reports a source error.
- Live Ostrava executor RSS: four properties; office location is not assumed to be the property's location. Postponement in the title is preserved.
- Real-response fixtures flow through parser, normalization, persistence client, actual PostgreSQL RPC, and database reader. 34 offers replay without duplicate auctions/occurrences. This is a local PostgreSQL test, not a production Supabase or browser end-to-end test.
- Fixed ambiguous occurrence auction_id in the persistence RPC via a new versioned migration; existing migrations remain intact.
- Full pnpm check passes locally. CI runner needs explicit --experimental-strip-types for the PostgreSQL regression script on Node 22.13.
- Favorites UI uses auction UUID; live fallback offers without UUID have disabled favorite actions. Save failures are visible and do not silently change local favorite state.
- Saved filters have owner-only CRUD API, validated locality/type/price/source/active criteria, editor and apply action in auction UI. Unknown prices do not match a price-bound filter.
- Owner APIs fail closed when OWNER_USER_ID is absent or the verified ChatGPT user differs. Existing ChatGPT sign-in flow remains in place.
- Tests cover price/date/status history, favorite idempotency, saved-filter database writes, and denial of anon/authenticated direct access to owner tables.

## Deployment requirements / unverified areas

- No callable Supabase connector is exposed in this run. Existing production project is isir-drazby; do not create another project. Production migration application and hosted Supabase read/write have not been verified.
- Configure server-only OWNER_USER_ID from the verified hosting identity before enabling new owner features. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured server-side. Do not commit their values.
- Do not deploy over the backup Site merely to test. Use an isolated verified environment and retain the D1 path.
- No production deployment or scheduler activation was performed. Internal alert evaluation and notification queue/UI are implemented locally; external delivery and hosted operation remain unverified.
- Burza advertises a category RSS feed, but its completeness/coverage versus the category catalog is not established. Current HTML category collector remains an incomplete snapshot.

## Next P0

Authorize management access to existing Supabase isir-drazby, inspect applied migrations, apply only missing safe migrations, and verify hosted replay. Then verify owner browser persistence and scheduler dispatch against an isolated deployment. A production-ready claim requires that actual hosted/browser/scheduler/alert flow; passing local checks alone is insufficient. Cross-source deduplication, collector completeness and ISIR alert coverage remain subsequent work.
