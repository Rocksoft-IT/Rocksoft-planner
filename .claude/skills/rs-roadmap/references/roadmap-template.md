# roadmap.md contract (canonical reference)

Defines the shape of `context/foundation/roadmap.md` produced by `rs-roadmap`.
Section names are a contract — downstream tools and `rs-plan` rely on them. The
PRD is the source of truth; the roadmap only sequences what the PRD already
contains, it never invents scope.

## Frontmatter (8 keys, all required)

```yaml
---
project: <string>
version: <integer>            # 1; bumped on archive-then-replace
status: <enum>               # draft | active | locked
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
prd_version: <integer>       # version of the PRD this roadmap was built from
main_goal: <enum>            # market-feedback | quality | low-complexity | speed | learn | other
top_blocker: <enum>          # skills | capacity | time | decisions | external | motivation | none
---
```

## Sections (in order)

1. `## Vision recap` — 2–4 sentences from the PRD vision, in the user's language.
2. `## North star` — the single most valuable end-to-end, user-visible increment
   to land first: for a new product, the flow that proves the core hypothesis;
   for an existing/large system, the increment that delivers the most value or
   de-risks the most. Ties to a high-priority US-NN + the primary Success
   Criterion.
3. `## At a glance` — table: `ID | Change ID | Outcome | Prerequisites | PRD refs | Status`.
4. `## Streams` *(optional)* — table `Stream | Theme | Chain | Note`; 2–5 streams.
   Omit the whole section if fewer than 2 streams would result.
5. `## Baseline` — the six surveyed layers (Frontend, Backend/API, Data, Auth,
   Deployment/infra, Observability), each: present | absent | partial, with
   one-line evidence. A layer named in `tech-stack.md` is reported
   "per tech-stack.md: <choice>" without re-probing.
6. `## Foundations` — `F-NN` entries (cross-cutting enablers).
7. `## Slices` — `S-NN` entries (vertical, user-visible capabilities).
8. `## Backlog Handoff` — table: `Roadmap ID | Change ID | Suggested issue title |
   Ready for rs-plan | Notes`. A clean export to the project's declared issue
   tracker (see `context/foundation/tech-stack.md`). When a row is exported to an
   issue, prefix the title with its **Roadmap ID** — e.g. `[S-07] Filter
   draft/private posts from public feed`. That `[S-NN]` / `[F-NN]` tag is the
   slice's stable visual key; downstream PRs re-use it so an issue and all its
   PRs stay grouped at a glance (and in issue-tracker search).
9. `## Open Roadmap Questions` — PRD Open Questions verbatim + new cross-slice
   questions surfaced during the interview. Each: question, owner, Block yes/no.
10. `## Parked` — PRD Non-Goals + items deferred during the interview.
11. `## Done` — empty at generation. Only an archive step writes here.

With `## Streams` present = 11 sections; without = 10.

## Per-entry fields

**Slice `S-NN`** (9 required fields):

- **Outcome** — verb-led, "user can …".
- **Change ID** — stable kebab-case id (distinct from the `S-NN`/`F-NN` id);
  appears once in `## Backlog Handoff`; this is what `rs-plan <change-id>` takes.
- **PRD refs** — literal `FR-NNN` / `US-NN` / `NFR-` ids from the PRD.
- **Prerequisites** — other `F-NN`/`S-NN` ids + concrete external state.
- **Parallel with** — ids that can proceed concurrently (be generous when
  `top_blocker: capacity`).
- **Blockers** — external-pending only.
- **Unknowns** — each with Owner + Block (yes/no). Any Block:yes ⟹ `Status: blocked`.
- **Risk** — one line.
- **Status** — `proposed | ready | blocked` (emitted today). `planning` /
  `in-progress` reserved; `done` set only by an archive step.

**Foundation `F-NN`** — the same 9 fields PLUS:

- **Unlocks** — names the `S-NN` / blocking-unknown / verification path it enables.

Ids: `F-01…`, `S-01…` (two-digit, leading zero).

## Hard rules

- **Never invent slices.** Every slice must reference a real `US-NN`/`FR-NNN`.
  New wishes become `## Open Roadmap Questions` or `## Parked`.
- **Vertical slices only.** A slice touches every layer it needs, top to bottom,
  delivering one user-visible capability. Horizontal slices (a whole layer with
  no user-visible outcome) are the anti-pattern. Foundations are the only
  exception — minimal enabling contracts, scope-limited so a later slice still
  integrates the layer through real user functionality.
- **No estimates, no time units.** No "Day 1", "2 weeks", "S/M/L", story points.
  The roadmap is a dependency graph, not a calendar.
- **No low-level technical detail.** No framework names, file paths, schemas,
  code, or library choices in slices (those belong to `rs-plan`).
- **Foundations are minimal.** A foundation must not complete a whole
  architectural layer — only the smallest contract that unlocks downstream work.

## Self-check (abort the write on any failure)

1. All 8 frontmatter keys present.
2. Required sections present, in order.
3. Per-entry schema complete (S = 9 fields; F = +Unlocks).
4. PRD coverage: every must-have `FR-NNN` and every `US-NN` is referenced by some
   entry.
5. Dependency-graph integrity: no cycles; entries in topological order.
6. `## At a glance` table matches the detailed entries.
7. Status consistency: `blocked` ⟺ a Block:yes unknown; `ready` ⟺ prerequisites
   satisfied.
8. No invented slices (every slice has a real PRD ref).
9. Baseline ↔ Foundations consistency: no foundation rebuilds a `present` layer.
10. Change IDs unique, kebab-case, each appears once in `## Backlog Handoff`.
11. No estimates / time units / framework-level detail anywhere.
