# PRD Schema (canonical reference)

This document is the single source of truth for the shape of
`context/prd/prd.md` produced by `rs-prd`. `rs-prd` loads this file by relative
path and conforms to it. Its companion, `rs-discovery`, produces the input
(`context/discovery/discovery-notes.md`) whose structure is defined in
`../../rs-discovery/references/discovery-notes-template.md`.

The PRD captures only **product-level identity** — what the product is, who it's
for, what it must do. Fields and sections that depend on framework, runtime, or
deployment target are intentionally absent; they belong to a downstream
build/stack step, not the PRD. Frame the PRD as the product's identity, not its
architecture.

Renames or restructurings of this contract are load-bearing. Update this doc
*first*, then the `rs-prd` skill body.

## Frontmatter fields

Every PRD declares this YAML frontmatter block. Key names are load-bearing;
field order is suggested. These fields mirror the `rs-discovery` discovery-notes
frontmatter exactly — `rs-prd` copies them across, it does not invent them.

```yaml
---
project: <string>            # human-readable name, e.g. "Recipe Fridge"
version: <integer>           # 1 for first PRD; bumped on versioned saves (prd-v2.md -> 2)
status: <enum>               # draft | reviewed | locked   (rs-prd only ever writes draft)
created: <YYYY-MM-DD>        # date the PRD was first written
context_type: <enum>         # greenfield | brownfield
product_type: <enum>         # web-app | api | cli | mobile | desktop | library | data-pipeline | other
target_scale:
  users: <enum>              # small | medium | large | enterprise
---
```

Notes:

- **`project`** — short proper-noun name. Never invented; if the input lacks it,
  emit `# TODO: project — see Open Questions`.
- **`version`** — starts at `1`. Versioned saves (`prd-v2.md`) increment it.
- **`status`** — `draft` on first write. `rs-prd` never promotes past `draft`.
- **`context_type`** — read from the discovery-notes frontmatter; determines
  which section list (10 greenfield / 11 brownfield) the PRD uses.

Stack-shaped concerns — framework, language, database, deployment, CI/CD, team
composition — are intentionally absent. They belong to the downstream build step.
If discovery-notes captured them under a `## Forward: tech-stack` block, they
stay there; `rs-prd` summarizes them in the hand-off message, never in PRD
frontmatter or sections.

## Required PRD sections

A conforming `prd.md` contains `##`-level headings determined by `context_type`.
Section names are the contract — downstream tools split on them. Greenfield uses
10 sections; brownfield uses 11.

Entities, fields, and data models are intentionally NOT a PRD concern. They
emerge from Functional Requirements and User Stories and are pinned down during
the build step. A PRD that ships a column-level data model has over-committed.

### Greenfield PRD sections (10, in order)

1. `## Vision & Problem Statement`
2. `## User & Persona`
3. `## Success Criteria`  (with `### Primary` / `### Secondary` / `### Guardrails`)
4. `## User Stories`
5. `## Functional Requirements`
6. `## Non-Functional Requirements`
7. `## Business Logic`
8. `## Access Control`
9. `## Non-Goals`
10. `## Open Questions`

### Brownfield PRD sections (11, in order)

1. `## Current System Overview`
2. `## Problem Statement & Motivation`
3. `## User & Persona`
4. `## Success Criteria`  (Guardrails must include existing behavior that must not regress)
5. `## User Stories`
6. `## Scope of Change`
7. `## Constraints & Compatibility`
8. `## Business Logic Changes`
9. `## Access Control Changes`
10. `## Non-Goals`
11. `## Open Questions`

## Section contents

**## Vision & Problem Statement** *(greenfield)* / **## Problem Statement &
Motivation** *(brownfield)*. Two paragraphs max. The specific pain (named user,
named situation, named cost), then the insight that makes this worth building.
Brownfield is delta-framed: the gap between current and desired state, and why
now. No marketing language.

**## Current System Overview** *(brownfield only)*. What exists today: purpose
(one sentence), key architecture, tech stack, current user base, core
functionality. This section MAY name specific technologies — it describes
reality, not a choice. Maps from `## Current System` in discovery-notes.

**## User & Persona.** One primary persona — name, role, the moment they reach
for the product. Brownfield emphasizes existing users whose experience changes.

**## Success Criteria.** Exactly three subsections: `### Primary` (measurable
outcomes that prove it worked), `### Secondary` (nice-to-haves), `### Guardrails`
(things that must not break). Brownfield guardrails explicitly include preserved
existing behavior.

**## User Stories.** Each is `### US-NN: <Title>` (zero-padded, from 01) with a
Given/When/Then block and an `#### Acceptance Criteria` list. Brownfield is
delta-framed: the new behavior, with notes on what was different before.

**## Functional Requirements** *(greenfield)*. One line per FR:
```
- FR-NNN: [Actor] can [capability]. Priority: must-have | nice-to-have
```
Group thematically with `###` subheadings beyond ~6 FRs. If discovery-notes
carried a `> Challenge:` blockquote under an FR, preserve it verbatim.

**## Scope of Change** *(brownfield, replaces Functional Requirements)*. Explicit
categorized delta:
```
- [new] <new capability>
- [modified] <changed behavior — was X, now Y>
- [removed] <removed capability — rationale>
- [preserved] <explicitly preserved behavior — must not break>
```
FRs tagged `Change: preserved` in discovery-notes become `[preserved]` items
here — not Non-Goals.

**## Non-Functional Requirements** *(greenfield)*. Bulleted. Each NFR is a
property an outside observer can measure without inspecting the implementation,
paired with a measurable target where one exists. Do NOT name mechanism,
enforcement, runtime location, or UI affordance — those are downstream.

**## Constraints & Compatibility** *(brownfield)*. Backward-compatibility
requirements, data-migration needs, existing integrations that must keep
working, explicitly preserved behavior. Maps from `## Constraints & Preserved
Behavior` in discovery-notes. Relevant ADRs from `context/discovery/decisions/`
are referenced here by number and title.

**## Business Logic** *(greenfield)* / **## Business Logic Changes**
*(brownfield)*. One declarative sentence first — the domain rule that makes this
non-trivial. Then ≤3 supporting paragraphs (user-facing inputs, output, where
the user meets it). Do NOT name the component that performs the rule. Brownfield:
state the current rule, then the change; for infra-only work, "No domain logic
change. This is an infrastructure/technical change."

**## Access Control** *(greenfield)* / **## Access Control Changes**
*(brownfield)*. Who may do what. Single-user local apps still need this: write
"Single user; no auth; data on-device only." Brownfield: "No access control
changes — current model preserved." or describe the delta.

**## Non-Goals.** Explicit list of what this release/change does NOT do, one-line
rationale each. Covers functional non-goals (capabilities not built) and
non-functional non-goals (quality dimensions not pursued). Technology avoids
("avoid: PHP") are NOT non-goals — they stay in `## Forward: tech-stack`. Scope
avoids ("avoid: building our own recommendation algorithm") DO belong here.

**## Open Questions.** Numbered list. Each entry names what's unknown, who
resolves it, and the latest acceptable date if any. `rs-prd` ALWAYS routes
captured uncertainty here verbatim — it never invents domain content to fill a
gap.
```markdown
1. **What is the one-sentence business rule?** — TBD by user. Block: yes (PRD is hollow until resolved).
2. **Canonical recipe data source?** — Owner: user. By: 2026-05-10.
```

## Glossary and ADR usage

- **Glossary.** `rs-prd` reads `context/discovery/glossary.md` and uses its
  canonical terms throughout the PRD, so the document, the discovery notes, and
  the eventual code all speak one language.
- **ADRs.** `rs-prd` reads `context/discovery/decisions/` and references any ADR
  relevant to a section by number and title (most often in brownfield
  `## Constraints & Compatibility`). It does not copy ADR bodies into the PRD —
  the decision lives in its own file; the PRD points to it.

## Input-quality heuristic (rs-prd Step 2)

`rs-prd` scores the input 0–4 (one point each) to decide whether to warn about
thin input before generating. Timeline is deliberately NOT a signal.

1. **`checkpoint:` block present in frontmatter** — strongest signal the input
   came from `rs-discovery`.
2. **At least one `FR-NNN` requirement** — matches `^- FR-\d{3}: `.
3. **At least one Given/When/Then block** — `**Given**` and `**When**` and
   `**Then**` present.
4. **Explicit one-line business logic** — `## Business Logic` exists and its
   first non-empty line is a single declarative sentence (≤200 chars, ends `.`,
   not a `# TODO` placeholder).

Score ≥ 2: input is shaped enough; generate. Score < 2: warn, naming each
missing signal and its consequence, then let the user proceed, run `rs-discovery`
first, or cancel.

## Drift detection

If a maintainer renames a section or frontmatter key, the failure is silent
drift. Mitigation: edit this doc first, then grep `rs-prd/SKILL.md` for the old
name and update, then re-verify the skill still parses.
