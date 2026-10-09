# Development checkpoint — 2026-10-09

Branch: automation/single-user-features, draft PR #2. Production main and the existing Site have not been changed.

## Verified in this run

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
- No new production deployment, scheduler configuration, alert evaluator or notification delivery was performed.
- Burza advertises a category RSS feed, but its completeness/coverage versus the category catalog is not established. Current HTML category collector remains an incomplete snapshot.

## Next P0

Verify owner API/UI against the existing authorized Supabase project in an isolated deployment, then finish protected scheduled collectors, lock coordination and source-health monitoring. A production-ready claim requires the actual browser/API/hosted database flow, scheduler and alerts; passing local checks alone is insufficient.
