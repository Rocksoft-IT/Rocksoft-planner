---
name: rs-init
description: >
  Initialize a project's context/ directory and declare its tech stack from a
  fixed house palette — replacing an interactive stack-selection step. Idempotently
  scaffolds context/{discovery,prd,foundation}/ with README files, then generates
  context/foundation/tech-stack.md by picking a subset of the preferred-tech
  palette (greenfield) or detecting the stack from the working directory and
  mapping it onto the palette (brownfield). Use at the start of a project, or when
  the user says "init the project", "set up context", "scaffold context",
  "declare the stack", "what's our stack". The PRD stays stack-open; this skill is
  where the stack actually lives.
argument-hint: ""
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
---

# rs-init: Scaffold context/ and declare the tech stack

This skill prepares a project's `context/` workspace and records its tech stack.
It deliberately **replaces** an interactive stack-*selection* step: because the
team works from a known palette of preferred technologies (see
`references/tech-palette.md`), a project does not reason over a global registry —
it picks a subset from the house palette, or has its stack detected and mapped
back onto it.

Two jobs:

1. **Scaffold `context/`** — idempotent skeleton (`discovery/`, `prd/`,
   `foundation/`) with README files, so the discovery → PRD → build chain has a
   home.
2. **Declare the stack** — generate `context/foundation/tech-stack.md` from the
   palette.

The PRD (written by `rs-prd`) stays **stack-open** — it describes the product,
not its architecture. `tech-stack.md` is where the stack lives. The build step
reads both.

## When to use, when to skip

**Use** at the start of a project to set up `context/` and pin the stack, or any
time the stack needs (re)declaring. Safe to re-run — it never overwrites existing
content silently.

**Skip** if `context/` and `tech-stack.md` already exist and are current — a
re-run just reports status. To change the menu itself, edit
`references/tech-palette.md`, not a project file.

## Relationship to other skills

- `rs-shape` → writes `context/discovery/` (discovery-notes, glossary, decisions).
- `rs-prd` → writes `context/prd/prd.md` (stack-open).
- `rs-init` → scaffolds the skeleton and writes `context/foundation/tech-stack.md`.

`rs-init` is the explicit setup entry point; it is not a hard prerequisite —
`rs-shape` and `rs-prd` lazily create their own subfolders. Run `rs-init` when
you like to set the skeleton and stack up front.

## Process

### Step 1: Scaffold the context skeleton (idempotent)

For each of `context/discovery/`, `context/prd/`, `context/foundation/`: if it
exists, note `present`; otherwise `mkdir -p` it and note `created`. Then write a
README into each only if absent (never overwrite). Parent `context/` is created
implicitly.

```bash
for d in context/discovery context/prd context/foundation context/changes; do
  if [ -d "$d" ]; then echo "$d present"; else mkdir -p "$d" && echo "$d created"; fi
done
```

README contents (write only if the file is absent):

- `context/discovery/README.md`:
  ```
  # Discovery
  Shaping artifacts from rs-shape: discovery-notes.md (the shape document),
  glossary.md (ubiquitous language), and decisions/ (ADRs).
  ```
- `context/prd/README.md`:
  ```
  # PRD
  Product Requirements Documents from rs-prd: prd.md (and versioned prd-vN.md).
  Stack-open — describes the product, not its architecture.
  ```
- `context/foundation/README.md`:
  ```
  # Foundation
  Cross-change living documents. tech-stack.md (from rs-init) declares the
  project's stack; roadmap.md (from rs-roadmap) sequences the build. Edit-in-place
  as the project evolves.
  ```
- `context/changes/README.md`:
  ```
  # Changes
  One folder per change at context/changes/<change-id>/, holding change.md plus
  plan.md and plan-brief.md (from rs-plan). A roadmap slice's Change ID becomes a
  change folder here.
  ```

### Step 2: Detect context type

Determine greenfield vs brownfield using the same multi-signal detection as
`rs-shape` (Tier 1 git history, Tier 2 lockfiles, Tier 3 manifests; any Tier 1/2
hit → brownfield; Tier 3 only → brownfield with an ambiguity flag; no signals →
greenfield). This drives how `tech-stack.md` is built. Confirm with the user.

### Step 3: Generate context/foundation/tech-stack.md

First check for an existing file:

```bash
test -f context/foundation/tech-stack.md && echo EXISTS || echo CLEAR
```

If it EXISTS, do not overwrite. Summarize the current stack and offer:
update-in-place (edit specific lines, bump `updated:`) / leave as-is / archive and
regenerate. Then act on the choice.

If CLEAR, read `references/tech-palette.md` and build the file per
`references/tech-stack-template.md`:

**Greenfield — pick a subset from the palette.** Ask the user which palette items
this project uses, one category at a time (frontend framework, styling, backend
language/framework, database, then the per-project axes). Use AskUserQuestion
with options drawn from the palette, presenting the house default first; always
allow "Not sure / decide later" (→ Open Stack Questions). Keep it short — this is
a pick from a known menu, not a deep interview. The per-project axes (database,
Python framework, .NET stack, JS unit runner, deploy target) have house defaults
in the palette — offer the default, let the user confirm or override. Only a
genuinely undecided axis (most often the concrete deploy target) goes to
`## Open Stack Questions` as TODO; never invent a value the user rejected.

**Brownfield — detect from the working directory, then confirm.** Inspect the
project and map findings onto the palette:

```bash
# JS/TS stack
cat package.json 2>/dev/null | grep -E '"(astro|vue|react|next|@unocss|tailwindcss|vitest|playwright|@playwright)"'
ls pnpm-lock.yaml package-lock.json yarn.lock 2>/dev/null
# PHP stack
cat composer.json 2>/dev/null | grep -E '"(laravel/framework|filament/filament|phpunit/phpunit)"'
# Python
ls requirements.txt pyproject.toml 2>/dev/null
# .NET
ls *.csproj *.sln 2>/dev/null
# IaC / CI (match CI to the host)
ls *.tf 2>/dev/null
ls .github/workflows/*.y*ml .gitlab-ci.yml azure-pipelines.yml bitbucket-pipelines.yml 2>/dev/null
# Issue tracker hints (host + local convention)
git remote -v 2>/dev/null | grep -ioE 'github|gitlab|bitbucket' | head -1
ls -d .scratch 2>/dev/null
```

Present the detected stack mapped to palette terms and ask the user to confirm or
correct. Anything detected that is off-palette is recorded with a deviation note.
Unknown axes (e.g. database not evident) go to `## Open Stack Questions`.

Write `context/foundation/tech-stack.md` with `source: picked-from-palette` or
`source: detected-from-cwd` accordingly. Omit whole categories the project does
not use rather than writing "none".

### Step 4: Print summary

```
context/discovery/              [created|present]
context/prd/                    [created|present]
context/foundation/             [created|present]
context/changes/                [created|present]
  READMEs                       [created|present]
context/foundation/tech-stack.md [created|updated|present]

Stack (this project):
  - <one line per chosen component>
Open Stack Questions: <count>   (database / hosting / … if unresolved)
```

STOP. Do not auto-chain to another skill.

## Critical guardrails

1. **Idempotent.** Re-running with everything present is a no-op status print.
   Never overwrite existing content silently — `tech-stack.md` is updated in
   place or archived on request, never clobbered.
2. **Palette is the menu.** Stack choices come from `references/tech-palette.md`.
   Off-palette choices are allowed but recorded as deviations so the palette can
   be reconsidered.
3. **Per-project axes have defaults but get confirmed.** Database, Python
   framework, .NET stack, JS unit runner, and deploy target each have a house
   default in the palette. Offer the default and let the user confirm or
   override. Only a genuinely undecided axis → `## Open Stack Questions`, never a
   value the user rejected.
4. **PRD stays stack-open.** This skill owns the stack; the PRD does not. Keep
   technology out of the PRD — it lives here.
5. **Edit-in-place.** `tech-stack.md` evolves with the project. Bump `updated:`
   on edits; don't create dated copies (archive only on full replacement).

## Notes

- The output is `context/foundation/tech-stack.md` plus the `context/` skeleton.
- `references/tech-palette.md` is the single source of truth for the menu;
  `references/tech-stack-template.md` defines the per-project file shape. Edit the
  palette to change house defaults for all future projects.
