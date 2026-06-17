---
name: rs-impl_review
description: >
  Review an implementation against its plan for drift, dangerous decisions, and
  pattern compliance. Works at two granularities — a single phase or the full
  plan — and in two modes — a fresh review (analyze → findings → interactive
  triage) or a resume triage (reopen a saved report and walk its pending
  findings). Reads context/changes/<change-id>/plan.md and its ## Progress as
  canonical state, classifies the git diff against the plan, and saves a durable
  review report. Use AFTER rs-implement, BEFORE rs-archive. Trigger phrases:
  "review the implementation", "check the work against the plan", "impl review",
  "did we drift from the plan".
argument-hint: "<change-id> [phase N] | <saved-review-path>"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Agent
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
---

# rs-impl_review: Review implementation against the plan

Compare the actual work against the plan to catch drift, dangerous decisions,
architecture violations, and pattern misuse before they accumulate:
`rs-implement → rs-impl_review → rs-archive`. It is a **review** skill — it
analyzes and reports by default; it edits code only when the user explicitly
chooses a fix during triage.

It reads the plan's `## Progress` section as canonical state per the contract in
`../rs-plan/references/progress-format.md` (completion = `count([x]) /
count(all)`; current phase = the phase of the first `- [ ]`).

## Inputs

- **`context/changes/<change-id>/plan.md`** — read IN FULL. Source of the planned
  changes, decisions, success criteria, and the "What we're NOT doing" scope.
- **`context/changes/<change-id>/change.md`** — `status`/`updated`.
- **`context/foundation/lessons.md`** *(optional)* — accepted rules used as review
  priorities.
- **Git** — scope detection: list commits/diff since the plan was written and
  classify changed files against the plan's file list.

## Outputs / mutations

- **Saved report:** `context/changes/<change-id>/reviews/impl-review.md` (full
  plan) or `…/reviews/impl-review-phase-N.md` (phase scope).
- **`change.md`:** set `status: impl_reviewed`, `updated: <today>`.
- **Triage fixes** (only if the user picks one): minimal targeted edits, plus an
  optional rule appended to `context/foundation/lessons.md`.

## Argument parsing (resolution order)

1. Argument is a saved report (file contains `<!-- IMPL-REVIEW-REPORT -->`) →
   **resume triage** (jump to Step 5).
2. Argument is a `<change-id>` with `context/changes/<change-id>/plan.md` →
   fresh review.
3. A plan path (`@context/changes/<id>/plan.md`) → fresh review.
4. A phase number (`phase N`) → review that phase only.
5. No argument → enumerate `context/changes/*/change.md`, pick the most recently
   updated change whose `status` ∈ `{implementing, implemented}`, and confirm.

If the resolved plan path starts with `context/archive/`, refuse ("reviews are
not appended to archived plans") and STOP.

## Process

### Step 1: Load plan & detect change scope

Load the plan in full, lessons (if any), the `## Progress` canonical state, and
`change.md`. Set scope: a specific phase → that phase only; else all phases whose
Progress rows are fully `[x]`. Extract the planned file list, decisions, success
criteria, and NOT-doing boundaries. Detect git scope (commits/diff since the
plan) and three-way classify each changed file: **in plan AND diff** (expected,
verify intent), **in diff NOT plan** (unplanned, investigate), **in plan NOT
diff** (possibly missing). Don't load every changed file into main context —
subagents read what they need.

### Step 2: Parallel subagent review

Launch two `general-purpose` subagents concurrently via the Agent tool:

- **Agent 1 — plan-drift.** For each planned change, read the real file and emit
  MATCH / DRIFT / MISSING / EXTRA, with `file:line` evidence.
- **Agent 2 — safety, quality, pattern compliance.** Scan for security /
  performance / reliability / data-safety issues, and compare against 1–2
  neighbor files for pattern consistency (report only meaningful mismatches).
  Scale effort to scope (≤3 files changed → minimal pattern work).

Each finding: file, line, dimension, severity, description, recommendation.

### Step 3: Verify success criteria

Run each `#### Automated` check via Bash; record command, pass/fail, output. For
`#### Manual` items, compare `- [x]` vs `- [ ]` in `## Progress`; flag any marked
done with no diff evidence ("blind signing"); treat unchecked as pending.

### Step 4: Compile findings & present

Build the findings, render the report, then ask: triage now / save & triage later
/ save only. On save, write the report and set `change.md` status to
`impl_reviewed`.

### Step 5: Interactive triage

Fresh or resumed: walk each `Decision: PENDING` finding. Per finding offer: apply
the fix / fix differently / skip / accept / dismiss / accept-as-rule (append to
`lessons.md`). Update the saved report's `Decision:` field after each. When done,
summarize and mark the review task complete.

## Saved report format

```md
<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: <Plan Title>

**Plan**: <path>   **Scope**: <phase N | full plan>   **Date**: <YYYY-MM-DD>
**Verdict**: APPROVED | NEEDS ATTENTION | REJECTED   **Findings**: <count>

## Verdicts
| Dimension | Verdict |
|---|---|
| Plan Adherence | PASS \| WARNING \| FAIL |
| Scope Discipline | … |
| Safety & Quality | … |
| Architecture | … |
| Pattern Consistency | … |
| Success Criteria | … |

## Findings
### F1 — <title>
- **Severity**: CRITICAL | WARNING | OBSERVATION
- **Impact**: LOW | MEDIUM | HIGH   <!-- decision effort, not severity -->
- **Dimension**: <one of the six>
- **Location**: <file:line>
- **Detail**: <what and why>
- **Fix**: <one line>            <!-- or Fix A ⭐ Recommended / Fix B on a real tradeoff -->
- **Decision**: PENDING
```

## Classification

- **Severity** (how bad if ignored): `CRITICAL` / `WARNING` / `OBSERVATION`.
- **Impact** (orthogonal — decision effort to resolve): `LOW` / `MEDIUM` /
  `HIGH`.
- **Dimensions** (6): Plan Adherence, Scope Discipline, Safety & Quality,
  Architecture, Pattern Consistency, Success Criteria. Each gets PASS / WARNING /
  FAIL.
- **Overall verdict:** `APPROVED` (all PASS, or ≤2 minor warnings) / `NEEDS
  ATTENTION` (multiple warnings or one non-critical FAIL) / `REJECTED` (any
  critical FAIL).
- Findings sorted CRITICAL → WARNING → OBSERVATION, capped at ~10 (consolidate
  beyond that). Default one fix; two only on a genuine tradeoff, exactly one
  marked `⭐ Recommended`.

## Critical guardrails

1. **Review, not rewrite.** Analyze and report by default; edit only when the
   user picks a fix in triage, and then minimally — never refactor unflagged code.
2. **Be specific.** Cite `file:line` with evidence; don't flag style preferences
   unless they matter.
3. **Catch plan flaws too.** If the plan itself proposed something unsafe, flag
   it — the review covers the plan, not just the code.
4. **Impact ≠ severity.** Severity is how bad; Impact is how hard the decision is.
5. **Phase reviews still check prior phases.** Verify a phase's changes didn't
   break earlier phases' assumptions.
6. **Resume-safe.** A saved report (`<!-- IMPL-REVIEW-REPORT -->`) with `Decision:
   PENDING` fields can be reopened and finished later.
7. **Sets status, never archives.** Writes `status: impl_reviewed`; archival is
   `rs-archive`'s job.

## Notes

- Output is the saved report under `context/changes/<change-id>/reviews/`.
- The Progress contract is owned by `rs-plan`; this skill reads it, never mutates
  it.
