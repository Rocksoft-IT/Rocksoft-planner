# Progress format (canonical contract)

`## Progress` is the single source of truth for a plan's execution state. No JSON
sidecar, no HTML markers, no nested checkboxes, no estimates / owners / dates.

## Placement

One `## Progress` heading at the very bottom of `plan.md`, after `## References`.

## Structure

- `### Phase N: <name>` — one per plan phase, matching the `## Phase N:` headers.
- Under each phase, `#### Automated` and `#### Manual` — mirroring that phase's
  `### Success criteria` subsections.
- Each criterion is one step: `- [ ] <phase>.<index> <title>`.
  - `<phase>` and `<index>` are 1-based; indices are never renumbered.
  - `<title>` is copied verbatim from the success criterion and is immutable.
  - On completion, flip `[ ]` → `[x]` and append ` — <sha>` (the commit SHA).

Phase blocks elsewhere in the plan use plain bullets (`- `). Checkboxes appear
ONLY here.

## Example

```md
## Progress

### Phase 1: Data layer
#### Automated
- [ ] 1.1 Migration applies cleanly on a fresh database
- [ ] 1.2 Repository unit tests pass
#### Manual
- [ ] 1.3 Admin sees the new column in the dashboard

### Phase 2: API
#### Automated
- [ ] 2.1 Endpoint returns 200 with the new field
```

## Mutation surface

- **`rs-plan`** writes this section once, all boxes unchecked, when the plan is
  first written.
- **The implementation step (`rs-implement`)** is the ONLY writer afterwards: it
  flips `[ ]` → `[x]` per step and appends the commit SHA at phase end.
- Review/status readers read only; they never mutate it.

## Parsing contract

- Next pending step = the first `[ ]`.
- Completion = `count([x]) / count(all)`.
- Current phase = the phase of the first `[ ]`.
