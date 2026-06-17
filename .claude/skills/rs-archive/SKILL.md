---
name: rs-archive
description: >
  Archive a completed change by moving its folder into context/archive/ and
  stamping change.md with archived status, preserving git history with git mv. If
  the roadmap has a slice whose Change ID matches, also closes it (flips its
  Status to done and adds a Done entry). The gate is lenient and warning-only: it
  hard-blocks only on uncommitted changes; everything else is a warning plus a
  confirmation. Use AFTER rs-impl_review, when a change is done. Trigger phrases:
  "archive this change", "close out <change-id>", "mark this done and archive".
argument-hint: "<change-id-or-path>"
allowed-tools:
  - Read
  - Glob
  - Edit
  - Bash
  - AskUserQuestion
---

# rs-archive: Close out a completed change

Close a finished change and close the loop on the roadmap:
`rs-implement → rs-impl_review → rs-archive`. It moves
`context/changes/<change-id>/` to `context/archive/<created-date>-<change-id>/`,
stamps `change.md`, preserves history with `git mv`, and — if
`context/foundation/roadmap.md` has a slice whose `Change ID` equals
`<change-id>` — flips that slice to `done` and records it under `## Done`.

The gate is **lenient, warning-only**: it hard-blocks only on uncommitted work;
incomplete progress, a missing review, or an unexpected status are warnings with
a confirmation prompt. Archived folders are read-only by convention.

## Inputs

- **`context/changes/<change-id>/change.md`** — `status`, `created`.
- **`context/changes/<change-id>/plan.md`** `## Progress` *(if present)* — for
  pending-progress and SHA-less checks.
- **`context/changes/<change-id>/reviews/impl-review*.md`** *(glob)* — for the
  missing-review check.
- **`context/foundation/roadmap.md`** *(if present)* — for slice closure.

## Outputs / mutations

- **Folder move:** `context/changes/<change-id>/` →
  `context/archive/<CREATED>-<change-id>/`, where `CREATED` is the `created:` date
  from `change.md`. Prefer `git mv` (history preserved); fall back to `mkdir -p
  context/archive && mv` with a warning. If the destination already exists, error
  and STOP.
- **`change.md` stamp** (in place, before the move): `status: archived`;
  `archived_at: <ISO-8601 UTC>` (`date -u +"%Y-%m-%dT%H:%M:%SZ"`); `updated:
  <today>`. Leave `created` and `change_id` unchanged.
- **Roadmap closure** (best-effort; never blocks or rolls back): in `## At a
  glance` set the slice's Status cell to `done`; in the slice body rewrite
  `- **Status:** …` to `done`; append one bullet under `## Done` (creating the
  heading if absent); bump roadmap frontmatter `updated:`.
- **Archive commit:** a single `chore(archive): close <change-id>` (no body).
  Never `--no-verify`. Skipped if git is unavailable.

## Argument parsing

One form: `<change-id-or-path>`. Take the first token; strip a leading `@`, strip
a trailing `/`, and if it still contains `/` take the last path segment →
`<change-id>`.

## Process

1. **Initial response.** No argument → print usage and STOP. Else parse the
   argument → `<change-id>`.
2. **Resolve.** Resolve to `context/changes/<change-id>/`. If missing, check
   `context/archive/` for a dir ending `-<change-id>` ("already archived at
   <path>", STOP) else error STOP. Read `change.md`: if already `status:
   archived` → error STOP; if `created` missing/malformed → error STOP.
3. **Hard refusal — uncommitted work** (each blocks, no prompt): `git status
   --porcelain context/changes/<change-id>/` non-empty → block; `git diff
   --cached --quiet` non-zero (pre-existing staged changes) → block. Not a git
   repo → warn and continue.
4. **Soft warnings** (queue all, then one prompt): status not in `{implemented,
   impl_reviewed}`; pending `## Progress` items (Automated/Manual aware); missing
   impl-review; `[x]` rows without a ` — <sha>` suffix. (If the only pending
   items are manual, append "(Recommended)" to the Continue label.)
5. **Fork** (skip if no warnings): **Continue archiving** → step 6; **Resume
   implementation** → print and clipboard-copy `rs-implement <change-id>`, STOP;
   **Cancel** → STOP.
6. **Move & stamp.** Compute DEST; stamp `change.md`; move the folder (`git mv`);
   `git add` the moved `change.md`; close the matching roadmap slice; make the
   archive commit; print confirmation and suggest `rs-init`/a new change for
   next work.

## Critical guardrails

1. **Lenient gate.** Hard-block only on uncommitted changes in the change folder
   and pre-existing staged changes; everything else is a warning + confirmation.
2. **Preserve history.** Prefer `git mv`; the `change.md` stamp lands in the same
   commit as the rename.
3. **Does NOT:** add SHAs to Progress (that's `rs-implement`), run tests/build as
   a gate, push, rewrite the roadmap beyond closing one matched slice, or write
   under `context/archive/` after the move.
4. **Roadmap closure is isolated.** Failures there are caught, noted, and
   skipped — never block or roll back the archive.
5. **No rollback.** `change.md` edits mark intent; a partial state (stamped but
   not moved) is safely recoverable by re-running — resolution detects `status:
   archived` and asks the user to inspect.
6. **Never `--no-verify`.** If a pre-commit hook fails, fix the cause and make a
   new commit.

## Notes

- Status lifecycle this closes: `implemented`/`impl_reviewed` → `archived`
  (+ `archived_at`); the matching roadmap slice → `done`.
- Archived changes are read-only; to revisit one, start a new change and
  reference the archived folder.
