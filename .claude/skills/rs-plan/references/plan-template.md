# plan.md and plan-brief.md templates

Defines the shape of the two files `rs-plan` writes into
`context/changes/<change-id>/`. The plan describes **intent, not implementation**
— what changes and why, not how to write the code.

## plan.md

```md
# <Name> — Implementation Plan

## Overview
<2–4 sentences: what this change delivers and why.>

## Current State Analysis
<How the relevant code/system works today, grounded in real file:line refs.
Carry over any frame/research findings. Name assumptions still to verify.>

## Desired End State
<The behavior once this is done, observable from outside.>

### Key discoveries
<Bulleted load-bearing findings from research, each with a file:line ref.>

## What we're NOT doing
<Explicit out-of-scope list, so scope can't creep.>

## Implementation Approach
<The chosen approach in prose, and why it beat the alternatives considered.>

## Critical Implementation Details   (OPTIONAL — default SKIP)
<Only the surprising / load-bearing facts. Optional sub-headers: timing &
lifecycle, UX spec, performance constraints, state sequencing, debugging &
observability. Omit the whole section if nothing is non-obvious.>

## Phase 1: <name>
### Overview
<What this phase delivers.>

### Required changes
#### 1. <component>
- **File**: <path or module>
- **Goal**: <what changes and why>
- **Contract**: <interface / signature / schema field / route / invariant>
<Include a code snippet ONLY when the change is non-obvious.>

### Success criteria
#### Automated
- <agent-runnable pass/fail check, e.g. "pnpm test passes", "endpoint returns 200">
#### Manual
- <human-eyeball check, e.g. "admin sees the new column">

<!-- After each phase, STOP for human confirmation of the manual checks before
the next phase. -->

## Phase 2: <name>
<...same shape...>

## Testing Strategy
<Unit / integration / manual, mapped to the project's test tools.>

## Performance Notes
<Only if relevant.>

## Migration Notes
<Schema/data migration + rollback, only if relevant.>

## References
<Links to frame.md / research.md / roadmap slice / ADRs / key files.>

## Progress
<Per references/progress-format.md — the ONLY place checkboxes appear.>
```

**Rules:**

- Phase blocks use plain bullets (`- `), never checkboxes. The single
  `## Progress` section at the bottom is the only place `[ ]`/`[x]` appear.
- Separate **Goal** (what/why) from **Contract** (the interface). Default to no
  code snippets — include one only when the change is non-obvious.
- Success criteria are ALWAYS split into Automated and Manual.
- **No open questions in the final plan.** Resolve them before writing; the plan
  must be complete and actionable.

## plan-brief.md (~2 pages, 60–80 lines)

A standalone brief for someone who wasn't in the planning conversation.

```md
# <Name> — Plan Brief
<links to plan.md, and frame.md / research.md / roadmap slice if present>

## What & why
## Starting point
## Desired end state
## Key decisions made
<table: Decision | Choice | Why | Source>   (Source = Frame / Research / Plan;
omit the Source column if there are no upstream artifacts)
## Scope
<In / Out>
## Architecture / Approach
## Phases at a glance
<table: Phase | Delivers | Key risk>  + Prerequisites
## Open risks & assumptions
## Success criteria (summary)
```

The **Key decisions** table is the heart of the brief.
