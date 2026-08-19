# rs-skills — ordering & cases

Companion to the [README](./README.md). The README defines *what each skill is*
and *the happy-path chain*. This file answers the next question people actually
hit: **"I already ran some of these — what do I run now, and what happens if I
re-run one?"** It is about **ordering across time** — one idea, the next idea,
re-runs, and the foundational-vs-per-change split that governs all of it.

## The one rule that resolves most confusion

There are **two tiers of artifact**, and they have **opposite cardinalities**:

| Tier | Artifacts | Cardinality | Written by |
|---|---|---|---|
| **Foundational** | `discovery/`, `prd/prd.md`, `foundation/roadmap.md`, `foundation/tech-stack.md` | **One per repo** (single slot) | `rs-discovery`, `rs-prd`, `rs-roadmap`, `rs-init` |
| **Per-change** | `changes/<change-id>/` (`change.md`, `research.md`, `frame.md`, `plan.md`, `reviews/`) | **One per idea** (unbounded) | `rs-change`, `rs-research`, `rs-frame`, `rs-plan`, `rs-implement`, `rs-impl_review`, `rs-archive` |

> **The repeatable unit of work is a *change*, not *discovery*.**
> `rs-discovery` is foundational — you run it ~once to frame the product. Every
> subsequent idea is a new `context/changes/<change-id>/`, not a new discovery.

Discovery (`context/discovery/`) is a **single slot**. There is no
`discovery/<idea>/` namespacing. Re-running `rs-discovery` does not open a second
idea — it offers to *replace* the existing one (archive + start over). That is a
recovery operation, not the way to handle "the next feature".

## Decide: which entry point

```
                      ┌─ Is this a whole product / big-picture "what should we build"?
   new idea ──────────┤        └─ YES ─▶ rs-init → rs-discovery → rs-prd → rs-roadmap → (then per-slice rs-plan…)
                      │
                      └─ Is it one buildable thing in an existing repo?
                               └─ YES ─▶ rs-change <id> → [rs-research] → [rs-frame] → rs-plan → rs-implement → rs-impl_review → rs-archive
```

Rule of thumb: if you can already name the change in a kebab-case id and one
sentence of intent, you want the **per-change** path — skip discovery entirely.

## Case 1 — Brand-new product, brand-new repo

Fresh/empty directory. Auto-detection sees no git history / lockfile / manifest →
**greenfield**.

```
rs-init → rs-discovery → rs-prd → rs-roadmap → rs-plan → rs-implement → rs-impl_review → rs-archive
```

Run the foundational quartet **once**. From `rs-roadmap` onward you are already in
the multi-idea loop (Case 3) — each roadmap slice is a future change.

## Case 2 — New product, unrelated to the current repo

Don't run it inside an existing repo. **Run it in a fresh directory.**

- Auto-detection is **repo-wide, not idea-scoped**. Inside a repo with git
  history it will propose **brownfield** even though your idea is new, and start
  exploring the existing codebase as if you were changing it.
- The foundational slot would collide with the existing product's discovery.

Fresh dir → clean greenfield → Case 1.

## Case 3 — Successive ideas / features on the *same* repo  ← the common one

You already have `discovery/` + `prd/` + `roadmap.md`. For each next idea, **do
not re-run `rs-discovery`.** Open a change:

```
rs-change <change-id> → [rs-research] → [rs-frame] → rs-plan <change-id> → rs-implement → rs-impl_review → rs-archive
```

- Each idea = its own `context/changes/<change-id>/` (kebab-case, unique across
  `changes/` and `archive/`). Fully isolated; no slot collision.
- `rs-change` / `rs-research` / `rs-frame` **read none of** the foundational
  artifacts — they are independent front-matter. Use them or skip them.
- You can **skip `rs-change`** and start at `rs-plan <change-id>` — it creates the
  folder and `change.md` itself (entering at status `planned`).
- For a trivial cosmetic tweak, just edit the file (or `rs-plan` in its TRIVIAL
  tier). `rs-discovery`'s scope-triage will actively *refuse* full discovery for
  small/localized work and route you here.

### The roadmap already *is* your multi-idea queue

`rs-roadmap` exists precisely so one product fans out into many changes. Each
slice carries a **Change ID**; that id becomes the change folder:

```
rs-roadmap (once) ──▶ slice S-01 (Change ID: a) ─▶ rs-plan a → rs-implement → rs-archive
                  ├──▶ slice S-02 (Change ID: b) ─▶ rs-plan b → rs-implement → rs-archive
                  └──▶ slice S-03 (Change ID: c) ─▶ rs-plan c → rs-implement → rs-archive
```

Archiving a change flips its matching roadmap slice to `done`. So "next idea on
this repo" is usually just **"pick the next roadmap slice and `rs-plan` it"** —
no foundational skill re-runs at all.

## Case 4 — You re-ran `rs-discovery` (resume vs start-over)

`rs-discovery` Step 0.5 checks for `context/discovery/discovery-notes.md`:

- **FRESH** (no file) → normal first run.
- **RESUME** (file exists) → it will **not silently overwrite**. It parses the
  `checkpoint:` frontmatter and asks:
  - **Resume from the next phase** *(default)* — continues; completed phases are
    summarized one line each, **never re-run**. (`context_type` is locked from the
    prior session — no re-detection.)
  - **Start over** — archives `discovery-notes.md` to
    `context/discovery/archive/discovery-notes-<timestamp>.md`, then begins fresh.
  - **Cancel** — exits, no changes.

> ⚠️ **"Start over" archives only `discovery-notes.md`.** `glossary.md` and
> `decisions/` (ADRs) are left in place. If the new idea is *unrelated* to the
> old one, those leftovers will bleed into it. **Manually move `glossary.md` and
> `decisions/` into `context/discovery/archive/` first.** The skill is silent on
> this — it is a known gap.

Bottom line: "Start over" is for *correcting/replacing* the product's discovery,
not for adding the next feature. For the next feature, use Case 3.

## Case 5 — A big new direction inside an existing repo

A new module large enough to deserve its own discovery phase (won't fit the
existing roadmap). Two honest options, in order of preference:

1. **Extend the foundation, don't replace it.** Re-run `rs-prd` / `rs-roadmap` to
   add new slices for the new direction, then iterate Case 3. The existing
   discovery stays valid as product context.
2. **Replace discovery** only if the product framing itself changed. Then it's
   Case 4 "Start over" — and remember to archive `glossary.md` + `decisions/`
   yourself.

If the new direction is really a *separate product*, treat it as Case 2 (fresh
dir), not a second slot in this repo.

## Quick reference

| You have… | You want… | Run |
|---|---|---|
| Nothing, empty dir | A new product | `rs-init → rs-discovery → rs-prd → rs-roadmap`, then per-slice `rs-plan…` |
| Existing repo, no rs-skills context | One known change | `rs-change <id>` (or straight to `rs-plan <id>`) → `rs-implement` → … |
| Foundation done, roadmap with slices | Next idea | Pick a slice → `rs-plan <change-id>` → `rs-implement` → `rs-archive` |
| Foundation done, idea **not** in roadmap | Next idea | `rs-change <change-id>` → `[rs-research]` → `[rs-frame]` → `rs-plan` → … |
| Discovery exists, re-ran `rs-discovery` by accident | Keep going | Choose **Resume** (default) — completed phases aren't re-run |
| Discovery exists, product framing changed | Redo discovery | `rs-discovery` → **Start over**; first move `glossary.md` + `decisions/` to archive |
| A separate, unrelated product | A new product | New directory → Case 1 |

## Anti-patterns

- ❌ Re-running `rs-discovery` for every feature. It is foundational and single-slot;
  you'll thrash the one discovery folder. Use `rs-change` per idea.
- ❌ Running `rs-discovery` for a new product *inside* an existing repo expecting
  greenfield. Detection will say brownfield. Use a fresh directory.
- ❌ Assuming "Start over" wipes the old idea cleanly. It leaves `glossary.md`
  and ADRs behind — archive them by hand.
- ❌ Reaching for foundational skills when the roadmap already has the slice.
  "Next idea" is usually just the next `rs-plan <change-id>`.

## See also

- [README](./README.md) — the chain, the on-disk layout, the status lifecycle.
- `rs-discovery/SKILL.md` Step 0 (scope triage) and Step 0.5 (resume detection).
- `rs-roadmap/references/roadmap-template.md` — the slice ↔ Change ID mapping.
- `rs-change/SKILL.md` — change-id rules and the per-change folder contract.
