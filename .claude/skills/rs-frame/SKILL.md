---
name: rs-frame
description: >
  Challenge framing assumptions about WHAT to build before planning HOW. Use when
  the input is a "bug + proposed fix", a scope question, a design choice, or any
  case where the observation and the stated cause (or the problem and the
  solution) are presented as one. Separates the observation from the stated cause
  and writes context/changes/<change-id>/frame.md. Trigger phrases: "fix", "bug",
  "broken", "root cause", "should we even", "is this the right", "challenge the
  assumption", "rethink", "before I plan". Use BEFORE rs-plan, not in place of it.
argument-hint: "<change-id or @path> [observation]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - Bash
  - Agent
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
---

# rs-frame: Frame the problem before planning

The framing stage before `rs-plan`. Its single job is to separate the
**observation** from the **stated cause** — and the **problem** from the
**proposed solution** — before planning. A plan built on the wrong problem
statement is a perfect solution to the wrong question. `rs-plan` answers *how to
build it*; `rs-frame` answers *what is actually the right thing to plan*.

**Use when** the input is a bug shape ("X is broken, build Y"), a scope shape
("is this the right scope"), a design shape ("which approach"), or an assumption
shape ("we assume X — is that true?"), or when stakes are high and the cause is
stated rather than verified. **Skip** for purely mechanical changes, or when the
user has already verified the cause.

## Inputs

- Argument: a `<change-id>` or `@context/changes/<id>/research.md`. If a research
  doc is given (or exists for the change), read it in full.
- **`context/foundation/lessons.md`** *(optional)* — prior framing lessons.
- Every file the user mentions — read IN FULL.
- `context/changes/**/` and `context/archive/**/` — for prior occurrences (Step 5).

## Output

`context/changes/<change-id>/frame.md` (~80–150 lines; the hypothesis table is
the heart). It sets `change.md` `updated: <today>` and, only if `status` is
`new`, `status: preparing`. Refuse an archived path (STOP).

## Process

### Step 1: Capture the framing; separate observation from cause

The most important step — never skip or merge it. Read lessons and every
mentioned file in full. Extract and echo back three separate bullets: **Reported
observation** (the literal observable effect or the scope/design question — not
the cause, not the fix), **stated cause/approach**, **proposed direction**.
Confirm the framing is now LOCKED. Even if the user says "just plan the fix", do
NOT merge observation with cause. If there was no clear framing ("something's
wrong, fix it"), note it's purely observational and continue.

### Step 1.5: Pre-dispatch clarifying questions (always)

Before building the map or dispatching subagents, run ONE round of clarifying
questions (AskUserQuestion, 2–3 questions). Each option describes an **observation
or scope item**, never a cause/approach/fix. Always include "Not sure / haven't
separated them yet". Record the answer as the `Pre-dispatch narrowing` line. This
step does not dispatch subagents.

### Step 2: Map the problem dimensions

Build a map of the dimensions the observation could originate from, tailored to
this system (no generic template). Read first — trace the path from stated cause
to observed effect; dimensions are the stages of that path (data flow, design
axes, or scope layers). Use 1–2 Explore subagents (Agent tool) when the surface
is large. List only dimensions you have evidence could exist. Pin the user's
framing to one node; the rest is hypothesis space. Present the map briefly.

### Step 3: Spawn parallel hypothesis agents

Register one task per plausible dimension (TaskCreate), then spawn parallel
subagents via the Agent tool — typically 2–4 (max 5), all in one message. Each
investigates: "If the framing broke in this dimension, what evidence would we
expect, and does it exist?" Each prompt includes the verbatim observation, the
specific dimensional hypothesis, an expected-evidence framing (report
present/partial/absent with `file:line` or `doc:section`), and a read-only
directive. After all return, synthesize which hypotheses have **STRONG / WEAK /
NONE** evidence. A strong hypothesis the user's framing lacked is a reframe
candidate.

### Step 4: Narrowing questions (Socratic, not solution)

AskUserQuestion, 2–5 questions. Options describe **observations or design
positions**, never causes/solutions. Each question isolates one or two
dimensions and must be decisive (change the hypothesis ranking). Always include
"Not sure / haven't checked yet". If Step 3 evidence is already conclusive, you
may skip — say so explicitly.

### Step 5: Cross-system check

Pressure-test the leading hypothesis from a different angle: an independent
Explore subagent whose prompt names only the observation (not the leading
hypothesis); a search of `context/changes/**/` and `context/archive/**/` and
commit/issue history for prior occurrences; an inverse check (what should NOT be
visible if the hypothesis holds); a consistency recheck against the original
framing. If pressure-testing strengthens it, lock confidence; if it reveals a
plausible alternative, STOP and re-run Step 3 with the new hypothesis.

### Step 6: Synthesize the Frame Brief

Resolve the change folder (use an existing one for `rs-frame <change-id>`, else
create it + `change.md` like `rs-change`). Update `change.md` (`updated`; `new →
preparing`). Write `frame.md`:

```md
# Frame Brief: <Topic>

## Reported observation
<verbatim from Step 1>

## Initial framing (preserved)
- Stated cause or approach: <…>
- Proposed direction: <…>
- Pre-dispatch narrowing: <from Step 1.5, or "not yet separated">

## Dimension map
<numbered dimensions; for each, what the framing assumes there>

## Hypothesis investigation
| Hypothesis | Evidence | Verdict |
|---|---|---|
| <user's initial framing, labeled> | <file:line / doc:section> | STRONG \| WEAK \| NONE |

## Narrowing signals
<decisive observations that included/excluded dimensions>

## Cross-system convention
<how this class of observation is usually handled; does the leading hypothesis match>

## Reframed (or confirmed) problem statement
> The real problem to plan is: <one sentence — root, not surface>
<2–3 sentences. If the original framing held: "Initial framing was correct — proceed as proposed.">

## Confidence
HIGH | MEDIUM | LOW
<if LOW, name the concrete verification step needed before rs-plan>

## What changes for rs-plan
<1–2 sentences on what the plan should actually be about>

## References
<source files [file:line]; related research; research task IDs>
```

### Step 7: Present & hand off

Print a one-screen banner (topic, confidence, observation, initial framing,
reframed problem or "initial framing held", `► Brief: …/frame.md`). Then ask:
hand off to `rs-plan` / reproduce & verify first / discuss before planning / stop
here. On hand-off, copy `rs-plan <change-id>` to the clipboard and print it.

## Critical guardrails

1. **"The framing was correct" is a valid result.** Confirming the framing is
   success — say it and stop. A manufactured reframe is worse than none.
2. **Observation and cause stay separate** through every step; the brief
   preserves the original framing verbatim even after a reframe.
3. **No solution design.** Never pick an approach, phases, or file changes — that
   is `rs-plan`'s job. The only artifact is the reframed/confirmed problem.
4. **Narrowing questions ≠ solution questions.** Options describe observations or
   design positions; if an answer would change *direction*, you've crossed into
   planning — stop.
5. **Read source before reaching for priors.** Hypotheses come from the
   evidence-built map; a confident reframe without `file:line`/`doc:section`
   evidence is the failure mode this skill prevents.
6. **Don't inflate the hypothesis count.** Two plausible dimensions → investigate
   two.
7. **Time-box.** Typically 2–4 subagent rounds and 2–5 questions; if it overruns,
   recommend reproduction and stop.
