# tech-stack.md template (per project)

Defines the shape of `context/foundation/tech-stack.md` produced by `rs-init`. It
describes the **actual stack of one project**, chosen from `tech-palette.md`
(greenfield) or detected from the working directory (brownfield). Unknown axes go
to `## Open Stack Questions` as TODO — never invented.

The PRD stays stack-open; this file is where the stack lives. The build step
reads both: the PRD for *what*, this file for *how we build it*.

## Frontmatter

```yaml
---
project: <string>            # mirrors PRD/discovery project name
context_type: <enum>         # greenfield | brownfield
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>        # bumped on edit-in-place
source: <enum>               # picked-from-palette | detected-from-cwd
---
```

## Sections

Only include lines that apply to the project. Omit a whole category if the
project does not use it (e.g. no `## Infrastructure & Deploy` if there is none),
rather than writing "none".

```md
# <Project> — Tech Stack

## Languages & Runtimes
- <language + version, e.g. "PHP 8.3", "Node 20 (pnpm)", "Python 3.12", ".NET 8">

## Frontend
- Framework: <Astro | Vue | React | Next>
- Styling: <Tailwind CSS | UnoCSS>

## Backend
- <Laravel | Filament | Python framework | .NET stack | plain PHP>

## Data & Storage
- Database: <PostgreSQL (default) | MySQL/MariaDB | SQLite>

## Infrastructure & Deploy
- IaC: <Terraform, if used>
- Packaging: <Docker, if used>
- Deploy target: <chosen VPS/cloud target, or `# TODO: deploy target — see Open Stack Questions`>

## Testing
- E2E: <Playwright, if used>
- Unit (PHP): <PHPUnit, if used>
- Unit (JS/TS): <Vitest (default)>

## CI/CD
- <GitHub Actions (default) | GitLab CI/CD | Azure DevOps Pipelines | Bitbucket Pipelines>

## Issue Tracker
- <GitHub Issues (default) | Linear | Jira | GitLab Issues | Local markdown (.scratch/)>

## Tooling
- Package manager (JS): <pnpm>
- <other project tooling>

## Open Stack Questions
1. **<unknown axis>** — <why it's open / who decides>. e.g. "Database not chosen yet — pin before first migration."
```

## Rules

- **Pick from the palette.** Every entry should come from `tech-palette.md`. If a
  project genuinely needs something off-palette, record it AND note it as a
  deviation so the palette can be reconsidered later.
- **Per-project axes have defaults but get confirmed.** Database, Python
  framework, .NET stack, JS unit runner, and deploy target each have a house
  default in `tech-palette.md`. Confirm or override per project. Only the deploy
  target's concrete VPS/cloud value is genuinely open — if undecided, it goes to
  `## Open Stack Questions`, not a guessed value.
- **Edit-in-place.** When the stack evolves (a new dependency, a swapped tool),
  edit this file and bump `updated:`. Don't create dated copies.
