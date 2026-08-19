# rs-skills

An end-to-end project chain — from "I have an idea" (or "I want to change this
system") all the way to a reviewed, archived change. Each skill is a link; every
link reads what the previous one wrote and points to the next without
auto-running it. Greenfield and brownfield are handled by the same skills, which
auto-detect context from the working directory.

The design blends two philosophies: a **phased, gated process** (context
detection, schema-as-contract, soft quality gates, named anti-patterns,
self-checks that abort on drift) and **lightweight grilling** (one question at a
time, a recommended answer with an escape hatch, exploring the codebase instead
of asking, capturing shared language inline).

## Installation

These skills ship as a Claude Code plugin distributed through this repo, which
doubles as a plugin marketplace (`.claude-plugin/marketplace.json`). The repo can
stay **private** — install access is governed entirely by your GitHub
permissions; no separate auth is needed.

**One-off, in any project (interactive):**

```
/plugin marketplace add Rocksoft-IT/rs-skills
/plugin install rs-skills@rocksoft
```

**Scriptable (non-interactive CLI):**

```bash
claude plugin marketplace add Rocksoft-IT/rs-skills --scope project
claude plugin install rs-skills@rocksoft --scope project
```

**Enable by default for everyone on a project** — commit this to the target
project's `.claude/settings.json`. Anyone who opens and trusts the project gets
the plugin installed and enabled automatically:

```json
{
  "extraKnownMarketplaces": {
    "rocksoft": {
      "source": { "source": "github", "repo": "Rocksoft-IT/rs-skills" }
    }
  },
  "enabledPlugins": {
    "rs-skills@rocksoft": true
  }
}
```

For a private repo: interactive installs use your existing `gh auth login` (or
SSH) credentials; auto-updates at startup read a `GITHUB_TOKEN` from the
environment.

## The chain

```
rs-init ──▶ rs-discovery ──▶ rs-prd ──▶ rs-roadmap ──▶ rs-plan ──▶ rs-implement ──▶ rs-impl_review ──▶ rs-archive
  stack      discovery     PRD        slices         plan        build            review            close
```

| Skill | Reads | Writes | Role |
|---|---|---|---|
| **rs-init** | tech palette | `context/foundation/tech-stack.md` + `context/` skeleton | Scaffold context dirs; declare the stack from a fixed house palette (no interactive selector). |
| **rs-discovery** | the idea, the codebase | `context/discovery/` (discovery-notes.md, glossary.md, decisions/) | Facilitated discovery conversation; captures problem, persona, success criteria, FRs, constraints, glossary, ADRs. |
| **rs-prd** | `discovery-notes.md` (+ glossary, ADRs) | `context/prd/prd.md` | Generate a stack-open PRD; gaps → Open Questions, never invented. |
| **rs-roadmap** | `prd.md` (+ tech-stack, glossary, ADRs) | `context/foundation/roadmap.md` | Sequence the PRD into vertical slices + minimal foundations as a dependency graph. |
| **rs-change** | a change-id + intent | `context/changes/<id>/change.md` | Open a change folder with an identity file. Optional explicit entry point per change. |
| **rs-research** | a research question, the codebase | `context/changes/<id>/research.md` | Parallel-subagent codebase research; grounds a plan. Optional, before rs-plan. |
| **rs-frame** | an observation / bug+fix | `context/changes/<id>/frame.md` | Challenge the framing before planning; separate observation from cause. Optional, before rs-plan. |
| **rs-plan** | a roadmap slice / change-id (+ frame/research) | `context/changes/<id>/plan.md` + `plan-brief.md` | Complexity-scaled research and a phased, intent-not-implementation plan. |
| **rs-implement** | `plan.md` (`## Progress`) | mutates `## Progress`, `change.md`, code/commits | Build the plan phase by phase, standard or test-first (TDD); commit per phase. |
| **rs-impl_review** | `plan.md`, the git diff | `context/changes/<id>/reviews/impl-review*.md` | Review implementation vs plan for drift, safety, and pattern compliance. If the change has no record, backfills one via `rs-change-from-pr` first. |
| **rs-change-from-pr** | a PR / local diff (+ linked issue, roadmap) | `context/changes/<id>/change.md` + as-built `plan.md` | Reconstruct an **as-built** change record when planning was skipped — the inverse of rs-plan. SDD catch-up so review/archive have something to stand on. |
| **rs-archive** | `change.md`, `roadmap.md` | moves folder to `context/archive/`; closes the roadmap slice | Close out a completed change and flip its roadmap slice to done. |
| **rs-test-plan** | `prd.md`, `roadmap.md`, archive, tech-stack, git churn | `context/foundation/test-plan.md` | Risk-driven, phased test rollout; a stateful QA orchestrator that drives each phase through the change chain. Runs alongside the build chain. |

## Two ways to start

The chain has two entry points — pick by the size of what you're doing. For
ordering *across time* — successive ideas on one repo, re-running a skill, the
foundational-vs-per-change split — see
[ORDERING-AND-CASES.md](./ORDERING-AND-CASES.md).

**1. New project / big picture** — when you're shaping *what* to build:

```
rs-init → rs-discovery → rs-prd → rs-roadmap → rs-plan → rs-implement → rs-impl_review → rs-archive
```

**2. A single change to an existing project** — when the goal is already clear
and you just need to build one thing. Skip discovery entirely:

```
rs-change <id> → [rs-research] → [rs-frame] → rs-plan → rs-implement → rs-impl_review → rs-archive
```

Notes on the light path:

- `rs-change`, `rs-research`, and `rs-frame` are **independent of** `rs-discovery` /
  `rs-prd` / `rs-roadmap` — they read none of those artifacts.
- The only prerequisite for `rs-change` is that `context/changes/` exists — run
  `rs-init` once (or just create the dir). `rs-change` will not create its parent.
- For a quick change you can **skip `rs-change` too** and start straight at
  `rs-plan <id>` — it creates the change folder and `change.md` itself (at status
  `planned`, bypassing `new`).
- For a trivial cosmetic/frontend tweak, `rs-discovery`'s scope-triage bails out and
  `rs-plan` runs in its TRIVIAL tier (0–2 questions) — or just edit the file
  directly.
- `rs-archive` closes a matching roadmap slice if a roadmap exists; with no
  roadmap it simply skips that step (non-blocking).
- If code already landed **without** a plan (a hotfix, or a PR that skipped
  `rs-plan`), `rs-change-from-pr` reconstructs an as-built `change.md` + `plan.md`
  from the diff so the SDD trail exists — `rs-impl_review` runs it automatically
  when the change under review has no record.

## On-disk layout

```
context/
├── foundation/
│   ├── tech-stack.md        ← rs-init
│   ├── roadmap.md           ← rs-roadmap
│   └── test-plan.md         ← rs-test-plan
├── discovery/
│   ├── discovery-notes.md   ← rs-discovery
│   ├── glossary.md          ← rs-discovery (ubiquitous language)
│   └── decisions/0001-*.md  ← rs-discovery (ADRs)
├── prd/
│   └── prd.md               ← rs-prd
├── changes/
│   └── <change-id>/
│       ├── change.md        ← rs-change / rs-frame / rs-research / rs-plan / rs-implement / rs-change-from-pr / rs-archive (status lifecycle)
│       ├── research.md      ← rs-research (optional)
│       ├── frame.md         ← rs-frame (optional)
│       ├── plan.md          ← rs-plan (incl. the canonical ## Progress); or rs-change-from-pr (as-built, when planning was skipped)
│       ├── plan-brief.md    ← rs-plan
│       └── reviews/         ← rs-impl_review
└── archive/                 ← rs-archive (read-only)
```

## Status lifecycle (`change.md`)

```
new ──▶ preparing ──────▶ planned ──▶ implementing ──▶ implemented ──▶ impl_reviewed ──▶ archived
rs-change rs-frame /        rs-plan     rs-implement      rs-implement     rs-impl_review     rs-archive
         rs-research
```

`new` and `preparing` only appear when the optional rs-change / rs-frame /
rs-research front-matter steps are used; otherwise rs-plan creates the change
folder directly at `planned`.

The matching roadmap slice flips to `done` when its change is archived.

## Principles shared across the chain

- **Stack-open PRD.** The PRD describes the product, not its architecture; the
  stack lives in `tech-stack.md`. A technical-leak lint keeps technology out of
  the PRD.
- **Facilitator, not generator.** Discovery never invents domain content; the PRD
  routes gaps to Open Questions; the roadmap never invents slices.
- **One `## Progress` source of truth.** Defined once in
  `rs-plan/references/progress-format.md`; only `rs-implement` mutates it.
- **No auto-chaining.** Every skill ends by announcing the next step; the user
  runs it when ready.

## Conventions for reference docs

Each skill owns its contract under `references/`:

- `rs-discovery/references/` — discovery-notes template, glossary format, ADR format.
- `rs-prd/references/prd-schema.md` — the PRD contract.
- `rs-roadmap/references/roadmap-template.md` — the roadmap contract.
- `rs-plan/references/` — plan template + the shared `progress-format.md`.
- `rs-init/references/` — the tech palette + tech-stack template.

## Alongside the build chain

- **rs-test-plan** — a durable QA-strategy artifact (risk map + phased test
  rollout) plus a stateful orchestrator that drives each test-risk phase through
  `rs-plan → rs-implement → rs-impl_review → rs-archive`. Runs after `rs-prd` and
  `rs-roadmap`, once there is a product with code to test.

## Optional per-change front-matter

Before planning a change, three optional steps can enrich it; `rs-plan` (and
`rs-test-plan`'s rollout) scale their questioning down when these artifacts exist:

- **rs-change** — open a change folder with a `change.md` identity file.
- **rs-research** — parallel-subagent codebase research → `research.md`.
- **rs-frame** — challenge the framing (separate observation from cause) →
  `frame.md`. Use before planning a bug or a scope/design question.
