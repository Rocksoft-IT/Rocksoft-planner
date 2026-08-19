---
name: rs-change-from-pr
description: >
  Reconstruct an AS-BUILT change record under context/changes/<change-id>/ from
  work that already exists — a pull request or a local diff — when the planning
  step was skipped. The reverse of rs-plan: instead of writing a plan before the
  code, it reads the code (the diff/commits) plus the linked issue/PR and writes
  a change.md (status: implemented) and an as-built plan.md so the spec-driven
  trail exists for rs-impl_review and rs-archive. Use when a PR has no
  context/changes/<id>/ folder (e.g. it skipped "Plan a Slice"), or to backfill
  the SDD record for a hotfix merged directly. Trigger phrases: "backfill the
  change", "no plan for this PR", "reconstruct the change record", "create
  context from this PR", "as-built record".
argument-hint: "<change-id> [--pr N | --range <base>..<head>]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - Edit
  - Bash
  - AskUserQuestion
---

# rs-change-from-pr: Reconstruct an as-built change record

The catch-up step for spec-driven development. When code lands **without** going
through `rs-plan` — a PR that skipped "Plan a Slice", a hotfix merged straight to
main — there is no `context/changes/<change-id>/` folder, so:

- there is no SDD record of *what* was built and *why*,
- `rs-impl_review` has no plan to review against,
- `rs-archive` has nothing to archive (the matching roadmap slice never closes).

This skill closes that gap. It is the **inverse of `rs-plan`**: it reads the work
that already exists (the diff + commits) plus any linked issue/PR, and writes an
**as-built** `change.md` + `plan.md`. It does **not** write code and it does
**not** review — it only records what is already there so the rest of the chain
has something to stand on.

> **As-built ≠ forward plan.** The plan it writes is reconstructed *from the
> code*, so it cannot meaningfully detect drift (the spec and the code agree by
> construction). Its value is the SDD record, not drift detection — the real
> quality gate is still `rs-impl_review` against the **issue's acceptance
> criteria**.

## Inputs

- **A change-id** — explicit argument, or derived (see *Change-id resolution*).
- **The work** — the diff that represents the change. Either a PR (`--pr N` →
  `gh pr diff N`, `gh pr view N`) or a local commit range (`--range
  base..head`, default `origin/main...HEAD`). Read the diff and the commit
  subjects; do **not** load every changed file into context — sample what you
  need.
- **The linked issue / PR body** *(if any)* — for the title, scope, and the
  **acceptance criteria** that become the as-built success criteria.
- **`context/foundation/roadmap.md`** *(if present)* — to map the work to a
  roadmap slice and reuse that slice's `Change ID` (so `rs-archive` can close
  the slice later).
- **`context/foundation/tech-stack.md`** *(if present)* — to name the real
  test/build commands in the success criteria.

## Outputs / mutations

Writes `context/changes/<change-id>/`:

- **`change.md`** — identity file, `status: implemented` (the code already
  exists), `title` in **English** (translate if the source is another language,
  per `rs-change`). The `## Notes` body records provenance verbatim, e.g.
  `Backfilled from PR #41 (branch feat/foo) — as-built record; planning step was
  skipped. No forward plan.`
- **`plan.md`** — an **as-built** plan in the `rs-plan` shape
  (`../rs-plan/references/plan-template.md`), with an
  `<!-- AS-BUILT: reconstructed from PR/diff; not a forward plan -->` marker
  under the title. Phases describe what the diff actually did (one phase per
  natural grouping of the commits, or a single "As-built" phase for a small
  diff). `## Progress` lists the success criteria per
  `../rs-plan/references/progress-format.md`.

It does **not** write code, run a review, push, or open a PR. Committing/pushing
the new folder is the caller's job (interactive: the user; in Koda: the
code-review workflow commits it to the PR head branch).

## Change-id resolution (first match wins)

1. **Explicit argument** → use it (after kebab-case + uniqueness validation).
2. **Already recorded** — the diff already contains `context/changes/<id>/`, or
   the PR body has a `Change: <id>` line → that folder already exists; this skill
   is a **no-op**, print `NO_ACTION_NEEDED — change record already exists at
   context/changes/<id>/` and STOP.
3. **Roadmap slice** — the issue/PR title carries a slice tag (`[S-NN]` /
   `[F-NN]`), or the work clearly maps to one roadmap slice → reuse that slice's
   `Change ID` from `roadmap.md`'s `## Backlog Handoff` table. **Preferred** —
   keeps the backfilled folder aligned with the slice so `rs-archive` closes it.
4. **Linked issue** → `issue-<n>` or a kebab-case slug of the issue title.
5. **Branch / PR title** → kebab-case slug of the head branch name or PR title.

Validate the result: kebab-case `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`, and unique
across `context/changes/` and `context/archive/`. If the folder already exists →
no-op (step 2). In an interactive session, confirm a derived id with
`AskUserQuestion` before writing; non-interactively, take the first match and
print it.

## Process

### Step 1: Resolve inputs

Resolve the change-id (above). Resolve the diff source: `--pr N` → `gh pr diff N`
+ `gh pr view N --json title,body,headRefName,baseRefName`; else the range
(default `origin/main...HEAD`). Read the diff, the commit subjects
(`git log --oneline <range>`), and the linked issue body. If there is **no diff
at all** (empty range / no PR), STOP with `error: nothing to reconstruct — no
changes found`.

### Step 2: Read foundations (best-effort)

If they exist, read `roadmap.md` (slice match → Change ID + acceptance criteria),
`tech-stack.md` (real commands), and `context/changes/` / `context/archive/` (to
guarantee uniqueness). None are required — the skill works with just a diff.

### Step 3: Synthesize the as-built record

From the diff + commits + issue:

- **Overview / Desired End State** — what the change delivers, in prose, grounded
  in the actual files touched (cite `path` refs).
- **Phases** — group the commits/files into natural phases (data layer, API, UI,
  …); a small diff is a single `## Phase 1: As-built`. Each phase's *Required
  changes* names the real files and the observable behavior — describe what IS
  there, not what someone might do next.
- **Success criteria** — copy the **issue's acceptance criteria** into
  `#### Automated` / `#### Manual`. With no issue, derive observable checks from
  the diff (e.g. "endpoint returns 200", "new column visible"). Prefer the real
  commands from `tech-stack.md`.
- **What we're NOT doing** — best-effort scope boundary inferred from the diff;
  if unclear, write `<inferred from the diff; verify against the issue>`.

### Step 4: Write the folder

`mkdir -p context/changes/<change-id>/`. Write `change.md` (status
`implemented`, provenance in Notes) and `plan.md` (as-built, with the marker and
the `## Progress` section). Use today's date (`date +%Y-%m-%d`) for `created` /
`updated`.

`## Progress` rows are left **unchecked** (`- [ ]`) on purpose, with a one-line
note above them:

```md
## Progress
<!-- AS-BUILT: criteria left unchecked — rs-impl_review verifies them against the diff. -->

### Phase 1: As-built
#### Automated
- [ ] 1.1 <criterion>
#### Manual
- [ ] 1.2 <criterion>
```

The boxes stay unchecked because this record was reconstructed, not executed —
checking them off would be "blind signing". `rs-impl_review` then verifies each
criterion against the real diff and reports pass/fail.

### Step 5: Hand off

Print a one-line summary (change-id, files written, provenance) and point to the
next step: `rs-impl_review <change-id>` (review the as-built code against the
record you just wrote). End with `Status: ready` on its own line, or
`NO_ACTION_NEEDED` if the folder already existed.

## Critical guardrails

1. **Record, don't build or review.** Writes only `context/changes/<id>/`
   (`change.md` + `plan.md`). Never edits code, never runs a review, never
   pushes or opens a PR.
2. **As-built is honest.** The plan is reconstructed from the code, so its
   `## Progress` boxes stay unchecked and the file carries the `AS-BUILT` marker.
   Do not present it as a forward plan or claim verified criteria.
3. **Idempotent.** If `context/changes/<id>/` (or an `archive/*-<id>/`) already
   exists, it is a no-op (`NO_ACTION_NEEDED`) — never overwrite an existing
   record.
4. **Prefer the roadmap Change ID.** When the work maps to a roadmap slice, reuse
   that slice's `Change ID` so `rs-archive` closes the slice later.
5. **English title.** `change.md` `title` is always English (translate the source
   issue/PR title if needed); `change_id` is English kebab-case. Matches
   `rs-change`.
6. **Status is `implemented`.** The code exists and is about to be reviewed;
   `rs-impl_review` advances it to `impl_reviewed`, `rs-archive` to `archived`.

## Notes

- This is the SDD catch-up step — it exists so a PR that skipped `rs-plan` still
  leaves a `context/changes/<id>/` trail. Normal pipeline PRs (which already have
  a plan on their branch) never reach it: callers check for the folder first and
  only invoke this skill when it is missing.
- The plan shape is owned by `rs-plan`
  (`../rs-plan/references/plan-template.md` + `progress-format.md`); this skill
  conforms to it rather than redefining it.
- Pairs with `rs-impl_review`, which performs the check-and-invoke: if the change
  under review has no `context/changes/<id>/`, it runs this skill first, then
  reviews against the reconstructed record.
