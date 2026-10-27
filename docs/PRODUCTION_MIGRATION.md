# Production migration runbook

Keep the current Site online until the replacement deployment passes verification.

## Prerequisites
- Supabase project visible to the connected account.
- Vercel project visible to the connected account.
- Deployment environment configuration stored outside Git.
- The Supabase service-role secret is server-only and must never use a `NEXT_PUBLIC_` variable or be committed.
- Configure server-only `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `COLLECTOR_SECRET` and `SYNC_SECRET` in the deployment environment. Never expose these through client-side variables.
- `SYNC_SECRET` is server-only; `/api/sync` must fail closed when it is missing.

## Database and cutover
1. Inspect the existing isir-drazby project identity, migration journal, table columns, policies and RPC definitions first. Compare each repository migration with that actual state. Apply only missing, reviewed migrations in timestamp order; do not replay the whole directory or assume an empty database. Treat `supabase/schema.sql` as an older readable snapshot, not an application script.
2. Verify the seeded auction sources and their enabled state.
3. Configure the protected auction collector endpoint and run collection in verification mode. Do not schedule it until persistence results are verified.
4. Persist a small verified sample and compare it with the current Site.
5. Enable scheduled collection and verify crawl-run history.
6. Migrate ISIR cursor/state and verify findings.
7. Enable authentication, favorites, saved filters and alerts.
8. Deploy a Vercel preview and run quality checks.
9. Compare counts and representative records against the old Site.
10. Switch production only after verification.

## Safety invariants
- A failed or partial source crawl must never mark unseen listings as disappeared.
- Cross-source deduplication requires strong evidence; title similarity alone is insufficient.
- Notification insertion is idempotent per alert rule, auction, channel, event type and event key.
- The auction collector fails closed when its secret or Supabase server credentials are missing.
- Missing-auction finalization stays disabled until a source crawl is known to be complete.
- The current ChatGPT Site remains unchanged during migration preparation.

## Isolated deployment gate

This is a Vinext/Cloudflare Workers app with D1 and ChatGPT identity. The existing
`.openai/hosting.json` identifies the backup production Site. Do not change its ID
or publish there for testing. An isolated compatible environment must supply its
own approved Site identity, ChatGPT auth client and D1 binding, plus server-only
OWNER_USER_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, COLLECTOR_SECRET and
SYNC_SECRET. No such environment is verified in this run. Vercel compatibility
is not established; a dummy vercel.json would not solve the runtime dependency.

After environment authorization: install frozen dependencies, run `pnpm check`,
package the exact development commit with Sites, deploy only to the isolated ID,
and record the returned URL (never invent one). Verify hosted DB replay and owner
flows before setting repository SYNC_BASE_URL and dispatching the scheduler.
The workflow must exist on the default branch before GitHub permits manual
dispatch; currently it is development-only. Publishing the workflow alone is a
separate controlled step and must not merge the application PR or enable cron.
