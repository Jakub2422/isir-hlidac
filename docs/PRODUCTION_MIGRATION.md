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
1. Apply every file in `supabase/migrations/` in timestamp order. Treat `supabase/schema.sql` as a readable schema snapshot, not as the production migration mechanism.
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
