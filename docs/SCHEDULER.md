# Unattended collection

The scheduled-sync workflow runs auctions, three recent ISIR batches and one history batch sequentially. GitHub Actions concurrency queues overlapping workflow runs. Busy/skipped ISIR stops subsequent ISIR mutations. HTTP 207 and persistence/mirror failures fail the job; independent ISIR still runs when auctions fail. Logs contain timestamps, status and counts, never request headers or secrets. Redirects are rejected to avoid forwarding secrets.

Not activated or production tested. GitHub scheduled workflows execute only from the default branch; this development-branch workflow is deliberately not merged. Test via workflow_dispatch on the development ref once an isolated deployment exists. Do not target the backup Site: its API contract differs.

Required configuration for the existing repository/deployment:
- Apply migration 20261011090000_collector_lease.sql to existing isir-drazby, after verifying earlier migrations.
- Set repository variable SYNC_BASE_URL to the isolated HTTPS deployment origin.
- Set repository secrets COLLECTOR_SECRET and SYNC_SECRET to the corresponding server values.
- Keep SUPABASE_SERVICE_ROLE_KEY and OWNER_USER_ID on the server only.
- Run workflow_dispatch and verify hosted writes, repeated-import idempotence and owner UI before enabling scheduled execution on the default branch.

The auction lease fails closed if the RPC is unavailable. It expires after 15 minutes for crash recovery and releases only for its matching token. Collection must finish within that window; lease renewal/fencing for unusually long collection remains a deployment validation requirement. No paid resource is provisioned.
