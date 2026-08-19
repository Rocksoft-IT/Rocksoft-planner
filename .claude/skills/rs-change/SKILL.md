---
name: rs-change
description: >
  Initialize a new change folder under context/changes/<change-id> with a
  change.md identity file. A "change" is one unit of work end to end — research,
  framing, planning, implementation, and review all live in one folder keyed by
  <change-id>. Use to start a new piece of work before planning. Trigger phrases:
  "new change", "start a change", "open a change folder", "begin <change-id>".
argument-hint: "<change-id-or-path> [freeform intent]"
allowed-tools:
  - Read
  - Glob
  - Write
  - Bash
  - AskUserQuestion
---

# rs-change: Start a new change

Open a new change folder at `context/changes/<change-id>/` with a small identity
file (`change.md`) and point the user to the next skill. A change is a single
unit of work; its research, frame, plan, reviews, and other artifacts all live in
this one folder.

## Initial response

If an argument is given, parse it (below) and go to Validation. If none, print:

```
I'll create a new change folder. Please provide a change-id (kebab-case slug):

Examples:
  rs-change context-dir-restructure
  rs-change oauth-login add Google sign-in so users skip the email-password step
  rs-change @context/changes/oauth-login/

The first token becomes the change-id. Anything after it is freeform intent —
used to write a richer title and to pick the next-step suggestion. Path-style
references (with or without a leading @) are accepted; the last path segment is
used as the change-id.

The change-id must be kebab-case and unique across context/changes/ and
context/archive/.
```

Then wait.

## Argument parsing

Split on the first whitespace:

- **First token** = the change-id reference. Normalize: strip a leading `@`,
  strip a trailing `/`, and if it still contains `/` take the last path segment.
- **Everything after** = freeform intent (may be empty). A hint for the title and
  the next-step suggestion — NOT a literal title to paste whole.

## Validation

1. **Kebab-case:** `<change-id>` must match `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`. Else
   print `error: change-id "<id>" is not kebab-case…` and STOP.
2. **Uniqueness:** neither `context/changes/<change-id>/` nor an
   `context/archive/*-<change-id>/` may exist. On collision print `error: change
   "<id>" already exists at <path>…` and STOP.
3. **Parent exists:** `context/changes/` must exist (run `rs-init` if not). Do NOT
   auto-create the parent.

## Creation

1. `mkdir -p context/changes/<change-id>/`.
2. Derive `<title>`: empty intent → humanize the change-id (hyphens → spaces,
   sentence case). Non-empty intent → a concise ≤80-char sentence-case title that
   captures the essence (rephrase freely; don't dump a paragraph). **Always write
   `title` in English** — `change.md` is the canonical change-identity file, so if
   the intent (or the source issue / roadmap entry) is in another language,
   translate it to English. (`change_id` is already English kebab-case.)
3. Derive the `## Notes` body: empty intent → the hint comment `<!-- Free-form
   notes for this change: links, ad-hoc context, decisions that don't belong in
   research/frame/plan. -->`. Non-empty intent → paste the user's words verbatim
   as the Notes body (no hint comment).
4. Write `context/changes/<change-id>/change.md` exactly:

```markdown
---
change_id: <change-id>
title: <title>
status: new
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
archived_at: null
---

## Notes

<notes-body>
```

`<YYYY-MM-DD>` is today (`date +%Y-%m-%d`).

## Next-step suggestion

Default next step is `rs-plan <change-id>` — most changes go straight to planning.
The two situational options: `rs-research <change-id>` when the intent suggests
the change needs significant codebase exploration before a plan can be written;
`rs-frame <change-id>` when the intent signals the framing is suspect — a bug
shape ("fix", "bug", "broken", "root cause", "regression") or a scope/design
shape ("should we even", "is this the right", "rethink", "challenge the
assumption"). Pick a situational option only when the signal is clear; otherwise
default to `rs-plan`. Copy the chosen command to the clipboard and print:

```
✓ Created context/changes/<change-id>/change.md (status: new)

Next step:
  → <NEXT_CMD>  (✓ copied to clipboard)

Other options:
  rs-research <change-id>   — explore the codebase first (when planning needs grounding)
  rs-frame <change-id>      — challenge the framing first (bug+fix stated as one, or unclear scope)
```

## What this skill does NOT do

- It does not write `frame.md`, `research.md`, or `plan.md` — those come from
  their own skills.
- It does not write any sidecar state file; `## Progress` in `plan.md` is the
  single source of execution state.
- It does not enforce status transitions; `change.md` is append-friendly identity.
- It does not create the `context/changes/` parent — run `rs-init` if it's missing.
