---
name: rs-roadmap
description: >
  Generate context/foundation/roadmap.md from a PRD as an ordered set of
  vertical, end-to-end slices. Use AFTER rs-prd to turn a holistic PRD into a
  sequence of user-visible milestones a programmer can pick off and hand to
  rs-plan. Reads the PRD plus the project's tech-stack.md, glossary, and ADRs.
  Trigger phrases: "write the roadmap", "generate roadmap", "create the roadmap
  from PRD", "turn the PRD into a roadmap", "what should I build first". Do NOT
  use for per-change planning — that's rs-plan's job.
argument-hint: "[path-to-prd]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Agent
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
---

# rs-roadmap: Turn a PRD into ordered vertical slices

This skill sequences a finished PRD into a build order:
`rs-prd → rs-roadmap → rs-plan <change-id> → build`. Its output,
`context/foundation/roadmap.md`, is a dependency graph of **vertical slices**
(user-visible capabilities, each sized for one `rs-plan` run) plus the minimal
**foundations** that unlock them — never a calendar, never low-level design.

The PRD is the source of truth. The roadmap only sequences what the PRD already
contains; it never invents scope. The output contract (frontmatter, sections,
per-entry fields, self-check) lives in `references/roadmap-template.md` — read it
before generating and re-check at the self-check step.

## Inputs

- **`context/prd/prd.md`** (primary; or a path argument with leading `@`
  stripped) — read IN FULL.
- **`context/foundation/tech-stack.md`** (best-effort) — informs `## Foundations`
  and shortcuts the baseline survey (a layer declared here is reported
  "per tech-stack.md" without re-probing).
- **`context/discovery/glossary.md`** (best-effort) — use its canonical terms.
- **`context/discovery/decisions/`** (best-effort) — respect ADRs; don't
  re-litigate decided architecture.
- **`context/discovery/discovery-notes.md`** (best-effort) — lift any
  `## Forward: technical-roadmap` bullets as candidate input.
- **`context/foundation/roadmap.md`** (best-effort) — for collision handling.

## Output

`context/foundation/roadmap.md` — a foundation document (edit-in-place;
archive-then-replace on regeneration).

## Process

**Initial response.** If a path argument is given, capture it → Step 1. Else
default the input to `context/prd/prd.md` → Step 1 (don't ask yet).

### Step 1: Locate & read the PRD

Resolve the path (strip a leading `@`; else default). `test -f`. If found, read
IN FULL. If missing, ask (run rs-prd first / provide another path / cancel); on
"run rs-prd first" print the redirect and STOP.

### Step 2: Read supplementary inputs (best-effort)

Read tech-stack.md, glossary.md, decisions/, the discovery-notes forward block,
and any existing roadmap.md. Missing files are fine — note and continue.

### Step 3: PRD readiness check

Score the PRD 0–4 (1 point each): (1) `## Vision & Problem Statement` non-trivial
(≥2 sentences, no `# TODO`); (2) ≥1 filled user story (`### US-NN:` with
Given/When/Then); (3) ≥1 must-have FR (`^- FR-\d{3}: .*[Pp]riority: must-have`);
(4) filled `## Business Logic` (a declarative sentence, not `# TODO: domain
rule`). Print the scorecard. **Score ≥3** → Step 4. **Score <3** → name each
missing signal with its consequence, then offer: ground the PRD first (stop) /
continue anyway (Step 6 flags thin areas) / cancel.

### Step 4: Auto baseline survey

Probe six layers — **Frontend, Backend/API, Data, Auth, Deployment/infra,
Observability** — in ONE parallel batch via the Agent tool (Explore subagents),
or sequentially if unavailable. Skip a layer already named in `tech-stack.md`
("per tech-stack.md: <choice>"). Each probe returns a ≤100-word verdict —
**present** (file evidence) / **absent** / **partial** — no speculation, no
edits. Summarize, then ask the user to confirm / correct a layer / add one not
listed. `present` → its Foundations slot is skipped; `absent`/`partial` → it
opens a Foundations slot.

### Step 5: Frugal interview (the core gate)

At most **3 anchor questions**, each with one strong **Recommendation** (backed
by a PRD/artifact quote) plus 1–2 *real* alternatives (each with a genuine "why
also reasonable" clause — no straw men). Ask one structured question per anchor,
in order:

1. **main_goal** — from `market-feedback | quality | low-complexity | speed |
   learn | other`.
2. **north_star** — the single most valuable end-to-end, user-visible increment
   to land first. For a new product, the flow that proves the core hypothesis;
   for an existing or large system, the increment that delivers the most value or
   de-risks/unblocks the most downstream work. Options name slice candidates
   (`US-NN candidate — outcome`), not abstractions.
3. **top_blocker** — from `skills | capacity | time | decisions | external |
   motivation | none`.

The Recommendation is always option 1 with "(Recommended)". Skip an anchor only
if the PRD frontmatter / Success Criteria literally state the value (announce the
skip with the quote). **Investment areas** (invest-deeply vs go-simple per
layer) are *derived*, not asked — from main_goal + layer-blocking NFRs + baseline
gaps. Close with a single synthesis message locking the framing (no new
questions); the user says "go" or overrides any line. Hard limit: 3 anchors, one
synthesis — then decide via the Recommendation, record it in frontmatter with a
one-line rationale, and continue.

### Step 6: Decompose & sequence (in memory)

- **6a — Foundations.** Identify cross-cutting enablers: tech-stack-implied
  scaffolds, infra-requiring NFRs, access control beyond single-user,
  absent/partial baseline layers, invest-deeply picks. Each is the *smallest*
  enabling contract — it must NOT complete a whole layer. Ids `F-NN`.
- **6b — Slices.** Cut the user-visible surface into vertical, end-to-end slices
  (one user-visible capability, touches every layer it needs, sized for one
  `rs-plan` run, usually one `US-NN`). No horizontal slices. Ids `S-NN`. Each
  gets a stable kebab-case **Change ID**. Split a slice that spans >1 core
  action, mixes setup+workflow+admin, satisfies most must-haves, carries >1 risk,
  or bundles unrelated unknowns — split by narrower vertical outcome, never by
  layer.
- **6c — Dependency graph.** Fill `Prerequisites`, `Unlocks` (foundations only),
  `Parallel with` (be generous when `top_blocker: capacity`).
- **6d — Topological sort, north-star-aware.** Place the north star as early as
  prerequisites allow; break ties by main_goal.
- **6e — Unknowns.** `Blockers` (external pending) and `Unknowns` (question +
  owner + Block yes/no); Block:yes → `Status: blocked`.
- **6f — Open Roadmap Questions** (PRD Open Questions verbatim + new cross-slice
  questions). **6g — Parked** (PRD Non-Goals + deferred items). **6h — Streams**
  (optional navigation view; omit if <2 streams).

### Step 7: Generate the roadmap

Write the content per `references/roadmap-template.md` — exact section names,
full per-entry fields, glossary vocabulary. Define any strategic term
(north star, wedge, riskiest assumption, …) in prose at first use.

### Step 8: Self-check

Run every test in the template's self-check list. On any failure, **abort the
write** and report the specific failure. Do not silently fix. Then STOP.

### Step 9: Collision check

`test -f context/foundation/roadmap.md`. If absent, write and go to Step 10. If
present, default to archive-then-replace: move the existing file to
`context/foundation/archive/<YYYY-MM-DD>-roadmap.md` (append `-2`, `-3` on the
same day), then write. Offer overwrite-without-archiving or cancel as
alternatives.

### Step 10: Handoff

Print a boxed "ROADMAP GENERATED" summary (project, path, main_goal, top_blocker,
baseline present count, foundation/slice counts, status breakdown, PRD coverage,
open-questions/parked counts, north star). Then recommend **exactly one** next
move (not a menu), by precedence: (1) north star ready → recommend it; (2) else
the foundation it depends on, if ready; (3) else resolve the highest-impact open
question/blocker; (4) else the ready slice unlocking the most downstream. Format:

```
► Your next move: rs-plan <change-id>   — <why this first>
  Next in order: <id — outcome>, <id — outcome>
  Blocked: <id — what unblocks it>
```

STOP. Never auto-chain.

## Critical guardrails

1. **PRD is the source.** Every slice references real PRD ids; the interview
   reveals framing, it does not extend the PRD.
2. **Vertical slices first.** Horizontal slices are the anti-pattern; foundations
   are the only carved-out exception (own section, `Unlocks`, minimal scope).
3. **Balanced granularity, no estimates.** No slice swallows most of the PRD; no
   time units, points, or S/M/L anywhere.
4. **No low-level detail.** No framework names, file paths, schemas, or code —
   those belong to `rs-plan`.
5. **Surface unknowns; don't paper over them.** Block:yes unknowns mark a slice
   `blocked` and push resolution to where a human decides.
6. **Baseline is surveyed, not asked.** Step 4 probes the codebase; the user only
   confirms.
7. **Self-check aborts on drift.** A missing section/field or a graph cycle aborts
   the write with a named failure.
8. **Foundation-document convention.** Archive-then-replace; surgical refinement
   is out of scope.
9. **Never auto-chain.** Step 10 announces one next move; the user invokes
   `rs-plan` when ready.

## Notes

- Output is `context/foundation/roadmap.md`, period. `rs-plan <change-id>` takes a
  slice's Change ID from here.
- `references/roadmap-template.md` is the single source of truth for the output
  shape; any section or field referenced here must exist there.
