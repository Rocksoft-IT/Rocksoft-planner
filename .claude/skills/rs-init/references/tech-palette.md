# Tech palette (house standard)

The canonical menu of technologies this team works with. `rs-init` reads this to
generate a per-project `context/foundation/tech-stack.md`: a project picks a
**subset** from this palette (greenfield) or has its stack detected from the
working directory and mapped back onto this palette (brownfield).

This is a palette, not a single fixed stack. Different projects use different
subsets — one is Astro + Laravel, another is Python, another .NET. The point is
that the choices come from a known, preferred set rather than an open universe.

Editing this file changes the menu for all future `rs-init` runs.

## Frontend frameworks

- **Astro** — content-driven sites, MPA-first, islands.
- **Vue** — interactive SPA/components.
- **React** — interactive SPA/components.
- **Next** — React meta-framework (SSR/RSC, full-stack React apps).

## PHP backend

- **PHP** — base language.
- **Laravel** — primary PHP framework.
- **Filament** — Laravel dashboard / admin-panel framework (https://filamentphp.com/);
  builds admin UIs, resources, and internal tooling on top of Laravel.

## Other backend languages

- **Python** — services, data, scripting. Default web framework: **FastAPI**
  (APIs/services); **Django** for full apps that want a built-in ORM + admin.
- **.NET** — services / apps. Default stack: **ASP.NET Core** (web APIs/apps)
  with **EF Core** for data access.

## Data & storage

- **PostgreSQL** — default relational database.
- **MySQL / MariaDB** — alternative relational database (common with Laravel).
- **SQLite** — local development and tests; small single-file apps.

Pick one primary database per project; SQLite is fine for local/test even when
the production database differs.

## Styling

- **Tailwind CSS** — utility-first CSS.
- **UnoCSS** — atomic CSS engine (alternative to Tailwind).

Pick one per project unless there is a reason to run both.

## JS tooling

- **pnpm** — package manager for all JS/TS projects (default over npm/yarn).

## Infrastructure as Code

- **Terraform** — provisioning / IaC.

## Testing

- **Playwright** — end-to-end / browser tests (any frontend).
- **PHPUnit** — PHP unit/feature tests (Laravel).
- **Vitest** — JS/TS unit tests (default runner).

## Infrastructure, hosting & deploy

- **Terraform** — provisioning / IaC (also listed above).
- **Docker** — default packaging for deployable services.
- **Deploy target** — Docker images onto a Terraform-provisioned target. The
  concrete target (VPS vs cloud provider) is pinned per project — confirm or set
  it in `tech-stack.md`; if unknown at init time it goes to Open Stack Questions.

## Issue tracker

Where work lives — read/written by any downstream "break PRD into issues" or
triage step. Not a runtime tech, but a per-project tool the workflow needs.

- **GitHub Issues** — default (GitHub-hosted projects).
- **Linear** — when the team tracks work in Linear.
- **Jira** — when the team tracks work in Jira.
- **GitLab Issues** — when the repo lives on GitLab.
- **Local markdown** — lightweight `.scratch/` convention; no external tracker.

Default to GitHub Issues; match to wherever the team actually tracks work.

## CI/CD

- **GitHub Actions** — default CI/CD (GitHub-hosted projects).
- **GitLab CI/CD** — when the repo lives on GitLab.
- **Azure DevOps Pipelines** — alternative, fits .NET-centric projects.
- **Bitbucket Pipelines** — when the repo lives on Bitbucket.

Default to GitHub Actions; match the CI to wherever the repo is hosted.

## Per-project choices

These have a house default above but vary by project — `rs-init` confirms them
(greenfield) or detects them (brownfield), and the chosen value is recorded in
`tech-stack.md`. Only a genuinely undecided axis lands in `## Open Stack
Questions` as TODO; never invent a value the user rejected.

- **Database** — default PostgreSQL; MySQL/MariaDB or SQLite per project.
- **Python web framework** — default FastAPI; Django when its batteries help.
- **.NET stack** — default ASP.NET Core + EF Core.
- **JS/TS unit runner** — default Vitest.
- **Deploy target** — Docker + Terraform; concrete VPS/cloud target per project.
- **CI/CD** — default GitHub Actions; match to the repo host (GitLab, Azure
  DevOps, Bitbucket).
- **Issue tracker** — default GitHub Issues; match to where the team tracks work
  (Linear, Jira, GitLab Issues, local markdown).
