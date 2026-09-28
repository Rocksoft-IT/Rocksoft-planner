# Architecture findings

| ID | Severity | Category | Element | Status | Title |
|---|---|---|---|---|---|
| AR-001 | medium | test-gap | (repo-wide) | open | No automated test runner, so coverage cannot be measured |
| AR-002 | low | operability | (repo-wide) | open | No orphan-detection tool (knip), so only functions and routes are checked for dead code |
| AR-003 | low | design | shell | open | `src/lib/utils.ts` mixes generic helpers with timeline-only scheduling logic |

## AR-001 · No automated test runner, so coverage cannot be measured

- **Status:** open
- **Severity:** medium
- **Category:** test-gap
- **Element:** (repo-wide)
- **Evidence:** `context/foundation/tech-stack.md` (## Testing: "No automated test runner present"); no `test:coverage` script in `package.json` or `mcp/competency/package.json`
- **Since:** 2026-09-28
- **Issue:** —
- **Client title:** No automated tests protect the planner's scheduling and roster features
- **Client summary:** The tool that checks how much of the app is covered by automated tests isn't set up yet, so we can't measure test coverage for the scheduling calendar or the team roster — the two areas that change most often.
- **Client fix:** Add an automated test-coverage check, then write tests for the workload/utilization calculations and the scheduling logic first, since those change the most and matter the most.

The project has no Vitest/Jest coverage command (only `vitest run` for pass/fail),
so `metrics.mjs` produced `coverage: null` for every capability and the
test-gap ranking could not be scored. `team` and `timeline` are the highest-churn,
highest-criticality capabilities (see `snapshots/2026-09-28.json`: 20.7% and
31% of the last 90 days' commits respectively) and carry only two existing
test files repo-wide (`src/lib/utils.test.ts`, `src/components/ThemeProvider.test.tsx`),
so utilization math, allocation scheduling and the roster CRUD flows are
exercised by no automated regression test.

**Suggested fix:** Add a coverage command (e.g. `vitest run --coverage` writing
`coverage/coverage-summary.json`) so a future `rs-arch-map` run can score real
test gaps, then add tests for `calcUtilization`/`formatAvailability` and the
allocation date-range logic in `Timeline.tsx`.

## AR-002 · No orphan-detection tool (knip), so only functions and routes are checked for dead code

- **Status:** open
- **Severity:** low
- **Category:** operability
- **Element:** (repo-wide)
- **Evidence:** `metrics.mjs` output: `"knip": false`; no `knip.json` in the repo
- **Since:** 2026-09-28
- **Issue:** —
- **Client title:** No automatic check for unused code
- **Client summary:** There's no tool installed that flags files or dependencies nobody uses anymore. Nothing unused was found this time, but leftover code could go unnoticed until one is added.
- **Client fix:** Add a dead-code checker (a one-time setup task) so unused files and dependencies get flagged automatically going forward.

Without `knip` installed, orphan detection falls back to the weaker
functions/routes heuristic (no unused-file or unused-dependency report), per
`context/architecture/README.md` and the rs-arch-map contract. No orphans were
flagged in this run, but a genuinely dead file or an unused dependency
(e.g. in `mcp/competency`) would not surface until knip is added.

**Suggested fix:** When a maintainer wants file-level dead-code detection, add
`knip` and its entry-point config (`knip.json` per workspace: root and
`mcp/competency`) — an intentional choice for a human to make, not something
this run installs.

## AR-003 · `src/lib/utils.ts` mixes generic helpers with timeline-only scheduling logic

- **Status:** open
- **Severity:** low
- **Category:** design
- **Element:** `shell`
- **Evidence:** `src/lib/utils.ts:1-40` (generic `cn`, themed classes, `PROJECT_COLORS`/`AVATAR_COLORS`) alongside `src/lib/utils.ts:41-200` (`getViewDays`, `getAllocationStyle`, `calcUtilization`, `formatAvailability`, `compareByContractType`, `matchesContractTypeFilter` — all timeline/team scheduling logic); `snapshots/2026-09-28.json` shows `shell` as the single hottest capability (46.6% of 90-day churn), ahead of `timeline` (31%) and `team` (20.7%)
- **Since:** 2026-09-28
- **Issue:** —
- **Client title:** Shared helper code is tangled up with scheduling logic
- **Client summary:** A shared code file mixes generic, app-wide helpers with logic that really belongs to the scheduling calendar. This makes it look like the whole app changes every time someone tweaks scheduling, which makes it harder to see where the real risk and activity is.
- **Client fix:** Split that file into a generic part and a scheduling-specific part, so future reports show accurately which feature is actually changing.

`shell` is modelled as the shared app shell (layout, theming, generic `Modal`,
shared types), but a large share of its churn is really scheduling and
roster logic that happens to live in the same file (`utils.ts`). This
inflates `shell`'s hotspot ranking and understates `timeline`'s and `team`'s
real churn share, and it means a change to allocation math shows up as a
"shared platform" change rather than a `timeline` change — a false signal for
future audits and reports.

**Suggested fix:** Split `src/lib/utils.ts` into a small generic module
(`cn`, themed classes, colors, `formatDate`) owned by `shell`, and a
scheduling module (`getViewDays`, `getAllocationStyle`, `calcUtilization`,
`formatAvailability`, contract-type sort/filter helpers) owned by `timeline`/`team`.
