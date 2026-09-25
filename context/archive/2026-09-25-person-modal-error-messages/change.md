---
change_id: person-modal-error-messages
title: PersonModal shows raw Supabase/PostgREST error text to end users
status: archived
created: 2026-09-25
updated: 2026-09-25
archived_at: 2026-09-25T10:26:06Z
---

## Notes

https://github.com/Rocksoft-IT/Rocksoft-planner/issues/75

Found during code review of #72 (pre-existing behavior in the touched submit handler).

In `src/components/people/PersonModal.tsx`, on a save failure the handler does `setError(dbError.message)`, rendering developer-facing text directly in the modal — e.g. `Could not find the 'contract_type' column of 'team_members' in the schema cache`.

The new unconditional `contract_type` write in #72 makes this failure mode newly reachable in normal use (see the deploy-ordering note on that PR), which is why it is worth addressing.

**Suggested fix:** map known DB errors to user-friendly messages and log the raw error separately, instead of surfacing `dbError.message` verbatim. Consider applying the same treatment to the other modals that share this pattern.

Severity: low / non-blocking.

### Issue comments

**koda-guide** (2026-09-25T10:11:48Z):
Koda is working on this issue. A comment with what to check will follow once the work is ready.
