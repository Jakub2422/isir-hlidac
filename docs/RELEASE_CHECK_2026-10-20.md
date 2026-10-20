# Release check — 2026-10-20

## Verified starting point

- PR #2 remains open, draft and mergeable. Base is
  `automation/supabase-auction-reader`, not `main`.
- Branch `automation/single-user-features` starts at
  `13a3e827abfa64e5cce24dd20372364264d0ee51`.
- Quality checks run 38764050452 succeeded for that SHA.
- Existing Sites project `appgprj_6ab83056864c8191ae3af0ef8affb8a1`
  is active, version 20, source SHA
  `442e60b784888dccaaf0f62a62c170bf69890e20`.
  Its live URL is https://isir-reality-msk-jakub.posusnanickuv.chatgpt.site.
  It has no preview URL and no native Site schedules.
- Production runtime environment revision 0 has no entries. Required server
  configuration in the branch includes SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY, OWNER_USER_ID, COLLECTOR_SECRET and SYNC_SECRET.
  No credential values were read into source or committed.
- The connected Vercel account returns zero teams and zero projects.
  Deployment-card lookup is unavailable (tool not found).
  No Vercel-linked project or preview could be established.
- The code uses Vinext, Cloudflare Workers, D1 and ChatGPT identity headers.
  Deploying it as an ordinary Vercel Next.js app would not establish the same
  runtime or authenticated owner identity.
- Read-only Supabase inventory for existing `isir-drazby`
  (`fqgnvkssygmgevadxobv`) returned no public tables. No migrations or data
  changes were made, preserving the separate persistence work stream.

## Browser evidence and limits

The live Site opens the ChatGPT access screen. Following its sign-in link
reaches the OpenAI login form. No authenticated session is available in this
browser. No favorites, saved filters or notification persistence can therefore
be claimed as browser-verified. No production deployment or access policy was
changed. Sites provides production deployment operations, not an isolated
preview for this existing project. A new project was not created.

## CEVD release reliability fix

The live first page reports `total: 149`, but the old all-region collector
requested only 60 entries at offset zero. The fix traverses raw pages using
`take=100` and increasing `skip` before filtering Published items. It retains
the category, date, order and optional MSK region constraints.

A live call of the corrected collector returned 140 Published offers,
including 6 identified as MSK. This proves retrieval and normalization only;
it does not prove hosted persistence or UI visibility.

Incomplete results fail explicitly for repeated/invalid IDs, premature empty
pages, changing or inconsistent totals, request failure and the 25-page
safety limit. The existing collector catches source failures and records them
in crawl/source health instead of reporting these CEVD cases as successful.
Regression cases are part of the existing `test:auction-import` CI step.
Local parser tests, TypeScript check, targeted ESLint and production build pass.
Other supported sources are not certified as complete by this audit;
collector crawl records continue to use `completeSnapshot: false`.

## Scheduler and remaining release blockers

The hourly workflow exists on the feature branch; fetching that same workflow
path on the repository default branch returns 404. Cron text in an unmerged
branch is not evidence of an active automatic run. No scheduler was enabled
or duplicated, and no A/run/B hosted database evidence is available.

Before release: finish hosted schema and server configuration; establish a
compatible deployment and real owner identity; verify collector write/read
and replay, browser favorites/filters/notifications across reload; then configure
one scheduler and prove an automatic run through deployed API to hosted DB.
Keep PR #2 draft and unmerged until these checks pass.
