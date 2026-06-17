---
name: rs-test-plan
description: >
  Stateful, phased test-rollout orchestrator for a product with code to test.
  Writes a durable risk-driven strategy at context/foundation/test-plan.md, then
  drives each rollout phase through the change chain (rs-plan → rs-implement →
  rs-impl_review → rs-archive). Re-running re-derives state from which artifacts
  exist on disk and resumes from the next pending rollout phase. Risks are failure
  scenarios, not code locations — code anchoring is deferred to per-change
  research. Use AFTER rs-prd and rs-roadmap. Trigger phrases: "create test plan",
  "plan tests", "test strategy", "phased test rollout", "continue test rollout",
  "risk map for testing", "QA spec".
argument-hint: "[path ...] | --status | --refresh"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Agent
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
---

# rs-test-plan: Risk-driven, phased test rollout

This skill produces and drives `context/foundation/test-plan.md`: a durable QA
strategy (risk map + phased rollout) plus a **stateful orchestrator** that fans
each rollout phase out into the change chain
`rs-plan → rs-implement → rs-impl_review → rs-archive`. It is stateful — every
invocation re-derives where you are by checking which artifacts exist on disk and
resumes from the next pending rollout phase.

The output contract lives in `references/test-plan-schema.md` (§1–§8). Read it
before writing the file and re-check at every write.

**Signal, not knowledge.** This skill reads the codebase only for churn, the test
profile, project markers, and the framework — never for call graphs, schemas, or
"which file owns the failure". Risks are scenarios a user would experience, not
code locations; anchoring to `file:line` is the per-change research step's job.

## Inputs

Explicit paths in the argument are always read (strip a leading `@`); defaults are
read only if not supplied:

- **`context/prd/prd.md`** — users, flows, business rules, success metric.
- **`context/foundation/roadmap.md`** — upcoming slices, what's next.
- **`context/archive/*/plan.md`** — what's already shipped.
- **`context/foundation/tech-stack.md`** (or manifest detection) — language,
  framework, runtime, test runner.
- **`AGENTS.md` / `CLAUDE.md`** — hard rules / conventions.
- **Test configs** — `vitest.config.*`, `jest.config.*`, `playwright.config.*`,
  `pytest.ini`, `phpunit.xml`, etc.
- **Git history** — a hot-spot scan (last 30 days, main code dirs) for likelihood
  weighting.

## Output

`context/foundation/test-plan.md` — one foundation document. `--refresh` does not
edit in place; it opens a dated refresh change instead.

## Process

### Phase 0: Prerequisites & state detection (always runs)

Detect a project marker; if none, print "No project markers found" and STOP.
Branch on `--status` (print §3 rollout state and stop) / `--refresh` (re-derive).
Then check explicitly:

```bash
test -f context/foundation/test-plan.md && echo EXISTS || echo MISSING
```

MISSING → Phase 1 (build the guide). EXISTS → Phase 5 (resume the rollout). Never
infer this from chat history.

### Phase 1: Discovery (only when the guide is missing)

Read the sources (explicit args first, then defaults). Build a **test-base
profile**: classify the project `none` / `sparse` / `meaningful` from existing
test files and config. Ground the stack via any available docs/search MCP (signal,
not knowledge). Run a git hot-spot scan: identify the main code dirs, confirm the
scope with the user, then scan churn (skip with a note if <5 commits in 30 days).
Summarize the inputs in ≤12 lines and confirm.

### Phase 2: User interview (only when the guide is missing)

Ask one question at a time, each with 2–3 examples. Five questions: what worries
you most / where have you been burned before / what do you change without
confidence / what's under-tested today / what should we deliberately NOT spend
test effort on. "Skip" is allowed; **3+ skips aborts** the interview (docs-only
guide). Reframe Q4 by test-base profile (`meaningful` as-is, `sparse` reframed,
`none` skipped without counting as a skip).

### Phase 3: Seed brief synthesis (in memory)

Synthesize a brief: top risks, hot-spots, user concerns, stack notes, risk
response guidance, proposed rollout phases. Run a silent **challenger pass** —
three checks: (a) is each risk a defect scenario, not an implementation detail?
(b) purge any `file:line`/symbol anchors from sources; (c) does each test target a
real regression, not just coverage (the oracle problem)? Add an abuse/security
lens row where applicable. Show the cleaned brief; ask Accept / Edit / Cancel.

### Phase 4: Write test-plan.md (only when the guide is missing)

Write the single file per `references/test-plan-schema.md`. Enforce §1 principle
#3 copied verbatim and §2 Source = evidence, never anchors. Then go to Phase 5.

### Phase 5: Read the guide, locate the current rollout phase

Read §3. Find the first row whose Status ≠ `complete`. If all are `complete`,
print "All rollout phases complete" and stop.

### Phase 6: Determine sub-state & present the next handoff

Derive the sub-state from disk (does the phase's change folder exist? a `plan.md`?
unchecked `## Progress` rows?) and lazily reconcile a stale §3 status. Map to one
handoff, print the exact next command, copy it to the clipboard, and STOP (each
handoff is a stop point — no auto-run):

- **`not started`** (no change folder) → `rs-plan <change-id>` (creates the change
  folder and the plan). *(If you use a research/frame step, run it before
  `rs-plan`.)*
- **`planned`** (`plan.md` exists, Progress pending) → `rs-implement <change-id>
  phase <N>`.
- **`implementing`** (some `[x]`) → `rs-implement <change-id> phase <N>`.
- **`complete`** (`plan.md` fully `[x]`, change archived) → set the §3 row to
  `complete`, bump `Last updated:`, return to Phase 5; ask continue / stop.

After a rollout phase's change is implemented, fold its concrete test recipe into
the relevant §6 Cookbook sub-section (replacing the TBD placeholder).

## Critical guardrails

1. **Signal, not knowledge.** Read the codebase for churn / test profile /
   markers / framework only — never for call graphs, schemas, or failure
   ownership. §2 Source is evidence (PRD/roadmap/archive lines, `interview Q<n>`,
   hot-spot directories, tech-stack constraints), never `file:line`/symbols.
2. **Risks are scenarios.** A risk is a failure the user would experience, never a
   code location.
3. **Never invent risks.** Every risk cites real evidence; unknowns become
   interview questions, not assumptions.
4. **Write only the guide.** Never write test code, CI YAML, hooks, or edit
   AGENTS.md. Never auto-invoke a downstream skill — every handoff is a STOP.
5. **State lives on disk.** Re-derive from which artifacts exist; the §3 status
   vocabulary is the fixed parser surface (English even in a translated guide).
6. **Schema is the contract.** Section order and the §1 principles are fixed;
   re-check `references/test-plan-schema.md` at every write.

## Notes

- Output is `context/foundation/test-plan.md`. It complements the roadmap: the
  roadmap sequences *product* slices, this sequences *test-risk* phases.
- Use AFTER `rs-prd` and `rs-roadmap`, once there is a product with code to test.
