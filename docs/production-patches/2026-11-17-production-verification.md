# Production verification — 2026-11-17

Existing production: https://isir-reality-msk-jakub.posusnanickuv.chatgpt.site/drazby

## Deployed fix
The Site API silently clamped insolvency offsets at 100000. Requests for 100050 repeated page 100000, preventing historical mirroring from advancing. The deployed fix validates nonnegative safe-integer offsets and preserves them without the artificial ceiling. Exact three-file patch is alongside this report. The GitHub application and Site source trees differ; this patch records the actual deployed Site change rather than placing files into incompatible repository paths.

Site source commit: f4c6b86570a8c1082f7730af81b396132a9319bd
Saved version: appgprj_6ab83056864c8191ae3af0ef8affb8a1~appgver_373a169f30508191a84eab83929b299a
Successful deployment: appgdep_6afcab33ed308191915db0c1f609764f at 2026-11-17T19:30:14Z.
Existing custom audience and production data retained. No schema changes.

Changed Site files:
- lib/isir-catalogue.ts
- app/api/insolvencies/route.ts
- scripts/test-catalogue.mjs

## Real production collection
Two manual authorized production refreshes started at 19:24:05Z and 19:27:40Z.
First: 1 inserted, 0 changed. Second: 0 inserted, 0 changed, 0 missing. D1 catalogue 263 -> 264.
Last source completion: 19:28:04Z.
Real new record: Rodinný dům v Třinci, okr. Frýdek-Místek, 4 455 333 Kč.
https://www.portaldrazeb.cz/drazba/137ex6358-25-mb-jk8qz
Source publication: 2026-11-17T07:54:22Z; D1 first seen: 2026-11-17T19:24:23.518Z.
Original detail returned HTTP 200 and matching title. Repeated collection retained the ID and first-seen time.

93 fresh source observations mirrored using upsert_leased_auction_observation under an acquired auctions lease, then verified. Actual source runs recorded with their observed start/completion/status/count, including partial/failing runs. No finalize call. Supabase has 141 auction records, including exactly one new Třinec record. This is a mirror; the website continues to read D1. Historical D1 and Supabase counts differ.

## Source results
Complete successful scope: CEVD 9; ÚZSVM 20; exdrazby 20; Portál dražeb 37; Prokonzulta 2.
Successful partial scope: Insolvenční záměry 1; OKdražby 2; Portál elektronických dražeb 2; Finanční správa 0; dražby-exekutoři 0; Správa železnic 0; Aukce města Karviná 0; DražbyProst 0; Elektronické dražby 0.
ASIS failed: HTTP 526. Partial zero is not proof of no market offers.

## Verification
Site npm test, npm run typecheck, production build passed.
Production offsets 100000 and 100050 returned distinct descending 50-row pages, with stable total 397736; repeated offset100000 returned the identical page.
100 actual indexed ISIR events were upserted and compared under the site-isir-mirror lease in the same transaction as checkpoint update, with old-checkpoint comparison. No findings fabricated; absent verdicts preserved existing values or NULL.
Verified checkpoint: latest_id 81035876 (unchanged), history_offset 100050, source_total 397736, complete false.
Newest interval has not been caught up; no claim of complete ISIR mirroring.
Two Site ISIR runs indexed 200 events each, no new findings. D1 contains 397736 indexed events and 15 existing findings.

## Automation
Existing automation 6ab994f0fa608191a23ae1b7372e4de6 resumed, hourly Europe/Prague, next scheduled 2026-11-17T21:14:04+01:00. No second scheduler created.
Exact historical disable reason is not exposed. Last recorded run required user action but this does not establish who disabled it or why.
The two manual API refreshes verify current collection; a subsequent unattended scheduled execution has not yet been observed.

## Remaining acceptance gaps
- ASIS HTTP526 and incomplete scopes above.
- Email provider and sender not configured (RESEND_API_KEY, EMAIL_FROM absent); no delivered email claimed.
- Browser session reaches ChatGPT login gate. Signed-in UI search/favorites/saved-filter behavior not fully exercised. Existing ownership/favorites tests passed.
- Source location contradiction: Portal dražeb record https://www.portaldrazeb.cz/drazba/203ex6410-23-ngodn is labelled Bruntál by source data but its title says Jindřichov, okres Šumperk. Region accuracy needs authoritative resolution; no guessed geographic mutation made.
- Old catalogue contains repeated titles across sources; only idempotence of the tested source identity is verified.
- ISIR history remains incomplete; latest mirror checkpoint not advanced without a proven contiguous interval.
- No full market coverage or fully completed application claimed.

## Concurrent work coordination
GitHub main observed at 1a2fb0d06279670ce2b0d280167aacc26e0dde0f.
Other instance PR #6 (fix/exdrazby-pagination-20261117) at 3cd79c210a14511f052e83043c4ab6e0338fe4d7 was left unchanged, as were PRs #4/#5. This branch changes only production patch/audit documentation. The Site already contains its own importer fixes.
