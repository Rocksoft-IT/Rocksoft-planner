---
name: rs-discovery
description: >
  Run a structured discovery conversation that turns a raw idea — greenfield or
  brownfield — into a small set of shared-context artifacts under
  context/discovery/. Auto-detects context type from project markers in the
  working directory (brownfield) or their absence (greenfield) and adapts the
  discovery phases accordingly. For brownfield, explores the codebase before
  asking. Captures ubiquitous language inline as a glossary and records
  hard-to-reverse decisions as ADRs. Use when starting a new project from
  scratch OR shaping a meaningful change to an existing system (new module,
  significant feature, architectural improvement). Trigger phrases: "new
  project", "from scratch", "starting an app", "shape an idea", "discovery
  session", "grill me on this", "greenfield", "existing project", "brownfield",
  "add a feature to my app".
argument-hint: "[freeform idea or @path/to/notes.md]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
---

# rs-discovery: Discovery conversation for greenfield and brownfield

This skill turns "I have an idea" (greenfield) or "I want to change this system"
(brownfield) into a small, durable set of context artifacts a team — human or
agent — can build on. It is a **facilitator and an interviewer**, not a content
generator. It never writes vision, requirements, or domain rules the user did
not say. Its value is in the shape and order of the questions, not in the
answers it volunteers.

It blends two complementary approaches:

- **Phased, gated discovery** (greenfield/brownfield detection, scope discipline,
  named anti-patterns, a soft quality gate, resumable checkpoints).
- **Relentless one-at-a-time grilling** with codebase exploration, ubiquitous
  language captured inline, and architecture decisions recorded only when they
  matter.

## Output artifacts

Everything this skill writes lives under a single folder so it is easy to find
later while working on the project:

```
context/discovery/
├── discovery-notes.md        ← the main shape document (vision, persona,
│                               success criteria, FRs, constraints, non-goals)
├── glossary.md               ← ubiquitous language: the project's shared terms
└── decisions/
    ├── 0001-<slug>.md        ← ADRs: hard-to-reverse, surprising trade-offs
    └── 0002-<slug>.md
```

The structure of `discovery-notes.md` is defined in
`references/discovery-notes-template.md` (relative to this SKILL.md). Read it
before writing the first artifact and re-check it at every checkpoint. The
`glossary.md` and ADR formats live in `references/glossary-format.md` and
`references/adr-format.md`.

## When to use, when to skip

**Use when** the user describes a new project idea (greenfield), OR a significant
piece of work on an existing system (brownfield) — a new module, a major feature,
an architectural change, a scaling or hardening effort on a large, mature
codebase — or wants to stress-test a plan before building. Existing and large
projects are a first-class case, not an afterthought: the skill shapes
substantial work, it does not push everything down to a minimal MVP. Also use
when an existing `context/discovery/discovery-notes.md` is incomplete and needs
resuming.

**Skip when** the change is a single bug, a quick refactor, a styling/cosmetic
tweak (colors, spacing, copy), a single-component frontend adjustment, or any
small, localized change that needs no discovery — just make the change. This
skill is for work whose shape is not yet clear and where misalignment would be
expensive. The scope-triage gate below enforces this so the skill bails out
instead of asking a wall of questions.

## Core principles (read before running)

1. **Facilitator, not generator.** Never write domain content the user did not
   say. If a section needs a value the user has not given, ask — do not invent.
   The only exception is mechanical formatting (FR numbering, section headers,
   frontmatter skeleton).
2. **One question at a time.** Walk down each branch of the decision tree,
   resolving dependencies one by one. Wait for the answer before the next
   question. Do not dump a wall of questions.
3. **Recommended answer first, plus an escape hatch.** For every decision,
   provide your recommended option, label it "(Recommended)", and place it
   first. Always include a "Not sure / let's come back to this" option so the
   user is never forced to guess.
4. **Explore the codebase instead of asking.** If a question can be answered by
   reading the code (brownfield) — current auth, existing modules, data shapes,
   naming — read it and confirm, rather than making the user recite it.
5. **Capture ubiquitous language inline.** When a term is resolved or a vague
   word is sharpened, write it to `glossary.md` immediately. Do not batch.
6. **Challenge, don't rubber-stamp.** When the user is fuzzy ("everyone",
   "always", "lots of pain"), push back with one sharp question: "What would
   have to be true for this to be the wrong thing to build?" or "Who exactly did
   you watch hit this in the last month?"
7. **Stay stack-open.** Never ask for, recommend, or commit to a framework,
   database, language family, or hosting platform. Discovery captures
   product-level priorities only. If the user volunteers stack opinions, park
   them under a `## Forward: tech-stack` block in the notes — not in the
   product sections.
8. **Record decisions sparingly.** Offer an ADR only when a decision is
   hard to reverse, surprising without context, AND the result of a real
   trade-off. If any of the three is missing, skip it.
9. **Name anti-patterns specifically.** When you spot an empty-CRUD product or
   an oversized first slice, name the exact missing rule or the exact expensive
   element — never a generic "your idea has gaps".

## Initial response

When this skill is invoked:

1. **If a freeform idea is given as an argument** (e.g. `rs-discovery a recipe app
   that suggests meals from what's in your fridge`), record it verbatim as the
   **initial idea**. Do not paraphrase. Go to Step 0.
2. **If a file path is given** (e.g. `rs-discovery @notes/idea.md`), read it in full
   and use its contents as the initial idea. Go to Step 0.
3. **If nothing is given**, respond:

```
I'll help you shape an idea into a small set of shared-context documents —
whether you're starting from scratch (greenfield) or changing an existing
system (brownfield).

Please share:
1. The initial idea — what do you want to build or change, in your own words?
2. (Optional) Any rough notes, sketches, or links I should read first.

Tip: pass the idea inline — `rs-discovery a recipe app that uses what's in your
fridge` — or for brownfield — `rs-discovery add a recommendation engine to my
recipe app`.
```

Then wait.

## Process

### Step 0: Scope triage — run this FIRST, before anything else

Judge the size of the request before touching discovery. rs-discovery is for shaping
a new project or a *meaningful* change (a new module, a significant feature, an
architectural change). It is the wrong tool for a small, localized tweak, and its
six phases would only generate noise.

If the request is small / cosmetic / localized — e.g. changing colors, spacing,
copy, or styling; tweaking a single component; a small frontend adjustment; a
quick bugfix — do NOT run discovery. Say so and route to the lighter path, then
STOP:

```
This looks like a small, localized change — shaping it through full discovery
would be overkill. For a change this size, skip straight to:
  • rs-change <change-id> → rs-plan <change-id>   — a tracked change with a quick plan
  • a direct edit                              — for a truly trivial tweak (e.g. one color value)
```

When the size is genuinely ambiguous, ask exactly ONE question first: "Is this a
small, localized change, or a new project / meaningful feature?" — and route
accordingly. Only continue to Step 0.5 when the request is a new project or a
meaningful change, or the user explicitly insists on full discovery anyway.

### Step 0.5: Set up the discovery folder and detect resume

Check whether a previous session exists:

```bash
test -f context/discovery/discovery-notes.md && echo "RESUME" || echo "FRESH"
```

If `FRESH`, create the folder when you first write to it (lazily — do not create
empty files) and go to Step 1.

If `RESUME`, read `discovery-notes.md` in full. Parse the `checkpoint:`
frontmatter block per `references/discovery-notes-template.md`. Summarize what
you found (project, current phase, phases completed, FRs drafted, quality-check
status) and ask:

AskUserQuestion:
- question: "Found a previous discovery session. How do you want to proceed?"
  header: "Resume?"
  options:
  - label: "Resume from the next phase (Recommended)"
    description: "Continue where the last session left off. Completed phases are summarized in one line each, not re-run."
  - label: "Start over"
    description: "Archive the existing notes to context/discovery/archive/ and begin a fresh session."
  - label: "Cancel"
    description: "Exit without changes."
  multiSelect: false

On "Resume": jump to the next unfinished phase. Do NOT re-run completed phases —
summarize each in one or two sentences so the user has context for what is
already settled. On "Start over": move the existing file to
`context/discovery/archive/discovery-notes-<YYYY-MM-DD-HHMM>.md`, then go to
Step 1. On "Cancel": STOP.

### Step 1: Detect context type (greenfield vs brownfield)

Detection happens once; the result (`context_type`) is written to the
discovery-notes frontmatter and drives phase behavior for the rest of the
session. On resume, if `context_type` is already set, skip detection — it is
locked from the previous session.

Evaluate the working directory in three signal tiers. A single manifest file is
not enough — an empty `npm init -y` directory should not trigger brownfield.

```bash
# Tier 1 (strong): version control with history
git log --oneline -1 2>/dev/null && echo "T1:git-history"

# Tier 2 (medium): lockfiles prove real dependency resolution happened
ls package-lock.json yarn.lock pnpm-lock.yaml Cargo.lock poetry.lock go.sum \
   Gemfile.lock composer.lock 2>/dev/null | while read f; do echo "T2:$f"; done

# Tier 3 (weak): manifest files alone — could be a fresh init
ls package.json Cargo.toml pyproject.toml go.mod Gemfile composer.json \
   2>/dev/null | while read f; do echo "T3:$f"; done

# Confirming signals (do not trigger on their own): source dirs, CI, configs
ls -d src/ app/ lib/ .github/ Dockerfile tsconfig.json 2>/dev/null \
   | while read f; do echo "B:$f"; done
```

```powershell
# PowerShell (Windows) — use this block instead of the bash block on Windows.
# Do NOT let a bash->PowerShell translator rewrite the bash loop: the pattern
# `while read f; do echo "B:$f"` produces the literal string "B:$f", which
# Windows reads as a drive `B:` and prompts for a non-existent drive.
if (git log --oneline -1 2>$null) { "T1:git-history" }
@('package-lock.json','yarn.lock','pnpm-lock.yaml','Cargo.lock','poetry.lock',
  'go.sum','Gemfile.lock','composer.lock') |
  Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object { "T2:$_" }
@('package.json','Cargo.toml','pyproject.toml','go.mod','Gemfile',
  'composer.json') |
  Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object { "T3:$_" }
@('src','app','lib','.github','Dockerfile','tsconfig.json') |
  Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object { "B:$_" }
```

Decision logic:
- **Any Tier 1 or Tier 2 hit** → propose `brownfield`.
- **Tier 3 only** (manifest, no lockfile, no git) → propose brownfield but flag
  the ambiguity: "I found a manifest but no lockfile or git history — this might
  be a freshly initialized project rather than a real brownfield."
- **No signals** → propose `greenfield`.

Print what you detected in plain language, then confirm:

AskUserQuestion:
- question: "Detected context: [greenfield|brownfield]. Is that right?"
  header: "Context"
  options:
  - label: "[Greenfield|Brownfield] — correct (Recommended)"
    description: "[one-line description of the auto-detected mode]"
  - label: "[Other mode] — override"
    description: "Switch to the other mode instead."
  multiSelect: false

Write the confirmed `context_type` to the discovery-notes frontmatter
immediately.

### Step 1b: Explore the codebase first (brownfield only)

Before interviewing, build your own map of what exists so you grill from
knowledge, not ignorance. Skip this entirely for greenfield.

- Read any existing `CONTEXT.md`, `README.md`, `docs/adr/`, or
  `context/discovery/glossary.md` for prior domain language and decisions.
- Map the relevant modules, their public interfaces, and who calls them. Use the
  project's existing vocabulary.
- Note the current auth model, data shapes, and integration points in the area
  the change touches.

Summarize the map back to the user in a short paragraph and ask them to correct
anything you got wrong. From here on, **prefer reading the code over asking the
user to recite it** — only ask about intent, not facts you can verify.

### The discovery loop (applies to every phase below)

Every phase runs the same loop. Internalize it; the per-phase sections say *what*
to ask, not *how*.

1. **Open the phase** with one sentence on what it produces, and one open
   question to draw out the user's first attempt.
2. **Grill one question at a time.** When the first answer is fuzzy or hides a
   fork, ask the next sharpest question. If the answer lives in the code, read
   the code instead of asking.
3. **Surface gray areas as a decision** using AskUserQuestion when several real
   options exist. Each option is a real position with a trade-off, never a
   placeholder. Recommended first; "Not sure" last.
4. **Capture glossary terms** the moment a name is sharpened — write to
   `glossary.md` inline.
5. **Lock the decision back** to the user in a one-line confirmation before
   writing it to disk.
6. **Write the phase sections** to `discovery-notes.md` and advance
   `checkpoint.current_phase` / `checkpoint.phases_completed`.

### Step 2 — Phase 1: Problem & persona

Produces `## Vision & Problem` and `## User & Persona`. Brownfield also produces
`## Current System`.

**Greenfield.** Open with: "Let's start with the pain. In a sentence or two —
who feels it, at what moment, and what does it cost them today?" Reflect back the
four parts separately (pain / person / moment / cost today). If any is vague
("everyone", "always"), challenge it: "Who specifically did you watch hit this
last month?" Then surface gray areas: pain category, the insight the user has
that the status quo lacks ("if it's obvious, why hasn't it been built?"), and
the precise scope of the primary persona (name a role, not "users").

**Brownfield.** Open with: "Let's start with the current system. In a few
sentences — what exists today, who uses it, and what pain or gap is driving this
change?" Reflect back: current system, tech stack mentioned, users (named
roles), pain/gap, and **what must be preserved** (what cannot break). If the
user can't pin down "must be preserved", challenge: "If this change broke
something tomorrow, what would alert you first?" Write `## Current System`
first (drawing on your Step 1b map), then `## Vision & Problem` framed as a
delta (what changes and why), then `## User & Persona`.

### Step 3 — Phase 2: Access & roles

Produces `## Access Control`. The persona was captured in Phase 1; here we ask
how they reach the product.

**Greenfield.** "How does this person get into the app — login, local profile,
access key, or no auth at all?" Offer the common forms with a recommendation,
then one follow-up on role separation (flat user model vs. roles like
admin/member/guest). Socratic: "What's the smallest access model that still
makes the first release useful?"

**Brownfield.** Read the current auth from the code if you can, then confirm:
"Here's the auth model I see — is that right?" Then ask only what *changes*:
does the auth model change in this work? Are new roles added or existing role
boundaries moving? If nothing changes, write the current model with the note
"No change planned — existing model preserved."

### Step 4 — Phase 3: First increment & success criteria

Produces `## Success Criteria` (Primary / Secondary / Guardrails). The aim is the
first increment that ships **end-to-end and delivers real value** — which may be
substantial. This is incremental-delivery discipline, NOT a push toward a minimal
MVP; an ambitious first increment is entirely valid for a serious or large
project.

**Greenfield.** "Sketch the first end-to-end flow that delivers real value and
proves the approach works. Walk me through it." Reflect it back as a numbered
sequence. Then apply **scope awareness** — judged by size and complexity, not
time: if the flow needs many integrations / external services / custom
infrastructure before anything works end-to-end, name the cost and the expensive
element so the user can choose deliberately:

```
This first increment is sizeable. For an ambitious or large product that can be
the right call — but front-loading a lot of work before anything runs end-to-end
risks stalling. If you'd rather de-risk first, common moves:

  - Defer [the identified expensive element] to a later increment.
  - Replace [the identified integration] with a manual/hardcoded version for now.
  - Narrow the first increment to one user/role, then expand.
```

Offer the choice (de-risk with a smaller first increment / keep the full scope,
consciously / re-sketch). The goal is a deliberate, informed choice — keeping a
large first increment is valid; the skill does not steer toward a minimal MVP.

**Brownfield.** "Describe the first end-to-end increment of this change that
delivers value and proves it works in the real system — this can be a substantial
feature, not a token slice. What does the user do differently once it ships?"
Reflect as a delta sequence. Then ask the **blast radius** question ("which
existing features, integrations, or data flows could break?") and apply the same
size/complexity scope awareness. The brownfield trap is starting a big change and
leaving it half-done — partially modified code is worse than the original — so
the aim is an increment that ships end-to-end, whatever its size.

**Both.** Capture the working flow as the `### Primary` success criterion, then
ask for one `### Secondary` (a nice-to-have) and one or two `### Guardrails`
(things that must not break — privacy, minimum performance, UX). For brownfield,
guardrails must explicitly include the existing behavior that must be preserved.

### Step 5 — Phase 4: Functional requirements & grilling

Produces `## Functional Requirements` and `## User Stories`.

**Greenfield.** "From the first-increment flow, what must the actor be *able* to do? List
the capabilities — I'll format them as FRs." Capture each as:

```
- FR-NNN: [Actor] can [capability]. Priority: must-have | nice-to-have
  - **Acceptance:** <one observable test — what proves this works end-to-end>
```

`NNN` is a zero-padded three-digit number starting at `001`. Default
`must-have` for everything in the first-increment flow; ask explicitly if anything is
nice-to-have.

For every FR, ask: **"How would a developer know this works?"** Capture the
answer verbatim as the `**Acceptance:**` line. If the user's answer is vague
("it just works", "tests pass"), push back once: "What specific action would
you take to verify it — in a browser, in a terminal, in a log?"

**Brownfield.** Add a change tag:

```
- FR-NNN: [Actor] can [capability]. Priority: must-have | nice-to-have. Change: new | modified | preserved
  - **Acceptance:** <one observable test — what proves this works end-to-end>
```

`preserved` FRs are defensive — they explicitly flag existing behavior that must
keep working. Prompt the user: "Which existing capabilities must explicitly
survive this change?" Flagging preservation prevents accidental breakage. For
`preserved` FRs, the acceptance line should describe the regression test: what
would you check to confirm nothing broke?

**Dependencies.** After all FRs are drafted, ask once: "Are there FRs that
can't start until another is complete?" Capture any ordering constraints as a
`## Dependencies` section immediately after `## Functional Requirements`:

```
## Dependencies
- FR-NNN blocked-by FR-MMM
- FR-NNN blocked-by FR-PPP, FR-QQQ
```

Only record FR-to-FR prerequisite relationships — not implementation tasks or
external services. Skip the section if there are no dependencies.

**Both.** Group thematically with `###` subheadings if there are more than ~6
FRs. Then ask the user to translate at least the main flow into a `### US-01`
user story with Given/When/Then. Update `checkpoint.frs-drafted`.

**Then run one Socratic challenge round** — exactly one challenge per FR, in
document order. For each FR, ask what would have to be true for delivering it to
*hurt* the product, or the strongest counterargument to including it in this scope.
Offer 2–4 plausible, domain-specific counterarguments via AskUserQuestion, with
"No counterargument; keep as written" as the LAST option (so the user must
consider the challenge before dismissing it). Capture each answer as a
`> Challenge:` quote block under its FR. If a challenge changes an FR (split,
downgrade, remove), update the line in place.

### Step 6 — Phase 5: Business logic & constraints

Produces `## Business Logic` and `## Non-Functional Requirements`. Brownfield
also produces `## Constraints & Preserved Behavior`. Entities and fields are
deliberately NOT captured as a separate section — they emerge from the FRs and
stories and get pinned down later during implementation planning.

**Greenfield.** "State the one business rule — the domain decision your app
makes — that sets it apart from a generic CRUD list, in a single sentence."
Capture it as the first line of `## Business Logic`, then ≤3 paragraphs on the
user-visible inputs it consumes, its output, and how the user meets it in the
flow. Do NOT name components or actors that perform the computation — those are
later architectural choices.

**Empty-CRUD anti-pattern detection.** If the "business logic" reduces to "users
can add, view, update, and delete records" with no rule the app itself applies,
name it:

```
What you've described is a CRUD list — a known greenfield anti-pattern. CRUD
with no domain decision means the app delivers nothing a spreadsheet couldn't.
A real domain rule answers "what does the app decide for the user?". Common
shapes: recommendation, prioritization, classification, validation, scoring,
workflow, calculation. Which rule does YOUR app apply?
```

Offer those rule shapes as options. If the user genuinely is building plain
CRUD, record it and add an entry to `## Open Questions`.

**Brownfield.** "What's the existing domain rule your system applies for the
user? And does this change add a new rule, modify an existing one, or is it
infrastructure only (no rule change)?" Classify and capture accordingly. For
infrastructure-only work, skip the empty-CRUD check. Then capture `## Constraints
& Preserved Behavior`: existing integrations/APIs/data contracts the change must
respect, data migrations, and backward-compatibility guarantees.

**Both.** Ask one round of non-functional requirements: externally observable
properties the product must hold at its boundary — response time as the user
perceives it, privacy commitments, availability, device/browser support,
retention windows. Reflect mechanical phrasings ("rate-limit per IP", "Postgres
query < 50ms") back into externally observable form before capturing. Capture as
`## Non-Functional Requirements`.

### Step 7 — Phase 6: Framing & non-goals

Produces `## Non-Goals` and the product-level frontmatter fields
(`product_type`, `target_scale`).

Ask the framing questions ONE at a time, in plain language — do not print field
names like `product_type` in the question text:

1. "What kind of thing are you building?" → map to `product_type` (web-app /
   api / cli / mobile / desktop / library / data-pipeline / other).
2. "Roughly how many people will use it once it's working?" → map to
   `target_scale.users` (small / medium / large / enterprise). Follow with:
   "How would your domain rule change at 100x the scale?"

For brownfield, turn these into "does this change?" yes/no gates plus constraint
capture (deployment windows, existing CI/CD, backward compatibility).

Then run **one** multi-select Non-Goals round, drawn from the user's domain (not
generic): capabilities this scope won't build, quality dimensions it won't pursue,
and for brownfield, existing-system changes explicitly out of scope. Append the
selected items to `## Non-Goals` with a one-line rationale each. Park any
technology avoidances under `## Forward: tech-stack`, not in Non-Goals.

### Step 8: Soft quality gate

Run a quality bar over everything captured. This is a **soft gate**: it warns
loudly but lets the user override.

Read the current `discovery-notes.md` and check each item as present or
missing/weak:

1. **Access control** — `## Access Control` exists with a non-trivial value.
2. **Business logic** — `## Business Logic` starts with a single declarative
   sentence (for brownfield infra-only work, "No domain logic change" is valid).
3. **Non-Goals** — `## Non-Goals` has at least one entry.
4. **Preserved behavior** *(brownfield only)* — `## Constraints & Preserved
   Behavior` names what cannot break.
5. **Glossary** — `glossary.md` has at least the core domain terms that came up.

Print a scorecard. For each missing/weak item, name it with a one-line
consequence ("Business logic: not captured as a one-line rule — your build will
have no domain decision to anchor on"). Never write a generic "your notes have
gaps". Then offer: fix the gaps now / accept and finish / resume a specific
phase. On accept, set `checkpoint.quality_check_status` to `warned` (if gaps
remain) or `accepted`, and append a `## Quality cross-check` section listing each
gap.

### Step 9: Handoff & decisions

Final write of `discovery-notes.md`:

- Confirm `checkpoint.quality_check_status` is `warned` or `accepted`.
- Update `updated:` to today's date.
- Re-verify against `references/discovery-notes-template.md`. Forward blocks
  (`## Forward: ...`) stay separate from the product sections.

Then review the **decisions** captured during the session. For any decision that
is hard to reverse, surprising without context, AND a real trade-off, offer to
write it as an ADR in `context/discovery/decisions/NNNN-<slug>.md` using
`references/adr-format.md`. Skip any that fail the three-part test — do not
manufacture ADRs.

Print a short completion summary (project, context type, phases captured, FRs
drafted, quality status, and the paths to the three artifact types). Then STOP —
do not auto-proceed to any downstream step; the user picks up from the artifacts
when ready.

## Critical guardrails

1. **Facilitator, not generator.** Never write domain content the user didn't
   say. Ask for missing values; only mechanical formatting is auto-filled.
2. **The template is the contract.** The shape of `discovery-notes.md` is
   dictated by `references/discovery-notes-template.md`. Re-check it at every
   checkpoint write; if it drifts, fix the template first.
3. **Stack-openness is binding.** Never ask for, recommend, or commit to a
   framework, database, language family, or platform. Volunteered stack opinions
   go under `## Forward: tech-stack`.
4. **Anti-patterns are named, not generic.** Empty-CRUD detection names the
   missing rule shape; oversized-first-increment detection names the expensive element and
   offers concrete cuts.
5. **Soft gate, not hard gate.** The final check warns but lets the user
   override every gap. Overrides are recorded as `quality_check_status: warned`.
6. **Mode-aware behavior.** Greenfield asks "what are you building from
   scratch?"; brownfield asks "what exists, what changes, what must be
   preserved?" and reads the code before asking.
7. **Glossary is a glossary.** `glossary.md` holds project-specific domain terms
   only — no implementation details, no general programming concepts. Capture
   inline, stay opinionated (one canonical term, the rest under `Avoid`).
8. **ADRs are rare.** Only hard-to-reverse, surprising, real-trade-off decisions
   become ADRs. When in doubt, leave it out.
9. **Resume preserves prior work.** On resume, completed phases are summarized
   in one line each, never re-run.

## Notes

- This is a **discovery** skill. The output is shared context
  (`discovery-notes.md` + `glossary.md` + ADRs), not a finished spec or a build
  plan.
- `references/discovery-notes-template.md` is the single source of truth for the
  notes structure. Any section name or frontmatter key this skill references
  must exist there.
- If the user pushes to skip a phase ("just write the notes"), explain the
  consequence (missing phases leave empty sections), then let them choose. The
  decision is theirs.
