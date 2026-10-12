# Conservative cross-source identity

## Completion contract

A new observation with explicit, matching lot-level evidence attaches a new source
occurrence to one canonical auction UUID. Replay changes neither UUID nor occurrence
count and generates no phantom auction-change alert. All original source URLs remain
available in the reader and auction card. Medium-confidence candidates remain separate
and receive a visible warning. Distinct lots, shares, parcel bundles and ambiguous
matches must not auto-merge. Existing canonical UUIDs are never retroactively merged.

## Evidence and authority

`Listing.identity` is optional structured evidence, not a guess from a title. Strong
keys require (authority + official auction ID + lot), (authority + proceeding + notice
+ lot), or (authority + cadastral code + complete parcel set + share + lot + timestamp).
A portal-local ID is not a global ID. Known conflicting identity fields veto a merge.
Proceeding alone, exact address/time and exact title/location/time are review-only.
A shared property does not imply a shared sale, especially with different shares/lots.

The database serializes identity resolution and occurrence writes transactionally.
Only one matching canonical auction from other sources may be reused; a second item
from an already represented source stays separate. Several possible canonical matches
produce review candidates, never an arbitrary winner. Existing same-source occurrence
identity always takes priority. Review candidates are retained as evidence; automatic
resolution/deletion of historical candidates is deliberately not implemented.

The first source remains authoritative for canonical price/date/status. Secondary
mirrors retain raw observations but cannot overwrite those fields on every replay.
This prevents stale-source oscillation and false change alerts. Automatic authority
failover is not implemented. The reader selects the primary occurrence consistently,
returns all provenance links, and source filters match every occurrence. Change-event
snapshots carry known provenance for saved-filter evaluation. Adding a secondary source
alone does not create another NEW_MATCH event.

## Verification and limits

Unit tests cover evidence normalization and conflicts. Local PostgreSQL tests run every
migration, then test two sources/one UUID, replay, source provenance, conflicting lots,
weak candidates, ambiguous matches and absence of phantom price/status events. Existing
34 real-response fixture offers still replay safely. Positive cross-source identity
cases are explicitly synthetic: current summary collectors generally lack the required
lot-level fields. They therefore produce review candidates or remain separate. Do not
claim real cross-source coverage until authoritative detail parsers and a captured
real cross-source pair establish that evidence. No hosted/browser verification claimed.

The server reader now has explicit SELECT grants (BYPASSRLS alone does not grant SQL
access). A configured but failing database returns HTTP 503 instead of silently
replacing persisted offers with live, non-favoritable offers; an empty database returns
an empty persisted result. Live mode remains available only when DB is not configured.
