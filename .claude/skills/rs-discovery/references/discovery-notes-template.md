# discovery-notes.md template

This is the single source of truth for the structure of
`context/discovery/discovery-notes.md`. The `rs-discovery` skill writes and
re-checks against this file at every checkpoint. Greenfield and brownfield share
the same section names; brownfield adds `## Current System` and `## Constraints &
Preserved Behavior`.

## Frontmatter

```yaml
---
project: <short project name or "(unnamed)">
context_type: greenfield | brownfield
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
product_type: web-app | api | cli | mobile | desktop | library | data-pipeline | other
target_scale:
  users: small | medium | large | enterprise
checkpoint:
  current_phase: <int>       # 1..6, then 7 (gate), 8 (handoff)
  phases_completed: [<int>, ...]
  frs-drafted: <int>
  quality_check_status: pending | warned | accepted
---
```

`product_type` and `target_scale` are the ONLY product-level commitments
captured. No framework, database, language, or platform belongs here — those are
downstream of discovery.

## Section order

### Greenfield (capture in this order)

```
## Vision & Problem
## User & Persona
## Access Control
## Success Criteria
    ### Primary
    ### Secondary
    ### Guardrails
## Functional Requirements
## Dependencies                         ← omit if no FR-to-FR prerequisites
## User Stories
## Business Logic
## Non-Functional Requirements
## Non-Goals
```

### Brownfield (capture in this order)

```
## Current System                       ← brownfield only
## Vision & Problem                     (framed as a delta)
## User & Persona
## Access Control
## Success Criteria
    ### Primary
    ### Secondary
    ### Guardrails
## Functional Requirements              (each FR tagged Change: new|modified|preserved)
## Dependencies                         ← omit if no FR-to-FR prerequisites
## User Stories
## Business Logic
## Constraints & Preserved Behavior     ← brownfield only
## Non-Functional Requirements
## Non-Goals
```

## Section contents

**## Current System** *(brownfield)*. What exists today: the product/service/
module, the tech stack the user named, who uses it, and the pain or gap driving
the change. Draw on the codebase map from Step 1b.

**## Vision & Problem.** Greenfield: the pain, the person who feels it, the
moment, and the cost today. Brownfield: the same, framed as a delta — what
changes and why.

**## User & Persona.** The primary persona only — a named role, not "users".

**## Access Control.** How the persona reaches the product (login / local
profile / access key / none) and the role model (flat vs. admin/member/guest).
Brownfield: current model plus any planned change, or "No change planned —
existing model preserved."

**## Success Criteria.**
- `### Primary` — the first end-to-end increment that delivers value and proves
  it works (may be substantial — not necessarily a minimal slice).
- `### Secondary` — one nice-to-have.
- `### Guardrails` — one or two things that must not break (brownfield: include
  preserved existing behavior).

**## Functional Requirements.** One block per capability:
```
- FR-NNN: [Actor] can [capability]. Priority: must-have | nice-to-have
  - **Acceptance:** <one observable test — what proves this works end-to-end>
# brownfield adds to the first line: . Change: new | modified | preserved
```
Each FR carries a `> Challenge:` quote block recording the Socratic round.

**## Dependencies.** *(omit if none)* FR-to-FR prerequisite relationships only:
```
## Dependencies
- FR-NNN blocked-by FR-MMM
- FR-NNN blocked-by FR-PPP, FR-QQQ
```

**## User Stories.** At least the main flow as `### US-01` with Given/When/Then.

**## Business Logic.** A single declarative sentence naming the domain rule,
then ≤3 paragraphs on user-visible inputs, output, and where the user meets it.
No component or actor names. Brownfield infra-only work: "No domain logic
change."

**## Constraints & Preserved Behavior** *(brownfield)*. Existing integrations,
APIs, and data contracts the change must respect; data migrations;
backward-compatibility guarantees; deployment/CI constraints.

**## Non-Functional Requirements.** Externally observable properties at the
product boundary (perceived response time, privacy, availability, device
support, retention) — never an enforcement mechanism.

**## Non-Goals.** Capabilities this release won't build and quality dimensions it
won't pursue, each with a one-line rationale.

## Optional / informational blocks (NOT part of the product sections)

These are parked separately so they never leak into the product shape:

```
## Open Questions          # unresolved items surfaced during discovery
## Quality cross-check      # gaps the user accepted at the soft gate
## Forward: tech-stack      # volunteered stack opinions → feed into rs-init's tech-stack.md
## Forward: technical-roadmap  # volunteered implementation/test/CI thoughts
```
