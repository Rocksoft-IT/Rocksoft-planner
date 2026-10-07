# Fix round 1 - increment 3 (theme-preference)

Findings fixed: F1, F2. F3, F4 ACCEPT, untouched.

- F1: `min-h-full light:bg-slate-50` on the root div of `PeopleClient.tsx` and `ProjectsClient.tsx` (per-page, not `layout.tsx`, per orchestrator decision: file-disjoint with increments 2/4).
- F2: `light:text-slate-800!` on the Active badge in `ProjectsClient.tsx`; the inline tint and `project.color` are unchanged (important modifier needed to beat the inline `style` colour).

## Verification
- `npm run build` - exit 0 (all routes compiled).
- Generated CSS contains both classes: `.light\:bg-slate-50:where(.light,.light *){background-color:var(--color-slate-50)}` and `.light\:text-slate-800\!:where(.light,.light *){color:var(--color-slate-800)!important}`.
- `npx eslint` on the two files: 0 errors, 1 pre-existing warning (`PeopleClient.tsx:103`).
- `npm run lint`: 4 errors + 3 warnings, identical to the baseline in the review report (none in touched lines).
- `npm test` (vitest run): 2 files, 13 tests passed; no new failures.
- Red-first proof: not applicable, class-only styling change with no testable behaviour (no test covers these pages); the generated-CSS check above is the proof the variants resolve.
- Manual 8.3 / 9.3 remain pending (human on preview).
