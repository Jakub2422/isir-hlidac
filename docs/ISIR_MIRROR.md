# Parallel ISIR persistence

The existing D1 collector is unchanged. POST /api/isir/mirror is a separate,
fail-closed server endpoint (Authorization: Bearer SYNC_SECRET). It requires DB,
SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Never expose those secrets to clients.

Apply versioned migrations to the existing isir-drazby project before enabling
this endpoint. The crawl migration now uses completed_at and fetched_count.
last_error_at retains the time of the latest error after recovery; last_error
clears on successful collection.

Each mirror call copies at most 25 D1 events and their findings atomically through
one RPC per event. A failed RPC stops the batch before advancing its checkpoint.
Repeated calls are safe. After reaching the end, the checkpoint resets and the
next pass reconciles older IDs inserted by historical collection or later analysis.
Concurrent calls may replay rows but do not create duplicates. D1 stays authoritative
until count, field and real-data comparisons pass. No live migration has been run.

Local tests cover PostgreSQL migrations, RPC privileges, repeated imports, retained
finding timestamps, mismatched event rejection, checkpoint failure and replay.
Remote Supabase access, deployment, scheduling and real-data end-to-end verification
are still required. This endpoint is not automatically scheduled by this commit.
