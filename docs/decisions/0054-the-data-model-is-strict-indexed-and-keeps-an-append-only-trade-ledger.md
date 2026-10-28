---
id: DEC-0054
title: The data model is strict, indexed and keeps an append-only trade ledger
type: decision
status: accepted
created: 2026-10-25
updated: 2026-10-25
authors: [ayan]
tags: [data, infra]
related: [REF-0021, DEC-0034, DEC-0051, DEC-0046]
---

# The data model is strict, indexed and keeps an append-only trade ledger

## In plain words

The owner asked for a database that is organised, fast and safe for user information and trades. We checked every table. The rules that keep each person to their own rows now read the sign-in once per query, every link between tables has an index, and demo trades are written to a history that can only grow, where the same event can never be counted twice. One function removes everything a person has stored when they delete their account. On a test copy with a million orders, the slowest everyday query went from 68 ms to under a millisecond.

## Context

- Seventeen migrations built the schema one feature at a time: research results, trade tools, demo trading, Verify, payments, AI apps and latency ([REF-0021](../reference/0021-parity-database-schema-and-data-model.md) maps all of it).
- Supabase's advisors on the hosted project listed 41 row rules flagged as running per row, 9 foreign keys without an index, 3 owner-only functions that anon or signed-in callers could run, and 3 closed tables with no rule.
- Demo trading saves fills from the browser. Two open tabs could each fill the same order and move the cash twice: nothing in the database stopped a second fill.
- "Delete my account" requests were filed and then handled by hand, table by table.
- The hosted tables are nearly empty today (one demo account, no orders), so now is the cheap time to add rules.
- Migrations apply to the hosted project by themselves on merge, so a migration that fails on stored data blocks every later one.

## Decision

1. **Row rules read the sign-in once.** Every rule uses `(select auth.uid())` or `(select auth.jwt())`. Owner-only functions are revoked from the API roles. Closed tables get an explicit `using (false)` rule.
2. **An index behind every foreign key and every rule.** New indexes on `user_id` and on the composite account and order keys; four single-column indexes they cover are dropped. A SQL test fails the build if a foreign key has no index or a rule calls the sign-in per row.
3. **Stricter checks, added safely.** Each check is added `not valid` and then validated; if stored rows fail it, the check stays `not valid` with a notice instead of failing the migration.
4. **One fill per order.** A unique index on `(order_id, user_id, account_id)` is the idempotency key at the source, and a fill must belong to its order's account. The browser treats the refusal of a second fill as already done.
5. **An append-only trade ledger.** `trade_ledger` records account openings and resets, orders placed, status changes and fills, with the cash each one moved, in `numeric`. Triggers write it, so no client changed. Each event has an idempotency key, checked in a small table that is not partitioned (a unique index on a partitioned table must include the partition key, so it could not enforce uniqueness across months). People read their own rows; nobody writes through the API.
6. **Monthly partitions by our own function and pg_cron.** `trade_ledger_maintain()` keeps this month and the next three, plus a default partition, and pg_cron (already installed) runs it nightly. Partitions live in `parity_private`, which the API does not serve, with row level security on and no grants.
7. **One deletion path.** `delete_account_data(user)` deletes every row that names the person (the ledger included), withdraws their badges, unlinks payment events, removes their team row, forgets their analytics when that feature exists, deletes the login and logs the counts without the user id. Only the owner and the service role can run it.
8. **Migrations are tested before they ship.** `supabase/tests/local.sh` applies every migration to a fresh Postgres 17 with Supabase stand-ins, applies the new ones a second time, and runs the SQL tests; CI runs it as the `db` job. `supabase/tests/bench.sh` times the hot queries before and after on a million made-up orders.

## Alternatives considered

- **pg_partman for the ledger's partitions.** It is available on Supabase but not installed, and it is not in the local Postgres we test with, so we could not test the migration that sets it up. Our function is about 25 lines, pg_cron is already installed, and the default partition catches any row if a night is missed.
- **Partition the existing `paper_fills` table.** Rejected for now: turning a table into a partitioned one means copying it into a new table, which breaks the expand-then-contract rule for a table that is tiny today. The ledger is the large append-only table instead, and `paper_fills` can be moved later if it grows.
- **A ledger written by the browser through a function.** Rejected: triggers record the same events with no client change, and a function call can be skipped by an old tab.
- **Delete accounts automatically after a grace period.** Not done: the privacy policy promises 30 days and the owner handles requests today. A scheduled job can call the same function later.
- **Partial indexes for the nullable foreign keys.** Rejected: the saving is small on tables this size, and plain indexes keep the "every key has an index" check simple.

## Consequences

- The advisor findings above should clear after the migration applies. Leaked password protection stays off until the owner turns it on in the dashboard; the "unused index" notes stay (and the new indexes will join them for a while), because the tables are nearly empty.
- Every demo account action writes one to three extra small rows. On the test data the migration took 9 seconds to apply to a million orders.
- A second fill for one order now fails instead of doubling the cash. Old browser tabs without the new client show "Could not save" in that case.
- The ledger keeps growing for as long as accounts exist. At today's use that is tiny; the partitions make old months cheap to scan or archive if it ever matters.
- A new table that people write to should get the restrictive "connected apps cannot" rules ([DEC-0051](0051-ai-apps-connect-to-parity-through-a-hosted-mcp-server-and-people-bring-their-own-model.md)), a `user_id` index, `on delete cascade` to `auth.users`, and a line in `delete_account_data`.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0071: People make their own API keys for a versioned Parity API](0071-people-make-their-own-api-keys-for-a-versioned-parity-api.md)
- [REF-0021: Parity database schema and data model](../reference/0021-parity-database-schema-and-data-model.md)
- [LOG-0019: Work log for 24 and 25 October](../log/2026-10-25-work-log-for-24-and-25-october.md)
<!-- backlinks:end -->
