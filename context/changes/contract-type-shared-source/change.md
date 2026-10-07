---
change_id: contract-type-shared-source
title: Contract-type allowed values duplicated across TS and SQL (no shared source)
status: planned
created: 2026-10-07
updated: 2026-10-07
archived_at: null
---

## Notes

https://github.com/Rocksoft-IT/Rocksoft-planner/issues/73

Follow-up from code review of #72.

The allowed contract-type set `'UoP' / 'B2B' / 'Freelance'` is hand-copied in three places with no shared source:

- `src/lib/types.ts` — `CONTRACT_TYPES`
- `migrations/2026-09-25-team-member-contract-type.sql` — CHECK constraint
- `supabase-schema.sql` — CHECK constraint

**Risk:** adding/removing a value in one place but not the CHECK constraints makes the DB reject a value the UI happily offers, surfacing as a cryptic save error. There is no test asserting the TS union equals the SQL constraint set.

**Suggested fix:** at minimum add a parity test asserting `CONTRACT_TYPES` matches the SQL CHECK values, or derive one from the other.

Severity: low / non-blocking.

### Issue comments

(Only bot comments by koda-guide; omitted.)
