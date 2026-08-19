---
name: rs-prd
description: >
  Generate context/prd/prd.md from a discovery-notes file (or raw notes) against
  the locked PRD schema. Auto-routes to a greenfield (10-section) or brownfield
  (11-section) template based on context_type in the input or cwd auto-detection.
  This is a document GENERATOR, not an interviewer — it synthesizes what was
  already captured during rs-discovery and never invents domain content. Use when the
  user has discovery notes ready and wants a schema-conformant PRD written to
  disk. Trigger phrases: "write the PRD", "generate the PRD", "create a PRD from
  notes", "turn discovery notes into a PRD", "PRD from discovery-notes". Use
  AFTER rs-discovery, not in place of it.
argument-hint: "[path-to-notes-file]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
---

# rs-prd: Generate context/prd/prd.md from discovery notes

This skill is the second link in the discovery chain:
`rs-discovery → rs-prd → build`. Its only job is to take a shaped notes file and
generate `context/prd/prd.md` conforming to the locked PRD schema, routing every
gap to `## Open Questions` instead of inventing content.

It is a **document generator, not a facilitator.** It never invents domain
decisions, business rules, success criteria, or user stories. Anything missing
from the input goes verbatim into `## Open Questions` for a human to resolve. The
grilling already happened in `rs-discovery`; this step is pure synthesis.

The locked schema this skill conforms to lives in `references/prd-schema.md`
(relative to this SKILL.md). Read it before generating anything and re-verify the
generated file against it before writing to disk.

## When to use, when to skip

**Use when** the user has run `rs-discovery` (and
`context/discovery/discovery-notes.md` exists), OR has a raw notes file to turn
into a draft PRD, OR explicitly asks to (re)generate `context/prd/prd.md`.

**Skip when** the user is still forming the idea and has no notes — point them to
`rs-discovery` first. Also skip when they want to hand-edit an existing PRD — this
skill writes whole files; surgical edits are out of scope.

## Relationship to other skills

- `rs-init` — declares the stack up front in `context/foundation/tech-stack.md`.
  The PRD stays stack-open precisely because the stack lives there, not in the
  PRD.
- `rs-discovery` — produces `discovery-notes.md`, `glossary.md`, and ADRs under
  `context/discovery/`. The canonical input. Always preferred before this skill.
- `rs-roadmap` — the next step: consumes `prd.md` (+ `tech-stack.md`) and
  sequences it into vertical slices for `rs-plan`.

## Initial response

When invoked:

1. **If a path argument is given** (e.g. `rs-prd @notes/raw.md` or
   `rs-prd context/discovery/discovery-notes.md`), capture it as the input path.
   Go to Step 1.
2. **If no argument is given**, default the input path to
   `context/discovery/discovery-notes.md` and go to Step 1. Do not ask yet —
   Step 1 handles the missing-input case.

## Process

### Step 1: Locate the input

Resolve the input path (strip a leading `@` if present; otherwise default to
`context/discovery/discovery-notes.md`). Test it:

```bash
test -f "<resolved-path>" && echo FOUND || echo MISSING
```

If found, read it IN FULL (no limit/offset) and go to Step 1.5. Also read
`context/discovery/glossary.md` and list `context/discovery/decisions/` if they
exist — you will use the glossary vocabulary and reference relevant ADRs while
generating.

If missing, ask:

AskUserQuestion:
- question: "No input file found at `<resolved-path>`. How do you want to proceed?"
  header: "Input?"
  options:
  - label: "Run rs-discovery first (Recommended)"
    description: "Stop here. Run rs-discovery to produce discovery-notes.md, then call rs-prd again."
  - label: "Paste raw notes"
    description: "I'll wait for you to paste whatever notes you have. A thin-input check will warn about missing signals."
  - label: "Cancel"
    description: "Exit without changes."
  multiSelect: false

On "Run rs-discovery first": print the redirect and STOP. On "Paste raw notes":
capture the pasted text as in-memory input and go to Step 1.5. On "Cancel": STOP.

### Step 1.5: Determine context type

1. **If the input has `context_type:` in frontmatter** — use it directly; no
   confirmation needed.
2. **If absent** (raw/pasted notes) — auto-detect from cwd using the same
   multi-signal tiers as `rs-discovery` (git history = Tier 1, lockfiles = Tier 2,
   manifests = Tier 3). Any Tier 1/2 hit → propose brownfield; Tier 3 only →
   propose brownfield, flag ambiguity; no signals → propose greenfield. Then
   confirm with the user via AskUserQuestion.

Record the resolved `context_type` for Steps 2 and 3.

### Step 2: Score the input

Score the input 0–4 against the shaped-vs-thin heuristic in
`references/prd-schema.md` (one point each): a `checkpoint:` block in
frontmatter, at least one `FR-NNN` line, at least one Given/When/Then block, and
an explicit one-line business rule under `## Business Logic`. Timeline is NOT a
signal.

Print the scorecard, naming each signal as found or missing:

```
Input score (heuristic, 4 signals, 1 point each):
  [✓|✗] Checkpoint block in frontmatter   — <found|missing>
  [✓|✗] FR-NNN requirements                — <found N FRs|missing>
  [✓|✗] Given/When/Then user stories       — <found|missing>
  [✓|✗] Explicit one-line business rule    — <found|missing>

  Score: <N>/4
```

**Score ≥ 2**: input is shaped enough — go to Step 3 without prompting.

**Score < 2**: trigger a thin-input warning. Name each missing signal with its
one-line consequence (never a generic "your notes are thin"):

```
This input scored <N>/4 on the shape heuristic. Missing signals:

  - <signal name>: <one-line consequence for the generated PRD>

A PRD generated from thin input will have many `# TODO` placeholders and a long
`## Open Questions` section. That's a valid intermediate state, but if you have
time to run rs-discovery first, the resulting PRD will be much stronger.
```

Then offer: run rs-discovery first (stop) / proceed anyway (generate, gaps go to
Open Questions verbatim) / cancel.

### Step 3: Generate the PRD

Re-read `references/prd-schema.md` to confirm the field list and section names
have not changed. Build the PRD content **in memory first** (not on disk yet).

#### 3a. Frontmatter

Fill every required key per the schema, copying from the input where present:

- `project` — from input frontmatter `project:`, else from a `# <Project>` title,
  else `# TODO: project — see Open Questions`.
- `version` — `1` for the first PRD this skill writes (Step 4 may bump it).
- `status` — `draft`. Never promote past draft.
- `created` — today (`Bash: date +%Y-%m-%d`).
- `context_type` — from Step 1.5.
- `product_type`, `target_scale` — copy verbatim if present; else
  `# TODO: <field> — see Open Questions` plus a matching Open Question entry.

Do NOT fill any stack-shaped field (framework, language, deployment, team).
Those belong to the downstream build step. If the input carries them under
`## Forward: tech-stack`, summarize them in the Step 5 hand-off, never in the PRD.

#### 3b. Required sections (in schema order)

Emit exactly the section list for the active `context_type` — 10 headings for
greenfield, 11 for brownfield — in the exact order and spelling from
`references/prd-schema.md`. Do NOT emit `## Data Model`, `## Implementation
Decisions`, `## Testing Strategy`, or `## Deployment & CI/CD` in either mode —
those are not part of the PRD schema; entities and implementation emerge during
the build step.

Per-section content rules:

- **Input has matching content** — transcribe it faithfully. Keep the user's
  wording. Convert formatting only where the schema demands a shape (FR-NNN,
  Given/When/Then, the three Success-Criteria subsections, the `[new|modified|
  removed|preserved]` Scope-of-Change tags). Do not paraphrase, summarize, or
  "improve" the user's words. Use the canonical terms from `glossary.md`.
- **Input has partial content** — transcribe what's there, then add
  `# TODO: <what's missing> — see Open Questions` inside the section and a
  matching numbered entry under `## Open Questions`.
- **Input has no matching content** — emit the heading plus
  `# TODO: <section name> — see Open Questions` and a matching Open Question.

Preserve any `> Challenge:` blockquotes under FRs verbatim. If the input had a
`## Quality cross-check` block (from rs-discovery's soft gate), mirror each gap into
`## Open Questions`. Reference relevant ADRs from `context/discovery/decisions/`
by number and title in the section they bear on (most often brownfield
`## Constraints & Compatibility`).

**Hard rule — never invent.** If the input has no one-line business rule, the
`## Business Logic` / `## Business Logic Changes` section MUST read
`# TODO: domain rule — see Open Questions`, and `## Open Questions` MUST carry
"What is the one-sentence business rule? — TBD by user. Block: yes (PRD is hollow
until resolved)." Do not write a placeholder rule. Do not extrapolate a rule from
entity nouns in the FRs. The same applies to success criteria, user stories, FR
priorities, NFR targets, access control, and non-goals: if it's not in the input,
it goes to Open Questions.

#### 3c. Self-verify before writing

Before any disk write, run a self-verification on the in-memory PRD:

**Structural checks:**

1. Extract every `## ` heading. Compare against the canonical list for the active
   `context_type` (10 greenfield / 11 brownfield). Verify all are present, in
   order, with exact spelling. The PRD must NOT contain a `## Data Model` section.
2. Verify the frontmatter declares all required keys (`project`, `version`,
   `status`, `created`, `context_type`, `product_type`, `target_scale`).
3. Verify `## Success Criteria` has `### Primary` / `### Secondary` /
   `### Guardrails` (or they are TODO-marked with matching Open Questions).

**Technical-leak lint** (enforces stack-openness): scan all `##`-level content
(except brownfield `## Current System Overview`, where naming the existing stack
is allowed) for tokens that mean implementation details leaked in. Treat each hit
as a leak unless it is a verbatim user quote explicitly routed to Open Questions:

- **Vendor / hosted-service names**: Stripe, Auth0, Supabase, Firebase, Vercel,
  Cloudflare, AWS, GCP, Azure, OpenAI, Anthropic, etc. (any product proper noun).
- **Schema / ORM notation**: `(FK)`, `nullable`, `_hash`/`_at` column suffixes
  presented as field lists, `cascade`, `soft-delete`, `migration`, `backfill`.
- **Runtime location**: `client-side`, `server-side`, `on the edge`, `in the
  cache`, `in the worker`.
- **Enforcement mechanism**: `per IP`, `per user-agent`, `token bucket`,
  `rate-limit per <axis>`.
- **UI affordance in NFRs**: `spinner`, `progress bar`, `streaming response`,
  `modal`, `toast`.
- **Transport / protocol**: `WebSocket`, `gRPC`, `GraphQL`, `REST endpoint`,
  `webhook`, `SSE`.
- **Implementation verbs in domain rules**: "the LLM does X", "the library
  decides Y", "the database stores Z" (naming the component that performs the
  rule instead of stating the rule).

If any structural OR lint check fails, **abort the write** and report the
specific failure (missing/out-of-order section, missing frontmatter key, or each
leak with its section and category). Do not silently rewrite. Then STOP — do not
proceed to Step 4. If all checks pass, go to Step 4.

### Step 4: Collision check

```bash
test -f context/prd/prd.md && echo EXISTS || echo CLEAR
```

If clear, create `context/prd/` if needed, write to `context/prd/prd.md`, and go
to Step 5.

If it exists, ask:

AskUserQuestion:
- question: "context/prd/prd.md already exists. How do you want to proceed?"
  header: "Collision"
  options:
  - label: "Save as prd-vN.md (Recommended)"
    description: "Keep history. The new PRD lands in the next prd-vN.md slot; the unversioned prd.md is untouched."
  - label: "Overwrite prd.md"
    description: "Replace the existing prd.md. The previous version is lost unless you committed it."
  - label: "Abort"
    description: "Exit without writing."
  multiSelect: false

On "Save as prd-vN.md": pick `N` by scanning `context/prd/` for `prd-v*.md`
(treat the unversioned `prd.md` as v1); next slot is `(max existing N or 1) + 1`.
Write to `context/prd/prd-vN.md` and set the `version:` frontmatter to `N`. On
"Overwrite": write to `context/prd/prd.md`, keep `version: 1`. On "Abort": STOP.

### Step 5: Hand-off

After writing, summarize:

```
═══════════════════════════════════════════════════════════
  PRD GENERATED
═══════════════════════════════════════════════════════════

  Project:        [project from frontmatter]
  Context type:   [greenfield | brownfield]
  Path:           [context/prd/prd.md | context/prd/prd-vN.md]
  Schema sections:[10/10 | 11/11] present
  Frontmatter:    <K filled, M as TODO>
  Open Questions: <count> entries

  Sections filled from input:
    - <section names with real content>

  Sections marked TODO (see Open Questions):
    - <section names with TODO placeholders>
═══════════════════════════════════════════════════════════
```

If the input carried forward-looking content (tech-stack preferences,
implementation notes), list it briefly so the user knows it is routed onward, not
dropped:

```
  Forward to the build step (not in the PRD):
    • <one line per detected item>
```

Skip that block if there was none. Then point to the next step without invoking
it:

```
► Next: rs-roadmap   — sequence this PRD into vertical slices to build.
```

Then STOP — do not auto-chain. The user reviews the PRD and runs `rs-roadmap`
when ready.

## Critical guardrails

1. **Generator, not author.** Writes whole files from input the user already
   shaped. Never invents business logic, success criteria, user stories, or FR
   priorities. Missing content goes verbatim to `## Open Questions`. The Business
   Logic section is the most guarded: no one-line rule in input → the section
   reads `# TODO: domain rule — see Open Questions`. No exceptions.
2. **The schema is the contract.** `references/prd-schema.md` defines frontmatter
   keys, section names, and order. Re-read it every invocation; re-verify the
   in-memory PRD against it in Step 3c before writing.
3. **Stack-openness is binding.** The technical-leak lint mechanically enforces
   it across seven token categories. Forbidden vocabulary stays in the input's
   `## Forward: tech-stack` block for the build step — never translated into PRD
   frontmatter or sections. Exception: brownfield `## Current System Overview`
   may name the existing stack because it describes reality.
4. **One shared language.** Use the canonical terms from
   `context/discovery/glossary.md` throughout the PRD, and reference relevant
   ADRs from `context/discovery/decisions/` by number — do not copy their bodies.
5. **Collisions favor history.** The collision prompt recommends a versioned save
   over overwrite; a lost previous PRD is irreversible, a duplicate file is not.
6. **Self-verify aborts on drift.** A missing/out-of-order section or missing
   frontmatter key aborts the write with a named failure, rather than a silent
   fix.
7. **Never auto-chain.** The hand-off is an announcement, not an invocation. The
   user decides when to move to the build step, after reviewing the PRD.

## Notes

- This is a **document-generator** skill. The output is `context/prd/prd.md` (or
  `prd-vN.md`), period.
- `references/prd-schema.md` is the single source of truth. Any field or section
  name referenced here MUST exist there — if it doesn't, fix the schema first.
- The thin-input heuristic (Step 2) is deliberately conservative: a false warning
  is recoverable via "proceed anyway"; silent generation from thin input produces
  a hollow, misleading PRD. Tune toward warning more often, not less.
