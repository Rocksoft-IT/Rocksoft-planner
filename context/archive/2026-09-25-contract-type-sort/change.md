---
change_id: contract-type-sort
title: Team members have a contract type and the timeline can sort by it
status: archived
created: 2026-09-25
updated: 2026-09-25
archived_at: 2026-09-25T10:38:01Z
---

## Notes

https://github.com/Rocksoft-IT/Rocksoft-planner/issues/71

## Summary

Add a contract type to team members — **UoP**, **B2B** or **Freelance** — set from the
team member's profile, and let the Timeline view sort people by contract type.

## Problem & context

- **Current system:** Team members live in `team_members` and are edited in the person
  modal on the People page (full name, role/"Stanowisko", email, capacity, avatar color).
  There is no notion of contract type. The Timeline lists people always alphabetically
  by full name and offers filters (people, projects, skills, roles) but no sort control.
- **Need:** Planners want to see people grouped by how they are engaged (employment
  contract vs. B2B vs. freelance) when looking at the timeline.

## Scope

### In scope

1. A user opens a team member's profile (People → person modal) and picks a contract
   type: UoP, B2B, Freelance, or leaves it empty.
2. The user saves; the contract type is stored on the team member.
3. On the Timeline, the user switches the people sort from "Name" to "Contract type".
4. People are listed UoP → B2B → Freelance → no contract type; alphabetically by full
   name within each group.
5. The user switches back to "Name" and gets today's alphabetical order.

### Out of scope (non-goals)

- Showing the contract type anywhere else (timeline row badge, People list) — only the
  profile and the sort use it.
- Filtering the timeline by contract type — sorting only.
- Group headers/section separators on the timeline.
- Remembering the chosen sort across page reloads.
- Any new permission rules for this field.
- Contract details (dates, rates, history of contract changes).

## Success criteria

- **Primary:** A planner sets contract types on a few people and, with "Contract type"
  sort on, sees them in UoP → B2B → Freelance → unset order on the timeline.
- **Guardrails:** Existing people without a contract type keep working everywhere;
  default timeline order and all existing filters behave exactly as today.

## Requirements

- FR-001: A user can set a team member's contract type to UoP, B2B or Freelance, or
  leave it unset, from the team member's profile. Priority: must-have. Change: new
- FR-002: A user can change or clear a previously set contract type. Priority: must-have. Change: new
- FR-003: A user can switch the Timeline people order between "Name" (default) and
  "Contract type". Priority: must-have. Change: new
- FR-004: With "Contract type" sort, people are ordered UoP → B2B → Freelance → unset,
  alphabetically by full name within each group. Priority: must-have. Change: new
- FR-005: A user can still filter the Timeline by people, projects, skills and roles,
  and filters combine with the chosen sort. Priority: must-have. Change: preserved
- FR-006: A user can still create and edit team members without choosing a contract
  type. Priority: must-have. Change: preserved

## Acceptance criteria

### AC-01: Set contract type in profile

- **Given** a team member with no contract type
- **When** the user opens their profile, selects "B2B" and saves
- **Then** reopening the profile shows "B2B"

### AC-02: Sort timeline by contract type

- **Given** people Anna (Freelance), Bartek (UoP), Celina (B2B), Damian (UoP), Ewa (no type)
- **When** the user switches the Timeline sort to "Contract type"
- **Then** the rows appear as Bartek, Damian, Celina, Anna, Ewa

### AC-03: Default order unchanged

- **Given** the Timeline is opened
- **When** the user has not touched the sort control
- **Then** people are listed alphabetically by full name, as today

### AC-04: Sort combined with filters

- **Given** "Contract type" sort is on and a role filter is applied
- **When** the timeline renders
- **Then** only the filtered people are shown, still in contract-type order

### AC-05: Clearing the contract type

- **Given** a team member with contract type "UoP"
- **When** the user clears the field and saves
- **Then** the member has no contract type and sorts in the "no type" group

## Constraints & preserved behavior

- Existing `team_members` rows must remain valid with no contract type (nullable; no
  backfill required). Schema change delivered as a migration in `migrations/`, and
  `supabase-schema.sql` kept in sync.
- Permissions unchanged: whoever can edit a team member's profile today can set the
  contract type; everyone who can see team members can see it.
- Existing timeline filters, drag-and-drop, and allocation behavior unchanged.

## Glossary

**Contract type**: How a team member is engaged: UoP (Polish employment contract,
"umowa o pracę"), B2B (business-to-business contract), or Freelance. _Avoid_: employment
type, agreement type

## Metadata

- **Client:** jan.gabzdyl@rocksoft.pl
- **Repository:** Rocksoft-planner (https://github.com/Rocksoft-IT/Rocksoft-planner)
- **Track:** feature
