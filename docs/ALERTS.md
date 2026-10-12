# Internal owner alerts

Apply `20261012100000_owner_alert_outbox.sql` after the lease and owner-storage
migrations. No hosted migration or deployment is claimed by this change.

An auction insert or actual price/date/status update writes an immutable event
snapshot within the persistence transaction. Replays and last-seen-only updates
produce no new event. Events remain pending until the server evaluator completes
them. Each auction sync drains up to 500 pending events, using the same
`matchesSavedFilter` function as the existing UI. Inactive filters and filters
created after the event are excluded; unknown prices do not satisfy price bounds.

Completion validates the collector lease, locks the event, inserts notifications
uniquely by event/filter, and marks the event evaluated in one transaction.
Interrupted evaluation is retried next sync; an evaluated event cannot duplicate
notifications. Matches use the event snapshot, not a subsequently modified offer.
Changes match either the previous or changed snapshot, so a price leaving the
filter range still alerts the prior match. Favorite-only alerts and ISIR alerts
are separate remaining work.

Owner-only `/api/notifications` lists the latest 200 entries and accepts marking
one or all unread entries as read. `/upozorneni` presents the list, reason, time,
filter, original source link and read actions. Navigation includes source health
and inbox. Database tables deny anon/authenticated direct access. Keys remain
server-side; no paid provider, email, SMS or push delivery was added.

Local regression covers 34 real-response offers, three important changes, event
replay, shared matching, durable completion replay, stale-token rejection, read
persistence and table grants. Browser → ChatGPT identity → hosted Supabase remains
unverified and requires the authorized isolated deployment.

## Bounded backlog drain

The evaluator drains up to ten pages of 500 events, with a 90-second work budget.
Only transactional completion removes an event from the pending set. Failure,
lease loss, or budget exhaustion leaves remaining work for the next run. A final
probe distinguishes an exactly full final page from a real backlog. The sync
endpoint reports evaluator failures as HTTP 503 with stage `alerts`, and retained
backlog as HTTP 207. The scheduler fails visibly for either case while continuing
independent ISIR sync. `/api/health` exposes pending count and oldest pending time.
Local unit tests cover 1201 events and interrupted continuation; PostgreSQL covers
1101 events over multiple runs without notification duplication. These are not
hosted verification results. Sustained ingress beyond the bounded drain capacity
needs operational intervention; the scheduler must not report it as success.
