---
name: rs-plan
description: >
  Create a detailed, phased implementation plan for a roadmap slice or a single
  change, with research and complexity-scaled questioning. Reads a change-id (or
  a roadmap slice's Change ID), plus any frame/research notes, the project's
  tech-stack.md, glossary, and ADRs, and writes
  context/changes/<change-id>/plan.md and plan-brief.md. Use AFTER rs-roadmap
  (pick a slice) or for any standalone change that needs planning before
  building. Trigger phrases: "plan this", "write an implementation plan", "plan
  the <slice>", "how should we build this". Use BEFORE implementing.
argument-hint: "[change-id or @path]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - Edit
  - Bash
  - Agent
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
---

# rs-plan: Detailed implementation plan for one change

This skill turns a roadmap slice (or a standalone change) into a complete,
phased implementation plan a programmer or agent can execute:
`rs-roadmap → rs-plan <change-id> → build`. Output lives in a per-change folder
`context/changes/<change-id>/` as `plan.md` + `plan-brief.md`.

The plan describes **intent, not implementation** — what changes and why, not how
to write the code. The output shape lives in `references/plan-template.md`; the
`## Progress` contract in `references/progress-format.md` (both paths relative to this SKILL.md). Read both before
writing.

## Inputs

- **Argument:** a `<change-id>` (a roadmap slice's Change ID) or a file path /
  reference. Read all named files IN FULL before any research.
- **`context/foundation/roadmap.md`** (if the change-id is a slice) — the slice
  entry: its Outcome, PRD refs, Prerequisites, Unknowns, Risk.
- **`context/changes/<change-id>/frame.md`** *(optional)* — a frame brief, if one
  exists; authoritative, don't re-investigate it.
- **`context/changes/<change-id>/research.md`** *(optional)* — research notes;
  its code references ARE the grounding, don't re-spawn discovery for the same
  files.
- **`context/foundation/tech-stack.md`** — the stack to plan against.
- **`context/discovery/glossary.md`** + **`decisions/`** — use the vocabulary;
  respect ADRs.
- **`context/changes/<change-id>/plan.md`** (if it exists) — resume/refine mode.

## Outputs

- **`context/changes/<change-id>/plan.md`** — the full plan.
- **`context/changes/<change-id>/plan-brief.md`** — the two-page brief.
- **`context/changes/<change-id>/change.md`** — created if the folder is new;
  set `status: planned`, `updated: <today>`.

## Process

**Initial response.** If a parameter is given, skip the intro, read all named
files, start research. If none, print a short "I'll help you plan this — give me
a change-id or a slice" message and wait.

### Step 1: Context gathering & scale the question depth

- **1.0 — Identify upstream artifacts.** Classify the input: roadmap slice /
  frame brief / research doc / existing plan / task-only. Each upstream artifact
  is a record of decisions already made — reading it counts as listening, so it
  *reduces* how much you ask. Plan the number of deep questions accordingly
  (fewer when a slice/frame/research already answers them).
- **1.1 — Read & research.** Read ALL named files IN FULL, in the main context,
  before spawning anything. Then spawn parallel research subagents via the Agent
  tool (Explore for file/pattern discovery; general-purpose for multi-file
  synthesis), each returning concrete `file:line` references. Read every file the
  research surfaces, in full. Verify your understanding against the real code.
- **1.2 — Assess & confirm complexity.** Present your informed understanding and
  rate complexity **TRIVIAL / LOW / MEDIUM / HIGH** with a 2–3 sentence
  justification, then confirm via AskUserQuestion (agree / higher / lower). The
  rating sets the deep-question budget: **TRIVIAL 0–2, LOW 4–6, MEDIUM 7–10, HIGH
  11–15**, scaled down by the upstream artifacts from 1.0. Use **TRIVIAL** for a
  small, localized change with an obvious approach — a styling/cosmetic tweak
  (colors, spacing, copy), a single-component frontend adjustment, or a
  one-line bugfix. At TRIVIAL, skip the interview entirely (or ask at most one
  confirming question), write a single-phase plan, and move on — don't
  manufacture questions for a change whose shape is already clear.
- **1.3 — Ask deep questions** via AskUserQuestion, in rounds of 1–4. Each
  question: 2–4 options, `multiSelect: true` only when options are non-exclusive,
  header ≤12 chars, always an "Other" escape, and **exactly one** option marked
  `⭐ Recommended`. Each option description follows: `[1-sentence what] ·
  Strength: [why] · Trade-off: [cost]`, recommendation grounded in the research.
  Ask the count that matches the confirmed complexity — don't pad when a slice or
  frame already covers an area; don't shorten when nothing does.

### Step 2: Research & discovery

Self-answer implementation questions by researching the codebase — these are not
for the user to decide. If the user corrects a misunderstanding, do NOT just
accept it: spawn new research subagents, read the specific files, and continue
only after verifying. Track research via TaskCreate/TaskUpdate. Wait for ALL
subagents before synthesizing. Present design options via AskUserQuestion only
when multiple valid approaches genuinely exist; otherwise state the one clear
approach and why.

### Step 3: Plan structure

Print the proposed phases as plain text and confirm via AskUserQuestion (looks
good / needs adjustment / too detailed / too coarse). Iterate before writing.

### Step 4: Write the plan

Resolve the change folder. If `rs-plan <change-id>` names an existing folder,
reuse it; otherwise create a kebab-case `<change-id>`, the folder, and
`change.md` (write its `title` frontmatter **in English** per the rs-change
convention — translate the slice / issue / roadmap title if it is in another
language; `change_id` is already English). **Refuse if the resolved path starts
with `context/archive/`** — print "This change is archived; open a new change
instead" and STOP. Update `change.md`: `status: planned`, `updated: <today>`.

Write `context/changes/<change-id>/plan.md` per `references/plan-template.md`:
phases with plain bullets, Goal separated from Contract, success criteria split
into Automated / Manual, and the single `## Progress` section at the bottom per
`references/progress-format.md` (all boxes unchecked). **No open questions in the
final plan** — resolve them first.

### Step 4.5: Write the brief

Write `context/changes/<change-id>/plan-brief.md` per the brief template — ~2
pages, written for someone who wasn't in the conversation, with the
key-decisions table at its heart.

### Step 5: Sync & review

Confirm both files exist (`ls`). Copy the next command to the clipboard with
cross-platform fallbacks:

```bash
echo -n "rs-implement <change-id> phase 1" | pbcopy 2>/dev/null \
  || echo -n "rs-implement <change-id> phase 1" | clip.exe 2>/dev/null \
  || echo -n "rs-implement <change-id> phase 1" | xclip -selection clipboard 2>/dev/null || true
```

```powershell
Set-Clipboard "rs-implement <change-id> phase 1"
```

Present both files with the review prompt and `► Next: rs-implement <change-id>
phase 1 (✓ copied)`. (`rs-implement` is the planned next link; until it exists,
this is the cue to start building phase 1 manually.) Iterate on feedback until
the user is satisfied.

## Critical guardrails

1. **Be skeptical.** Challenge vague requirements; verify against the real code;
   never assume. When the user corrects you, re-research rather than just
   agreeing.
2. **Be interactive.** Don't write the whole plan at once — get approval at each
   major step (complexity, deep questions, phase structure).
3. **Be thorough.** Read ALL context files IN FULL before planning. Research via
   parallel subagents returning `file:line` refs. Success criteria are
   measurable and split Automated / Manual.
4. **Complexity-scaled questioning is mandatory — and scales down to zero.**
   Assess and confirm complexity BEFORE writing; ask the matching count (TRIVIAL
   0–2 / LOW 4–6 / MEDIUM 7–10 / HIGH 11–15), scaled by upstream artifacts; one
   `⭐ Recommended` option each. For a TRIVIAL cosmetic/localized change, asking a
   pile of questions is itself a failure — keep it to zero or one.
5. **No open questions in the final plan.** Resolve everything before writing;
   the plan must be complete and actionable.
6. **Intent, not implementation.** Say what to change and why (Goal) and the
   interface (Contract); default to no code snippets — include one only when
   non-obvious.
7. **Progress is the contract.** Plain bullets in phases; a single `## Progress`
   section per `references/progress-format.md` is the only checkbox surface, and
   only the implementation step mutates it.
8. **Archive guard.** Never write a plan into `context/archive/`.

## Notes

- Output is the per-change folder under `context/changes/<change-id>/`.
- `references/plan-template.md` and `references/progress-format.md` are the
  single sources of truth for the output shape and the execution-state contract.
- If context degrades mid-plan, save the draft to `plan.md` and re-invoke
  `rs-plan <change-id>` in a fresh window to continue.
