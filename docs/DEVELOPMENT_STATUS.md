# Development checkpoint — 2026-10-13

Branch: automation/single-user-features, draft PR #2. Production main and the existing Site have not been changed.

## Completed this run (local implementation)

- Checkpoint re-read from GitHub: initial 0da515f, then b547f81 (alert drain), CI run 96 successful. PR #2 remains open draft; its base is automation/supabase-auction-reader, not main. No merge or deployment.
- Bounded alert drain: 500/page, up to ten pages and 90 seconds; transactional continuation, explicit backlog/failure reporting to scheduler, queue metrics in /api/health. PostgreSQL regression drains 1101 events; unit regression covers 1201 and interrupted retry.
- Conservative cross-source identity in persistence: structured lot-level evidence, conflict veto, unique-candidate-only merge, source occurrences and provenance preserved. Weak/ambiguous matches remain separate and are marked in the auction UI. First source remains authoritative to avoid stale mirror oscillation. See CROSS_SOURCE_DEDUP.md.
- Explicit server SELECT grants remove reliance on hosted default privileges. Configured DB read failure now returns 503 instead of silently falling back to nonpersistent live offers. Empty DB stays empty.
- Full local pnpm check passes (including actual PGlite PostgreSQL migrations/RPC tests and production build). Reader/source-filter regression covers provenance. Browser rendering is not verified.
- Existing 34 captured real-source offers replay safely. Positive cross-source identity tests use synthetic structured observations, not a verified real cross-source pair. Current summary collectors generally lack lot identity; enrichment remains necessary before claiming real auto-merge coverage.
- Fresh CEVD network call on 2026-10-13 Prague returned 60 published offers. This confirms live access and also the existing first-page cap; it does not prove hosted persistence or completeness.

## External blockers (confirmed this run)

- Supabase plugin discovery reports available but not installed. Install/connect Supabase in Work using the account containing existing isir-drazby and allow project inspection/migrations. Do not paste credentials into chat or create a replacement project.
- Vercel list-projects query for isir returned an empty list. Existing Sites project appgprj_6ab83056864c8191ae3af0ef8affb8a1 is active, version 20, and was read only. Sites has production publishing, not a safe isolated preview for this project. The Cloudflare Workers/D1/ChatGPT identity runtime cannot be assumed to run as an unmodified Vercel preview.
- Hosted schema/migrations/read-write/replay, owner browser persistence and scheduler dispatch remain UNVERIFIED. No schedule activated. Main and the backup Site remain unchanged.

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

Authorize management access to existing Supabase isir-drazby, inspect applied migrations, apply only missing safe migrations, and verify hosted replay. Then verify owner browser persistence and scheduler dispatch against an isolated deployment. A production-ready claim requires that actual hosted/browser/scheduler/alert flow; passing local checks alone is insufficient. Next independent priority: finish and live-verify CEVD pagination and explicit source completeness, then the other prioritized sources. Cross-source detail enrichment, hosted verification and ISIR alert coverage remain open.
