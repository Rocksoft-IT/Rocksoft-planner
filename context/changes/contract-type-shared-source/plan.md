# Contract-type SQL/TS parity test — Implementation Plan

## Overview
Add one Vitest test that fails when the allowed contract-type set in `CONTRACT_TYPES` (TypeScript) and the effective SQL CHECK constraints on `team_members` (migrations replayed in order, and `supabase-schema.sql`) disagree. No runtime, schema or migration change.

## Current State Analysis
The issue's description is stale; the code shows more places and more values:
- `src/lib/types.ts:14,16` — `ContractType` union and `CONTRACT_TYPES` hold SIX values (`UoP`, `B2B`, `Freelance`, `Umowa Zlecenie`, `Umowa o Dzieło`, `Powołanie do Zarządu`), not three.
- `migrations/2026-09-25-team-member-contract-type.sql:34-36` — original `team_members_contract_type_check` with three values. It is superseded: `migrations/2026-09-30-entra-contract-sync.sql:16-26` drops and re-adds that constraint with all six values and adds `team_members_entra_contract_type_check` with the same six.
- `migrations/2026-10-01-entra-contract-name-fallback.sql` — touches functions/trigger only; no CHECK constraint (grep for `check`/`constraint` finds none).
- `supabase-schema.sql:542-544` — stale three-value `team_members_contract_type_check`, then a mirrored block (starting ~line 546) re-declares it and `team_members_entra_contract_type_check` with six values. The file is a replay script, so the last definition wins; the effective set today equals `CONTRACT_TYPES`.
- So a naive "compare the 09-25 migration or the first schema CHECK" test would fail today; the test must model last-definition-wins per constraint name.
- Consumers already tied to the TS set at compile time: `src/components/ui/ContractTypeBadge.tsx:4` (`Record<ContractType, string>`), `src/lib/entra/contracts.ts:1,7,15` (derives from `CONTRACT_TYPES`). No further copies of the value list exist in `src/`.
- Test infra: Vitest, `include: ['src/**/*.test.{ts,tsx}']` (`vitest.config.ts`), jsdom environment, `npm test`. Precedent: `src/lib/utils.test.ts`.

## Desired End State
`npm test` fails with a message naming the constraint and the missing/extra values whenever `CONTRACT_TYPES` and the effective CHECK value set of `team_members_contract_type_check` or `team_members_entra_contract_type_check` differ, in either the migration chain or `supabase-schema.sql`. Adding a value in TS only (or SQL only) is caught in CI/locally.

## What we're NOT doing
- Not deriving SQL from TS or generating SQL (SQL is pasted by hand into the Supabase editor; no build step exists for it).
- Not editing the applied migrations or removing the stale three-value block in `supabase-schema.sql` (history/replay semantics; out of scope, harmless since the later block wins).
- Not adding a new migration, runtime validation, or changing `ContractType`.

## Implementation Approach
A parity test beats deriving one source from the other: the SQL files are hand-run scripts and cannot import TS, and a codegen step would be a new build pipeline for a low-severity issue. The test reads the SQL files as text, strips `--` comments, finds every `add constraint <name> check (... in (<literals>))` for the two constraint names, and keeps the last definition per name (migrations in filename order, which is date-prefixed; `supabase-schema.sql` in file order). It compares each effective set (order-insensitive) to `CONTRACT_TYPES`, and also checks that the migration chain and the schema file agree with each other. It asserts that at least one definition was found per constraint so a rename or reformat cannot make the test pass vacuously.

## Increments
| # | Name | Phases | Depends on | User-visible | Status | PR |
|---|---|---|---|---|---|---|
| 1 | Contract-type SQL/TS parity test | 1 | — | no | pending | — |

## Phase 1: Parity test
### Overview
One new test file that locks the TS set to the effective SQL CHECK sets.

### Required changes
#### 1. Parity test
- **File**: `src/lib/contract-types.parity.test.ts` (new)
- **Goal**: Fail when `CONTRACT_TYPES` drifts from the effective SQL constraint value sets, with a readable diff (missing/extra values) in the assertion.
- **Contract**: Uses `node:fs`/`node:path` only (no new dependency); paths resolved from the repo root. For each of `team_members_contract_type_check` and `team_members_entra_contract_type_check`: effective migration-chain set == effective `supabase-schema.sql` set == `new Set(CONTRACT_TYPES)`; at least one definition found per constraint per source; `CONTRACT_TYPES` has no duplicates. Comment explains why the 09-25 migration's three-value constraint is intentionally not compared (superseded by 09-30).

### Success criteria
#### Automated
- `npm test` passes, including the new parity test
- Parity test fails when a value is temporarily added to `CONTRACT_TYPES` or removed from one SQL constraint, and passes again after the revert
- `npm run lint` passes on the new file
- `npx tsc --noEmit` passes
#### Manual
- None

## Testing Strategy
The test is the deliverable. Red-first proof is the temporary-mutation criterion above (run by the implementer, recorded in the phase commit/notes).

## References
- Issue: `change.md`
- `src/lib/types.ts:14-16`, `migrations/2026-09-30-entra-contract-sync.sql:16-26`, `supabase-schema.sql:542-566`, `src/lib/utils.test.ts`

## Progress

### Phase 1: Parity test
#### Automated
- [ ] 1.1 `npm test` passes, including the new parity test
- [ ] 1.2 Parity test fails when a value is temporarily added to `CONTRACT_TYPES` or removed from one SQL constraint, and passes again after the revert
- [ ] 1.3 `npm run lint` passes on the new file
- [ ] 1.4 `npx tsc --noEmit` passes
#### Manual
