<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Allocations & Timeline UX Improvements

**Plan**: `context/changes/allocations-ux-improvements/plan.md`   **Scope**: full plan   **Date**: 2026-08-19
**Verdict**: REJECTED   **Findings**: 9

> The plan is an **AS-BUILT** record, reconstructed from PR #49 (range `efb5a44..a675fcd`)
> after the fact. Plan Adherence and Scope Discipline were therefore anchored on whether
> the record *accurately* describes the diff, and on the five ClickUp tasks in `change.md`
> — not on drift, which an as-built plan cannot show. `## Progress` is unchecked by design.
>
> **REJECTED is driven by F1 alone**, a reachable dead-end in the create flow. Everything
> else is WARNING or below, and the five requested tasks are essentially delivered.

## Verdicts

| Dimension | Verdict |
|---|---|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | FAIL |
| Architecture | WARNING |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

### Success criteria — verified, not assumed

Dependencies were installed (447 packages) so the checks could actually run rather than be
recorded as SKIPPED.

- **`npm run build` → PASS.** Compiled clean, TypeScript clean, 9 routes generated.
- **`npm run lint` → PASS (no new problems).** 5 errors + 3 warnings project-wide, all
  pre-existing. Verified rather than trusted: `Timeline.tsx:51` flags `assignLanes` as
  unused, and `git show efb5a44:src/components/timeline/Timeline.tsx` confirms it was
  already unused before this change (only `assignLanesAll` is called). `Timeline.tsx:652`
  and `AllocationModal.tsx:54` are likewise outside this change's hunks, and the same
  `set-state-in-effect` rule fires in three files neither change touches.
- **Manual criteria** — all 20 `## Progress` rows unchecked, correct for an as-built
  record; no blind signing. F1 means criterion 5.6 would fail if run today.

## Findings

### F1 — One submit without a project bricks the create button until a page reload
- **Severity**: CRITICAL
- **Impact**: MEDIUM
- **Dimension**: Safety & Quality
- **Location**: `src/components/timeline/AllocationModal.tsx:104` (with `:84`)
- **Detail**: Inserting the time-off branch pushed the project-required guard *below*
  `setLoading(true)`. Before this change the check was `if (!personId || !projectId)` at the
  top of `handleSubmit`, above any loading state; now `if (!projectId) { setError('Wybierz
  projekt.'); return }` returns without ever calling `setLoading(false)`. The submit button
  is `disabled={loading}` and the reset effect (lines 49-72) never touches `loading`, so it
  stays `true` indefinitely, stuck reading "Zapisuję…".
  **Recovery requires a full page reload** — verified: `<AllocationModal>` is rendered
  unconditionally at `Timeline.tsx:867` and only the inner `Modal` returns `null` when
  closed, so `loading` lives on in a component that never unmounts. Closing and reopening
  does not clear it.
  Fully reachable in normal use, and *newly* reachable because of this change: the project
  `<select required>` was replaced by plain `<button>` elements (F5), so native validation
  no longer blocks an empty project. Flow: "Przydziel" → pick a person → "Utwórz" without
  picking a project → the create flow is dead for the rest of the session, taking the
  typed dates, hours and notes with it. The time-off branch calls `setLoading(false)`
  correctly, and the person check at line 81 sits above `setLoading(true)` — which is what
  makes the inconsistency clearly accidental rather than intended.
- **Fix**: Move the `!projectId` check up beside the person check at line 81 (guarded with
  `kind === 'project' || allocation`), or add `setLoading(false)` before the return.
- **Decision**: PENDING

### F2 — The new time-off path leaks raw database errors and logs nothing
- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Pattern Consistency
- **Location**: `src/components/timeline/AllocationModal.tsx:97`
- **Detail**: The time-off branch does `setError(dbError.message)` with no `console.error`,
  while the allocation branch 36 lines below *in the same function* deliberately does the
  opposite — `console.error('Allocation save failed:', dbError)` plus a generic Polish
  message. A failed time-off insert therefore renders a PostgREST string into the modal
  (e.g. `new row violates row-level security policy for table "time_off"`), exposing table,
  constraint and policy names, and leaves no console trace to debug from. `Timeline.tsx:365`,
  `:398`, `:413` and `:439` all follow the console + generic-message convention, making this
  the only diverging write path in the changed surface. It mirrors the older
  `TimeOffModal.tsx:66`, but that is precisely the pattern the allocation path was moved
  away from one change earlier.
- **Fix**: `if (dbError) { console.error('Time-off save failed:', dbError); setError('Nie
  udało się zapisać nieobecności. Spróbuj ponownie.'); return }`
- **Decision**: PENDING

### F3 — The label fix breaks during a body drag — the exact case it was built for
- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Safety & Quality
- **Location**: `src/components/timeline/Timeline.tsx:149` (with `:145`, `:158`)
- **Detail**: `labelOffset` is computed from the untransformed `left`, but the block is
  displaced by `snappedX` through `CSS.Transform.toString(...)`. The label is a child of the
  transformed element, so its on-screen x becomes `scrollLeft + snappedX + 8`. Concrete
  failure: take a block that starts before the viewport's left edge — the case task
  869e6rn52 exists to fix — and drag it left by 3 days. `snappedX = -132`, so the label
  renders 132 px left of the visible edge, underneath the sticky 224 px person column or
  clipped entirely: the project name vanishes mid-drag and snaps back on drop. Dragging
  right drifts it inward instead of tracking the edge. Plan criterion 4.4 ("the label
  follows without jitter") is not supported by the code. Resize is unaffected — it mutates
  `previewLeft`/`previewWidth`, which flow through the `left` prop correctly. The base
  arithmetic is otherwise right: the day grid sits 224 px into the scroll content and the
  sticky sidebar is also 224 px, so the offsets cancel and `scrollLeft - left` is correct
  when not dragging.
- **Fix**: `Math.max(0, Math.min(scrollLeft - (left + snappedX), Math.max(0, width - 96)))`
- **Decision**: PENDING

### F4 — Margin collapsing halves task 869e5gwa8, and tall rows still bleed
- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Safety & Quality
- **Location**: `src/components/timeline/Timeline.tsx:737` (with `:48`, `:750`)
- **Detail**: The Phase 1 contract reads as though `mb-1.5` on the name plus `mt-1.5` on
  the stats wrapper add to 12 px. They do not: the two are adjacent block-level siblings
  inside a plain block container (`flex-1 min-w-0` is a flex *item*, not a flex container),
  so their vertical margins collapse to `max(6, 6) = 6 px`. Delivered separation for
  "imiona/nazwiska + opisy się nie zlewają" is 4 px → 6 px, and one of the two classes is
  dead. The raised `calcRowHeight` floor (44 → 50) adds outer padding via `items-center`,
  not space between the two elements. Worse, the floor does not cover the tallest variant:
  when `ooodays > 0` an extra line at `:750` brings the cell to roughly 57.5 px, over both
  the 1-lane row (50) and the 2-lane row (56). The row div has a fixed height and no
  `overflow-hidden` while the cell is `flex items-center`, so content bleeds a few px into
  the neighbouring rows' sticky cells — reintroducing the blending symptom this phase set
  out to remove, specifically for people who have time off.
- **Fix**: Make the wrapper `flex flex-col gap-2` (or keep a single margin), and either
  raise the floor to 60 or add `overflow-hidden` to the frozen left cell.
- **Decision**: PENDING

### F5 — Replacing the project `<select>` removed any indication of what is selected
- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Safety & Quality
- **Location**: `src/components/timeline/AllocationModal.tsx:342`
- **Detail**: The searchbar arrived by swapping the native `<select required>` for a
  filtered list of `<button type="button">` rows — a control swap the plan never records
  (F8). Two consequences beyond F1's lost validation. (a) Pick project X, then type a query
  that excludes X: the list renders only `filteredProjects`, so X disappears with nothing
  showing a selection is still active, and "Utwórz" silently creates the allocation against
  the invisible X. (b) In edit mode the list sits at scroll-top inside `max-h-44
  overflow-y-auto` (~4 visible rows) with no `scrollIntoView` and no query prefill, so for
  an allocation whose project is further down, the modal shows no selected project until
  the user scrolls manually — a straight regression from the `<select>`, which always
  displayed its current value. The list is also no longer a form control: no
  `role="listbox"`, no `aria-selected`, no type-ahead, no arrow-key navigation.
- **Fix**: Show the selected project as a chip above the search input, and `scrollIntoView`
  the selected row when the modal opens in edit mode.
- **Decision**: PENDING

### F6 — The OOO block never got the same label fix
- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Pattern Consistency
- **Location**: `src/components/timeline/Timeline.tsx:234` (with `:211`)
- **Detail**: `DraggableOooBlock` is documented in the file as the "OOO (time-off)
  counterpart of `DraggableAllocBlock`" and mirrors it for `snappedX`, lane height and drag
  id namespacing — but it kept a static `px-2`. A vacation or L4 block starting before the
  viewport's left edge still renders as an unlabelled striped bar, which is exactly the
  complaint 869e6rn52 was filed about, for the other block type. Arguably outside the task
  as written, but the two components are explicitly paired and this is where they start to
  drift.
- **Fix**: Thread `scrollLeft` into `DraggableOooBlock` and apply the same
  `paddingLeft: 8 + labelOffset` treatment.
- **Decision**: PENDING

### F7 — Two independent write paths to `time_off`, with the type list copied three times
- **Severity**: OBSERVATION
- **Impact**: MEDIUM
- **Dimension**: Architecture
- **Location**: `src/components/timeline/AllocationModal.tsx:88` vs `TimeOffModal.tsx:51`
- **Detail**: The plan deliberately kept `TimeOffModal` ("this adds a second way in, it does
  not replace the existing one"), so the duplication is intentional — but it is worth
  recording what it costs. There are now two write paths with identical payload shapes, two
  copies of the type-picker JSX, and two hand-maintained type arrays (`AllocationModal.tsx:22`
  `TIME_OFF_TYPES`, `TimeOffModal.tsx:20` `TYPES`) both restating the union already declared
  in `types.ts:65`. Any future rule on the time-off write — an overlap check against
  allocations, an actor stamp mirroring `allocations_set_actor`, a max-duration guard — must
  be added twice or the two entry points diverge for the same table. The array duplication
  is the silent trap: adding a fourth type to `types.ts` leaves both copies stale with no
  compile error.
- **Fix**: Export the list once from `lib/types.ts` (e.g. derived from `TIME_OFF_LABELS`)
  and extract a shared `saveTimeOff()` helper both modals call.
- **Decision**: PENDING

### F8 — The as-built record omits the two largest parts of the diff
- **Severity**: OBSERVATION
- **Impact**: MEDIUM
- **Dimension**: Plan Adherence
- **Location**: `context/changes/allocations-ux-improvements/plan.md:126`, `:186`, `:243`
- **Detail**: Three record-accuracy gaps, consolidated. (a) The P3 contract describes only
  `projectQuery`, `filteredProjects` and the empty state — it never says the native
  `<select required>` was deleted and replaced by a custom list, which is what makes F1
  reachable and what F5 is about. (b) Choosing "Urlop" also removes three whole form
  sections (the status toggle at `:210`, the project picker at `:319`, the hours input at
  `:405`, all gated on `isTimeOff`); this conditional body is the largest single block of
  the AllocationModal diff and appears in neither plan.md nor plan-brief.md. (c) The
  Performance Note misattributes the scroll cost: `setVisibleDate` already returned a fresh
  `Date` on every scroll event, so Timeline re-rendered every time before this change too,
  and `setScrollLeft` is auto-batched into that same render — it adds **zero** extra
  component renders, only one changed inline `paddingLeft` per block. The real cost is
  pre-existing (unmemoized `rowData`, ~729 day cells per person row). What the change
  genuinely costs is optionality: `scrollLeft` needs pixel precision, so `handleScroll` can
  no longer be day-throttled the way the file's own `setResizePreview` guard is.
- **Fix**: Add the control swap and the conditional form body to the Required changes, and
  rewrite the Performance Note to describe the lost throttling rather than a render cost
  that predates the change.
- **Decision**: PENDING

### F9 — The "sticky" half of task 869e6vum3 was neither delivered nor declared
- **Severity**: OBSERVATION
- **Impact**: MEDIUM
- **Dimension**: Scope Discipline
- **Location**: `context/changes/allocations-ux-improvements/plan.md:90`
- **Detail**: `change.md:30` records 869e6vum3 as "Projekty **sticky** / kompaktowe
  stackowanie per osoba (minimalny odstęp, ograniczona wysokość kafelka)". The delivered
  change covers the second half only — `LANE_HEIGHT` 28→24 and `ROW_PADDING` 4→3 give the
  minimal gap and limited tile height. The "sticky" clause is neither implemented nor
  addressed: Phase 2 silently retitles the task "Compact per-person stacking" and "What
  we're NOT doing" does not list it, so the record makes the task look fully delivered.
  P4's label-follows-the-edge behaviour is a plausible reading of "sticky", but it belongs
  to a different task (869e6rn52) and the plan never draws that link.
- **Fix**: Either state in P2 what "sticky" was taken to mean and why it needed no code, or
  list it under "What we're NOT doing" and reopen it with the client.
- **Decision**: PENDING

## Scope check — the five ClickUp tasks

| Task | Status |
|---|---|
| 869e6rn52 (high) — project name visible for earlier-started projects | Delivered; math verified correct incl. the 224 px sticky sidebar. Caveats F3 (during drag) and narrow blocks under 96 px keeping `labelOffset = 0` |
| 869e6vp54 — projekt OR urlop in one popup | Delivered. F1 undermines the sibling validation path |
| 869e5gvne — project searchbar | Delivered: live case-insensitive filter, "Brak wyników" empty state, query reset on open. Caveat F5 |
| 869e5gwa8 — larger margin so names/descriptions don't blend | Delivered nominally; effect halved by margin collapsing (F4) |
| 869e6vum3 — sticky / compact stacking | Half delivered; the "sticky" clause unaddressed and undeclared (F9) |

Nothing delivered falls outside the five requests. The `time_off` insert payload matches
`TimeOffModal`'s shape exactly, and the allocations payload and audit-stamping comment are
untouched, so the plan's "no change to audit stamping" exclusion holds.

## Note carried from the sibling review

`time_off` is not defined in `supabase-schema.sql` or anywhere under `migrations/`, yet two
components now write to it. Pre-existing and not introduced here, but this change adds a
second runtime dependency on an unversioned table. Tracked as F3 in
`context/changes/allocation-edited-by/reviews/impl-review.md`.
