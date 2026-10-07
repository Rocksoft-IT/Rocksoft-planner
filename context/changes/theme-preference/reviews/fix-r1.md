# Fix round 1 - Increment 4

Finding fixed: F1 (Kompetencje page canvas stays dark in light mode). Per orchestrator decision the fix is per-page, not in `layout.tsx`.

Change: `src/app/(dashboard)/competencies/CompetenciesClient.tsx` - the page root is now `<div className="min-h-full light:bg-slate-50">` wrapping the original `max-w-3xl` container (mirrors Timeline's pattern). No unprefixed class changed, so the dark theme is unchanged.

## Verification
- `npm run build` - exit 0, all routes listed.
- `npm run lint` - 7 problems (4 errors, 3 warnings), identical to the round-1 baseline, all in files outside this increment; `npx eslint` on `CompetenciesClient.tsx` alone - exit 0, clean.
- `npm test` (full suite) - 2 files, 13 tests passed, no failures (baseline: no failures).
- Red-first proof: not applicable. The change is a presentation-only Tailwind class on a wrapper; there is no test that can observe it (no new or changed tests).
- `git diff --stat -- src/app/api mcp` - empty (10.3 still holds).
- Manual 10.4 remains `[ ]` (visual check on the preview).

F2 was ACCEPT, left untouched.
