<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Show who added an allocation to a person (edited by)

**Plan**: `context/changes/allocation-edited-by/plan.md`   **Scope**: full plan   **Date**: 2026-08-19
**Verdict**: NEEDS ATTENTION   **Findings**: 8

> The plan is an **AS-BUILT** record, reconstructed from the merged diff after the fact
> (PRs #45, #46, #47 — range `bd76026^1..efb5a44`). Plan Adherence and Scope Discipline
> therefore cannot detect drift in the usual sense: the plan was written from the code, so
> it agrees with it by construction. Those two dimensions were instead anchored on
> (a) whether the as-built record is an *accurate* description of the diff, and (b) the
> client's original request in `change.md`. `## Progress` is unchecked by design.
>
> The migrations and `supabase-schema.sql` were revised after this change by PR #58, which
> consolidated two duplicate stamping triggers and hardened the survivor. Findings below
> distinguish the state at `efb5a44` (what this change shipped) from the current tree.

## Verdicts

| Dimension | Verdict |
|---|---|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

### Success criteria — verified, not assumed

`node_modules/` was absent, so dependencies were installed (447 packages) rather than
recording the checks as SKIPPED, which would have capped this verdict regardless of merit.

- **`npm run build` → PASS.** Compiled clean, TypeScript clean, 9 routes generated.
- **`npm run lint` → PASS (no new problems).** ESLint reports 5 errors + 3 warnings, all
  pre-existing and none inside this change's hunks. Verified individually rather than
  taken on trust: `react-hooks/set-state-in-effect` fires in `PeopleClient.tsx`,
  `PersonModal.tsx`, `ProjectModal.tsx` and `TimeOffModal.tsx` — three of which neither
  change touches — and `git show bd76026^1:src/components/timeline/AllocationModal.tsx`
  confirms the flagged effect predates this change.
- **Manual criteria** — all 12 `## Progress` rows are unchecked, which is correct for an
  as-built record. Nothing is marked done without evidence, so there is no blind signing.
  They need a Supabase instance with the migrations applied, including
  `2026-08-19-consolidate-allocation-actor-trigger.sql`, which has **not** been run yet.

## Findings

### F1 — Plan credits the change with an anti-forgery guarantee it did not ship
- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Plan Adherence
- **Location**: `context/changes/allocation-edited-by/plan.md:76`, `:47`, `:111`
- **Detail**: The plan states the trigger approach "cannot be forged by a crafted request"
  and "removes the client from the trust path entirely", and the Phase 1 #2 contract says
  INSERT sets the columns "from `auth.uid()` via a `profiles` lookup". At `efb5a44` the
  code used `coalesce(new.created_by, actor)`, so a client-supplied value in the payload
  won over the session identity. With `allocations: authenticated insert … with check
  (true)` and no column grants, any authenticated user could attribute an allocation to a
  colleague. That hole was closed later, by the same PR #58 consolidation the plan already
  credits for the duplicate-trigger fix — but the record presents it as a property this
  change delivered. The plan is honest about one as-built defect and silently overstates
  the other.
- **Fix**: Correct plan.md:111 to `coalesce(new.created_by, actor)` and add a Critical
  Implementation Details bullet noting the client value could win on INSERT until the
  2026-08-19 consolidation replaced it with unconditional assignment.
- **Decision**: PENDING

### F2 — A session-less write silently erases the last known editor
- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Safety & Quality
- **Location**: `supabase-schema.sql:95` (also `:90`, `:96`)
- **Detail**: On UPDATE the trigger assigns `new.updated_by := actor` unconditionally,
  where `actor` resolves through `auth.uid()`. `auth.uid()` is NULL for every write that
  carries no end-user JWT — the Supabase SQL Editor, the Dashboard table editor, the
  service-role key, any future scheduled job or data-fix script. An admin correcting a
  typo in one allocation's `notes` from the Supabase UI therefore overwrites that row's
  `updated_by` with NULL *and* bumps `updated_at`, so the footer renders "Brak informacji
  o ostatniej edycji · <today>" for a row that had valid attribution a moment earlier. The
  design keeps no history, so the previous value is unrecoverable. A bulk date-shift script
  would do this to every row it touches. This is independent of the issues PR #58 fixed —
  in fact the hardening there made the assignment stronger, which is what widens this path.
- **Fix**: `new.updated_by := coalesce(actor, old.updated_by)` and
  `new.updated_at := case when actor is null then old.updated_at else now() end`. Reads
  `old.*`, not `new.*`, so it reintroduces no client-forgery surface.
- **Decision**: PENDING

### F3 — The lockstep convention this change introduced is already false
- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Pattern Consistency
- **Location**: `README.md:35`
- **Detail**: The new § Database migrations asserts that `supabase-schema.sql` "always
  reflects the current state of the database" and is what provisions a fresh project.
  Verified independently: `supabase-schema.sql` contains exactly three `create table`
  statements — `profiles`, `projects`, `allocations`. Neither `team_members` nor `time_off`
  is defined anywhere in `supabase-schema.sql` or under `migrations/`, yet both are queried
  by files this change edited (`timeline/page.tsx:10` and `:13`, `TimelineClient.tsx:25`).
  A developer following the README literally — provision from the schema file, replay
  `migrations/` — gets a database on which `/timeline` fails on its first two queries. The
  policy is right; publishing it as a statement of fact about a file that is two tables
  behind is what makes it untrustworthy as the reference future migration authors check.
- **Fix**: Add the missing `team_members` and `time_off` definitions to
  `supabase-schema.sql`, or soften the README claim to "should reflect" and file the gap.
- **Decision**: PENDING

### F4 — Delete path swallows its error and reports success
- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Safety & Quality
- **Location**: `src/components/timeline/AllocationModal.tsx:146`
- **Detail**: `handleDelete` never destructures or inspects the error from
  `supabase.from('allocations').delete()`; it proceeds unconditionally to `onSaved()` and
  `onClose()`. A failed delete (RLS rejection, offline, FK) closes the modal as if it
  worked, and the only signal is the allocation reappearing after the refresh — which
  reads as a UI glitch, not a failure. Nothing reaches the console either, so there is no
  diagnostic trail. Pre-existing rather than introduced here, and the same omission exists
  in `TimeOffModal.tsx:73` and `ProjectModal.tsx:68` — but this change deliberately
  hardened error handling in this exact file and left the sibling path untouched, and the
  change's own `Timeline.tsx:392-400` shows the intended shape.
- **Fix**: Destructure the error, log it, `setError(...)` with the generic message, and
  return before `onSaved()`/`onClose()`.
- **Decision**: PENDING

### F5 — Both timeline queries ship two profile rows per allocation, including emails
- **Severity**: OBSERVATION
- **Impact**: MEDIUM
- **Dimension**: Architecture
- **Location**: `src/app/(dashboard)/timeline/page.tsx:12`, `TimelineClient.tsx:24`
- **Detail**: The select was widened on the whole-table query — no date or person filter,
  just `.order('start_date')` — so every allocation carries two fully materialised profile
  objects. They are consumed in exactly one place: the single allocation whose modal is
  open (`AllocationModal.tsx:155-156`). For a few hundred allocations across a handful of
  managers that is several hundred duplicated copies of the same two or three profiles,
  serialized into the initial RSC payload and again on every client `refresh()` — which
  fires after each drag-move, drag-resize, save and delete. `email` is pulled purely as a
  display fallback for a missing `full_name`, so staff email addresses reach the browser on
  every timeline load whether or not a modal is ever opened. RLS permits it
  (`profiles: authenticated read all`), so this is payload weight and PII surface, not an
  access-control hole — but it grows linearly in allocations while consumption stays
  constant.
- **Fix**: Narrow both embeds to `(id, full_name)`, or fetch the two actor profiles lazily
  when the modal opens.
- **Decision**: PENDING

### F6 — The 130-character select literal is duplicated with nothing keeping the two in sync
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Pattern Consistency
- **Location**: `src/app/(dashboard)/timeline/page.tsx:12`, `TimelineClient.tsx:24`
- **Detail**: Phase 2's contract requires the same projection in both the server load and
  the client refresh, and both satisfy it with byte-identical literals and no shared
  constant. Both are cast to `AllocationWithProject[]`, so if a future edit widens one and
  not the other, TypeScript reports nothing — the failure surfaces at runtime as the audit
  footer showing "Brak informacji o ostatniej edycji" after any drag or save (which routes
  through `refresh()`) while showing the correct name on a hard reload. Manual criterion
  2.4 exists precisely because the risk was recognised, but it was left unguarded.
- **Fix**: Extract the projection to one exported constant and reference it from both call
  sites.
- **Decision**: PENDING

### F7 — The footer asserts an edit that never happened
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: `src/components/timeline/AllocationModal.tsx:462`, `migrations/2026-07-16-allocation-updated-by.sql:26`
- **Detail**: Two paths make a never-edited row claim an edit. The backfill sets
  `updated_by = created_by` for pre-existing rows, and the trigger sets `updated_by`
  alongside `created_by` on INSERT — so a row that has only ever been created renders
  "Ostatnio edytowane przez <creator> · <date>" where the date is `updated_at`, which equals
  `created_at`. The secondary line then repeats the same name and date under "Utworzone
  przez", displaying one event as two. Harmless for the stated purpose (knowing which
  manager to contact) but it presents fabricated edit history as fact, which is the kind of
  thing that gets relied on in a dispute. Separately, the date fragment sits *outside* the
  `editorName` ternary and `updated_at` is `not null default now()`, so a legacy row renders
  "Brak informacji o ostatniej edycji · 16 lipca 2026" — a bare date with no actor. The
  plan's contract and criterion 3.3 describe neither behaviour.
- **Fix**: Move the date inside the `editorName` branch, and suppress the "Ostatnio
  edytowane" line when `updated_at === created_at`.
- **Decision**: PENDING

### F8 — Record keeping: three gaps in the as-built plan and its change.md
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Plan Adherence
- **Location**: `context/changes/allocation-edited-by/plan.md:90`, `:199`; `change.md:8`
- **Detail**: Consolidated from three small record-accuracy gaps. (a) The `README.md`
  § Database migrations section — the only written statement of a convention later
  migrations depend on — appears in the plan only under `## References`, never as a
  Required change with a Goal/Contract, and no success criterion covers it. (b) The
  Critical Implementation Detail about the modal comment naming `set_allocation_audit_fields`
  was accurate at `efb5a44` but is now fixed; unlike the sibling duplicate-trigger note it
  is not annotated as resolved, so a reader will hunt for a defect that no longer exists.
  (c) `change.md` still reads `status: in-progress` with `updated: 2026-07-20`, although the
  work is merged and the as-built convention is `status: implemented`. Tooling keyed on
  `status` treats a shipped feature as unfinished.
- **Fix**: Add a `README.md` entry to Phase 1, annotate plan.md:91 as resolved, and let
  this review set `status: impl_reviewed`.
- **Decision**: PENDING

## Scope check against the client's request

Every requested behaviour is delivered: last-editor attribution, at the bottom of the
allocation detail panel, for all allocations in `/timeline` (both the server load and the
client refresh carry the embeds), with the creator kept as a secondary line. The
client-acknowledged limitation — pre-change rows show nothing until first edited — is
honoured. Nothing requested is missing.

Two deliverables were not requested, both review-driven and both minor: the `README.md`
convention section (F8a) and the generic save-error message. The latter is defensible on
information-disclosure grounds but it removed the one diagnostic the 2026-07-16 migration
header warned would matter — a save that succeeds silently because the migration has not
been run.
