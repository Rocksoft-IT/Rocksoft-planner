# test-plan.md schema (canonical reference)

Defines the shape of `context/foundation/test-plan.md` produced and driven by
`rs-test-plan`. Section order is fixed (§1 → §8). Section names and the §3 status
vocabulary are a contract — the orchestrator parses them to resume.

## File header

```md
# Test Plan

A risk-driven, phased testing strategy for this product. The risk map and
strategy are frozen guidance; §3 is the live rollout state.
To re-derive from scratch, re-run with --refresh.

Last updated: <YYYY-MM-DD>
```

`Last updated:` is bumped on every §3 status transition.

## §1 — Strategy

Copy these three principles **verbatim** (they are load-bearing — do not
paraphrase):

1. **Cost × signal.** Spend testing effort where the product of failure cost and
   failure likelihood is highest. A cheap test that catches a likely, costly
   failure beats an expensive test of an unlikely one.
2. **User concerns are first-class evidence.** What the people who rely on this
   product worry about is real risk data, weighted alongside code churn and
   architecture — not below it.
3. **Risks are scenarios, not code locations.** A risk is a failure the user
   would experience ("a paid order ships twice"), never a file or function. Code
   anchoring is deferred to the per-change research step.

Include a one-line "Hot-spot scope used for likelihood weighting: <dirs>".

## §2 — Risk Map

Table, 5–7 rows, every row citing at least one source:

```md
| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | A paid order can ship twice | High | Medium | PRD FR-014; hot-spot: src/orders (31 commits/30d) |
```

- **Impact / Likelihood:** High / Medium / Low.
- **Allowed Source citations:** a PRD/roadmap/archive line, `interview Q<n>`, a
  hot-spot **directory** with churn count, a tech-stack constraint.
- **Forbidden Source citations:** `file:line`, function/symbol names,
  schemas/classes/modules. (Anchoring is the per-change research step's job.)
- Risk numbers are stable across refreshes — append, never renumber.
- Add an **abuse / security lens** row when the product handles money, auth,
  personal data, or untrusted input.

Immediately follow with a **Risk Response Guidance** sub-table (one row per top
risk):

```md
| Risk | What would prove protection | Must challenge | Context research must ground | Likely cheapest layer | Anti-pattern to avoid |
```

## §3 — Phased Rollout (the live state)

```md
| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
```

3–5 phases. **Status vocabulary (parser literals, English even in a translated
plan):**

```
not started → planned → implementing → complete
```

`Change folder` holds the `<change-id>` once a phase is opened. (A rollout phase
becomes a change driven through `rs-plan → rs-implement → rs-impl_review →
rs-archive`. An optional research/frame step may precede `rs-plan` when present.)

## §4 — Stack

```md
| Layer | Tool | Version | Notes |
```

Plus a mandatory note: **Stack grounding tools (current session):** Docs /
Search / Runtime-browser / Provider lines, each with `checked: <YYYY-MM-DD>` or
"not available in current session".

## §5 — Quality Gates

```md
| Gate | Where | Required? | Catches |
```

Only gates a rollout phase actually points at.

## §6 — Cookbook Patterns

3–6 sub-sections (e.g. 6.1 unit, 6.2 integration, 6.3 e2e, 6.4 new API endpoint,
6.5 new build rule, 6.6 per-rollout-phase notes). They start as placeholders
("TBD — see §3 Phase <N>") and are filled by each rollout phase's final sub-phase.

## §7 — What We Deliberately Don't Test

The negative space, drawn from interview Q5 — what is intentionally out of scope
and why.

## §8 — Freshness Ledger

Three "last reviewed / verified" dates plus the triggers that should prompt a
`--refresh`.

## Forbidden content (anywhere in the file)

- No test code blocks, no CI YAML, no hook scripts, no MCP install commands.
- No `file:line` / symbol / schema anchors in §2 (evidence only).
- No motivational phrasing, no emojis.
- No reordering of sections; no new §3 status values.
