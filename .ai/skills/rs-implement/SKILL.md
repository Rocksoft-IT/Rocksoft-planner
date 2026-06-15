---
name: rs-implement
description: >
  Implement an approved plan from context/changes/<change-id>/plan.md, phase by
  phase, with automated verification, a human manual-test gate, and a commit per
  phase. The plan's ## Progress section is the single source of truth for
  execution state — this skill is its only writer after rs-plan. Use AFTER
  rs-plan, when a plan is ready to build. Runs standard or test-first (TDD) mode
  on the same plan and Progress. Trigger phrases: "implement this", "build the
  plan", "implement <change-id>", "do phase 2", "continue implementing", "tdd",
  "test-first", "red green refactor".
argument-hint: "<change-id> [phase N]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - Edit
  - Bash
  - Agent
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
---

# rs-implement: Execute a plan, phase by phase

This skill is the build step of the chain:
`rs-roadmap → rs-plan <change-id> → rs-implement <change-id>`. It reads an
approved `plan.md`, implements one phase at a time, verifies, gates on human
manual testing, and commits — updating the plan's `## Progress` section as it
goes.

The `## Progress` section in `plan.md` is the **single source of truth** for
execution state; state is *inferred from it, not stored elsewhere*. Its contract
(step format, parsing, mutation surface) lives in
`../rs-plan/references/progress-format.md` — read it before touching Progress.
**This skill mutates ONLY the `## Progress` section** of the plan; every other
part of the plan is read-only.

## Inputs

- **`context/changes/<change-id>/plan.md`** — read IN FULL. The `## Progress`
  section drives what to do next.
- **`context/changes/<change-id>/change.md`** — its `status`/`updated` frontmatter.
- **`context/foundation/tech-stack.md`** — the project's test/lint/build tools,
  used to run automated verification.
- **`context/discovery/glossary.md`** + **`decisions/`** — vocabulary and ADRs to
  respect while coding.
- **`context/foundation/lessons.md`** *(optional)* — recurring team rules; if
  present, read and let them shape every implementation choice.
- **All files the plan references** — read in full before starting a phase.

## Modes: standard vs test-first (TDD)

This skill runs in two modes that share the *same* plan, the same `## Progress`
source of truth, the same phase-end commit ritual, and the same handoffs — they
differ only in the order of test vs code:

- **Standard** (default) — implement the change, then verify.
- **Test-first** — for a phase, write a failing test (RED), make it pass with
  minimal code (GREEN), then clean up (REFACTOR). Triggered by `--test-first` /
  "tdd" / "red green refactor". Assumes test infrastructure already exists; it
  does NOT set up runners, configs, fixtures, or CI.

In test-first mode, before each phase run the **TDD eligibility gate**:

1. **No existing implementation.** Do a targeted search for the files / symbols /
   endpoints / migrations the phase adds. If the core implementation is already
   present, STOP for that phase and explain that TDD doesn't fit already-written
   code — point to standard mode for that phase. Don't write retroactive tests.
2. **TDD'able.** The phase has an observable outcome assertable before the code
   exists (pure functions, transforms, parsers, validators, state machines,
   API request→response contracts, business logic, bug fixes). **Not TDD'able:**
   pure scaffolding, wiring/infra/config, visual polish with no assertion path,
   exploratory spikes, docs/content. Not-TDD'able → run that phase in standard
   mode. Mixed/ambiguous → ask: TDD the testable part (Recommended) / standard
   for the whole phase / TDD the whole phase.

The red→green→refactor loop maps onto Progress rows: each `#### Automated` row is
one loop pass — RED (one failing test, named for the outcome, failing for the
right reason), GREEN (smallest code to pass; fix the *code*, never weaken tests),
REFACTOR (clean up while green) — then flip that row `[ ]`→`[x]`. **Commit only
on green:** never stage or commit while any in-scope test is red, skipped-to-fake-
pass, or broken. Both modes can interleave freely on the same plan — they mutate
Progress identically.

## Argument parsing

- `rs-implement <change-id> [phase N]` → resolve to
  `context/changes/<change-id>/plan.md`. `@path`/full path is also accepted.
  Add `--test-first` (or invoke via "tdd") for test-first mode.
- **Archive guard:** if the resolved path starts with `context/archive/`, print
  "This change is archived. Open a new change instead." and STOP.
- **`phase N`:** jump to the first `- [ ]` inside `### Phase N:` in `## Progress`.
  Otherwise start at the first `- [ ]` in document order.
- **No argument:** print a short help message ("give me a change-id, e.g.
  `rs-implement oauth-login phase 1`; list with `ls context/changes/`") and STOP.

## Where am I? (state is inferred)

In `## Progress`: the first `- [ ]` line is the next step; the `### Phase N:`
header directly above it is the current phase. Completion =
`count([x]) / count(all)`. No sidecar file, no HTML markers. On resume, trust
existing `[x]` rows as done and continue from the first `- [ ]`; only re-verify
prior work if something looks wrong.

## Process

### Initial setup

1. Resolve the plan path (archive guard). Read `plan.md` in full, plus
   `lessons.md` (if any), `tech-stack.md`, glossary/decisions, and every file the
   plan references.
2. Update `change.md`: set `status: implementing` only if it is currently
   `planned` (or `plan_reviewed`); set `updated: <today>`.
3. Count phases from `## Phase N:` headers. Create one task per phase
   (TaskCreate, `subject: "Phase N: <name>"`). Set the current phase
   `in_progress`.
4. Find the next pending step in `## Progress`.

### Per-phase loop

- Keep an in-memory **changed-files set** — every `Edit`/`Write` adds its
  repo-relative path. Always include `context/changes/<change-id>/plan.md` (this
  phase edits Progress). On **Phase 1**, also seed the set with the untracked/
  modified files in `context/changes/<change-id>/` (e.g. `change.md`,
  `plan.md`, `plan-brief.md`). The set resets at each phase boundary. This set —
  not `git status` — is what gets staged.
- Implement the phase fully, following the plan's intent (Goal) and interfaces
  (Contract). Use the project's vocabulary; respect ADRs and lessons.
- **After each step**, flip its Progress row `- [ ] N.M <title>` → `- [x] N.M
  <title>` via Edit. Do NOT append a SHA yet. Do NOT check off `#### Manual`
  items until the human confirms them.
- **On a mismatch** between plan and reality: STOP, print
  `Issue in Phase [N]: / Expected: / Found: / Why this matters:`, then ask:
  adapt and continue / skip this part / stop and re-plan.

### End-of-phase ritual

1. **Manual-test gate.** Tell the human which automated checks passed, list the
   plan's manual-verification items, and **STOP** — do not proceed until the human
   confirms. On the final phase, also list any still-pending `#### Manual` items
   from earlier phases (informational).
2. **Staging set** = changed-files set ∪ `{plan.md}`.
3. **Unrelated dirty paths.** `git status --porcelain`; intersect with paths
   *outside* the staging set. If any, ask: stage only the planned set
   (Recommended) / stage all / abort.
4. **Stage by explicit path** — `git add <each file>`. NEVER `git add -A` / `.`.
5. **Empty-diff check** — `git diff --cached --quiet`. If nothing staged, print
   "Phase [N] had no diff to commit; rows remain SHA-less.", set `SHA=""`, skip to
   step 8. (Manual-only phases legitimately produce no code.)
6. **Propose a Conventional-Commits message** — subject
   `<type>(<change-id>): <phase title> (p<N>)`, `<type>` ∈
   `feat|fix|chore|refactor|docs`. Ask: approve / edit subject / override.
7. **Commit.** Never `--no-verify`, never `--amend`. If a pre-commit hook fails,
   fix the root cause and make a NEW commit.
8. **Capture SHA** — `git rev-parse --short HEAD` → `SHA` (skip if `SHA=""`).
9. **Write SHA back** — for each Progress row touched this phase, append
   ` — <SHA>` to its `- [x] N.M <title>` line. Skip rows that already carry a SHA
   suffix (resume safety). Skip entirely if `SHA=""`.
10. **Update `change.md`** — `updated: <today>`; keep `status: implementing`
    (set `implemented` only at plan end).
11. **Reset the changed-files set** before the next phase.

### Next-phase decision

If a next phase exists, ask: continue to Phase N+1 / clear context first / review
this phase first. On "clear context", copy the resume command to the clipboard:

```bash
echo -n "rs-implement <change-id> phase <next>" | pbcopy 2>/dev/null \
  || echo -n "rs-implement <change-id> phase <next>" | clip.exe 2>/dev/null \
  || echo -n "rs-implement <change-id> phase <next>" | xclip -selection clipboard 2>/dev/null || true
```

```powershell
Set-Clipboard "rs-implement <change-id> phase <next>"
```

If told to run multiple phases in sequence, skip this question between phases.

### Plan end (all Progress rows `[x]`)

1. **Straggler check.** Re-scan `## Progress` for any `- [ ]`. If any remain,
   list them and ask: pause (Recommended, STOP without flipping status) / proceed
   to epilogue anyway.
2. Update `change.md`: `status: implemented`, `updated: <today>` (NOT
   `archived_at` — that belongs to an archive step).
3. **Epilogue commit.** The last phase's SHA write-back and the `change.md`
   status change are still dirty (the final commit can't contain its own SHA).
   Stage exactly `plan.md` and `change.md` by path, check `git diff --cached
   --quiet` (skip if nothing), propose subject
   `chore(<change-id>): close out plan (epilogue)`, ask, and commit. Do NOT write
   the epilogue's own SHA back.
4. Print a completion summary (phases completed, key files changed). Optionally
   offer a final review (a future `rs-impl_review` step).

## Critical guardrails

1. **Mutate ONLY `## Progress`.** Phase blocks (Overview, Required changes,
   Success criteria) are read-only. No sidecar state file, no HTML markers.
2. **Progress is the source of truth.** Next step = first `- [ ]`; state is
   inferred, never stored.
3. **Manual gate is a hard STOP.** Never flip `#### Manual` rows or commit a
   phase before the human confirms manual testing.
4. **Stage by explicit path.** Never `git add -A`/`.`; the changed-files set, not
   `git status`, is canonical. Never `--no-verify` or `--amend`.
5. **Per-step `[x]` without SHA; SHA appended at phase end.** Skip rows that
   already have a SHA (no double-append on resume).
6. **Status lifecycle.** `planned`/`plan_reviewed` → `implementing` →
   `implemented`. Never set `archived_at`.
7. **Archive guard.** Refuse to implement a plan under `context/archive/`.
8. **Read in full; honor lessons and ADRs.** No partial reads; recurring lessons
   and recorded decisions shape every choice.
9. **Test-first commits only on green.** In test-first mode, RED is a transient
   checkpoint shown to the user, never a commit boundary; never fake a pass
   (`it.skip`/`xit`) to get to green.

## Notes

- Mutations are limited to `context/changes/<change-id>/plan.md` (Progress only)
  and `change.md` (status/updated), plus the actual code/commits the plan
  describes.
- The Progress contract is owned by `rs-plan` at
  `../rs-plan/references/progress-format.md`; this skill conforms to it rather
  than redefining it (single source of truth, no drift).
