---
name: rs-research
description: >
  Research a codebase comprehensively using parallel sub-agents, then synthesize
  the findings into a self-contained research document with file:line references
  and temporal context. The main agent synthesizes; sub-agents do the deep
  reading. Writes context/changes/<change-id>/research.md. Use to understand how a
  system works, trace code paths, or ground a plan before writing it. Trigger
  phrases: "research the codebase", "how does X work", "trace this", "explore
  before planning", "where is Y handled".
argument-hint: "<change-id> [research question]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Agent
  - Write
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
---

# rs-research: Parallel-subagent codebase research

Answer a research question by spawning parallel sub-agents and synthesizing their
findings into a durable, self-contained `research.md`. Sub-agents do the deep
reading; the main agent synthesizes. Often used to ground `rs-plan` (or feed
`rs-frame`) before planning.

## Initial response

On invocation, reply: "I'm ready to research the codebase. Please provide your
research question or area of interest, and I'll analyze it thoroughly by
exploring relevant components and connections." Then wait.

## Output

`context/changes/<change-id>/research.md`. Sets `change.md` `updated: <today>` and,
only if `status` is `new`, `status: preparing`. Refuse an archived path (STOP).
Never write the document with placeholder values.

## Process

1. **Read mentioned files first.** Read any files the user names IN FULL, in the
   main context, before spawning anything. Read `context/foundation/lessons.md`
   if present and treat its entries as known patterns that narrow the search.
2. **Decompose the question** into composable research areas; think about
   underlying patterns, connections, and architectural implications. Register one
   task per area (TaskCreate; TaskUpdate as each completes).
3. **Clarify scope** (AskUserQuestion, 1–3 of: scope / depth / focus / output
   format; 2–4 concrete options each, headers ≤12 chars, always allow "Other").
   **Skip this entirely** if the query is already tight and unambiguous (e.g.
   "find all files using X").
4. **Spawn parallel subagents** via the Agent tool — 2–4 at a time, in one
   message. Use Explore subagents for fast file/pattern discovery and path
   tracing; general-purpose subagents for deep multi-file analysis. Each prompt is
   specific, read-only, and requests concrete `file:line` references and usage
   patterns (not just definitions), scoped to one research dimension. Include a
   subagent for prior decisions in `context/changes/**/` and
   `context/archive/**/`.
5. **Wait for ALL subagents, then synthesize.** Prioritize current-codebase
   findings; use prior changes/archive as supplementary historical context;
   connect cross-component findings with `file:line` references.
6. **Resolve the change folder & gather metadata.** Use an existing folder for
   `rs-research <change-id>`, else create it + `change.md` (like `rs-change`). Update
   `change.md` (`updated`; `new → preparing`). Gather git metadata
   (`git_commit`, `branch`, `repository`).
7. **Write `research.md`:**

```md
---
date: <YYYY-MM-DD>
researcher: <name>
git_commit: <sha>
branch: <branch>
repository: <repo>
topic: "<user's question>"
tags: [research, codebase, <relevant-components>]
status: complete
last_updated: <YYYY-MM-DD>
last_updated_by: <name>
---

# Research: <User's Question/Topic>

**Date**: …  **Researcher**: …  **Git Commit**: …  **Branch**: …  **Repository**: …

## Research Question
<original query>

## Summary
<high-level findings answering the question>

## Detailed Findings
### <Component/Area 1>
<finding with `file.ext:line` reference; connections; implementation details>

## Code References
- `path/to/file.ext:123` — description

## Architecture Insights
<patterns, conventions, design decisions>

## Historical Context (from prior changes)
<insights from context/changes/** and context/archive/** with references>

## Related Research
<links to other research.md artifacts>

## Open Questions
<areas needing further investigation>
```

8. **GitHub permalinks (if applicable).** If on a pushed branch, build
   `https://github.com/{owner}/{repo}/blob/{commit}/{file}#L{line}` (via `gh repo
   view --json owner,name`) and replace local references.
9. **Present findings** — a concise summary, key references for navigation, and an
   invitation for follow-ups.
10. **Follow-ups.** Append to the same `research.md`: update `last_updated` /
    `last_updated_by`, add `last_updated_note`, add a `## Follow-up Research
    [timestamp]` section, and spawn new subagents as needed.

## Critical guardrails

1. **Parallel subagents, main-agent synthesis.** Sub-agents do the deep reading;
   the main agent connects findings. Launch 2–4 in one message; wait for ALL
   before synthesizing.
2. **Read-only, reference-rich prompts.** Subagent prompts request `file:line`
   references and usage patterns, never edits.
3. **Fresh research; history is supplementary.** Always research the current
   codebase; prior changes/archive are context, not the answer.
4. **Self-contained document.** File paths, line numbers, cross-component
   patterns, and temporal context must all live in the doc; prefer GitHub
   permalinks for stable references.
5. **Critical ordering.** Read mentioned files before subtasks; wait for all
   subagents before synthesizing; gather metadata before writing; never write
   placeholder values.
6. **Frontmatter consistency.** Always include the YAML frontmatter; snake_case
   multi-word fields; update them on follow-ups.

## Notes

- The `research.md` lands at `context/changes/<change-id>/research.md` — the same
  path `rs-frame` and `rs-plan` read and reference.
- No automated handoff: it ends by presenting findings. The next skill consumes
  the shared `research.md`.
