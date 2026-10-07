# Contract-type SQL/TS parity test — Plan Brief
Full plan: `context/changes/contract-type-shared-source/plan.md` · issue text: `change.md`

## Complexity
TRIVIAL — one new test file, one increment, one phase, no schema or runtime change. Skipped: rs-research (the few files involved were read directly; Jev unavailable in dry mode, p=0.11) and rs-frame (the issue's fix is only a test; the stale claims in it were verified against the code during planning; Jev unavailable, p=0.28).

## Key decisions made
| Decision | Choice | Why | Source |
|---|---|---|---|
| Areas | A1 contract-type parity, one increment | Single area, no dependencies | Orchestrator |
| Parity test vs derive one source | Parity test | SQL is hand-pasted into Supabase; no build step could generate it from TS (`migrations/` header "HOW TO RUN") | Auto |
| What the test compares | Effective (last-defined) CHECK set per constraint name, for both `team_members_contract_type_check` and `team_members_entra_contract_type_check`, in migration chain and in `supabase-schema.sql` | 09-25 migration (3 values) is superseded by 09-30 (6 values, `entra-contract-sync.sql:16-26`); schema file replays both (`supabase-schema.sql:542-566`); the issue's "3 values, 3 places" is stale | Auto |
| 2026-10-01 migration | Not compared | It defines no CHECK constraint (functions/trigger only) | Auto |
| Stale 3-value block in `supabase-schema.sql` | Leave as is | Replay script, later block wins; editing history is out of scope | Auto |
| Vacuous-pass guard | Assert at least one definition parsed per constraint | A reformat/rename would otherwise silently pass | Auto |
| Test location | `src/lib/contract-types.parity.test.ts` | Vitest only includes `src/**/*.test.{ts,tsx}` (`vitest.config.ts`) | Auto |
