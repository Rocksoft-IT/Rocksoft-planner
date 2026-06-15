---
project: RS Planner
client: Rocksoft
created: 2026-06-15
updated: 2026-06-15
product_type: web-app
target_scale:
  users: small
estimated_effort: (not specified — to be estimated)
---

## Vision & Problem
Rocksoft employees access the internal resource planner (RS Planner) today through a
self-service email/password account they register themselves. That means a separate
password to manage, manual sign-up before anyone can be planned, and no central control
over who can get in or stay in. The pain is felt by every employee at the login moment
("another password"), and by whoever administers the tool, who has no single lever to
grant or revoke access. The cost today is friction at onboarding, orphaned/uncontrolled
accounts, and credentials living outside the company's identity system.

This release makes the company Microsoft identity the single front door: every employee
signs in with the Microsoft account they already have, and access is governed centrally.

## User & Persona
Primary persona: **Rocksoft Employee** — a planned team member (developer, designer, PM)
who needs to see and manage allocations on the timeline. Secondary persona: **Planner
Administrator** — the person responsible for who can use the tool and at what level.

## Access Control
- Employees reach the product by signing in with their **Microsoft (Rocksoft Entra)**
  account. There is no other way in — email/password login, self-registration,
  forgot-password and reset-password are retired.
- Sign-in is restricted to the **Rocksoft Microsoft tenant**; accounts from any other
  tenant or personal Microsoft accounts are rejected.
- A valid Microsoft identity is necessary but **not sufficient**: first-time sign-in
  creates the account in a **pending** state with no access to planner data.
- An **Admin** grants an **access role** to move an account from pending to active.
  Two roles exist today — **Admin** and **Member** — and the model is designed so further
  roles can be added later without rework.
- If a signing-in Microsoft email matches an existing account's email, it is treated as
  the **same person** (linked), preserving their existing profile and data.
- One account is **seeded as Admin** (piotr@rocksoft.pl) so that roles can be granted from
  day one, breaking the chicken-and-egg of an all-pending user base.

## Success Criteria
### Primary
An employee opens RS Planner, clicks "Sign in with Microsoft", authenticates against the
Rocksoft tenant, and — once an Admin has granted them a role — lands on the timeline with
their existing data intact. A brand-new employee completes the same sign-in and sees a
clear "access awaiting approval" screen until an Admin grants a role.

### Secondary
An Admin can view all accounts (pending and active), see each one's access role, and
assign or change a role from within the tool.

### Guardrails
- Existing planner data (people, projects, allocations, time off) must not be lost or
  duplicated when accounts move from password login to Microsoft sign-in.
- A pending account must never be able to read or modify planner data.

## Functional Requirements
- FR-001: Employee can sign in with their Microsoft (Rocksoft Entra) account via a
  "Sign in with Microsoft" button. Priority: must-have
  > Challenge: Is one button enough, or do we need a fallback for someone whose Microsoft
  > account is temporarily unavailable? Decision: no fallback — Microsoft is the sole
  > path; access issues are resolved via IT, not a secondary password.

- FR-002: System restricts sign-in to the Rocksoft Microsoft tenant; identities outside
  the tenant are rejected. Priority: must-have
  > Challenge: Why enforce the tenant if we already match on @rocksoft.pl email? Because
  > email-domain checks are spoofable at the app layer; tenant restriction is enforced by
  > the identity provider and is the stronger guarantee of "employees only".

- FR-003: First-time sign-in auto-creates the employee's account in a pending access
  state. Priority: must-have
  > Challenge: Why auto-create instead of requiring an admin to pre-add the person?
  > Auto-create removes manual provisioning while the pending gate still withholds access,
  > so we get convenience without opening the door.

- FR-004: A pending employee sees an "access awaiting approval" screen and cannot view or
  modify any planner data. Priority: must-have
  > Challenge: Could pending users get read-only access instead? Rejected for this release —
  > the chosen rule is that no access is granted until an Admin acts.

- FR-005: Admin can assign or change an access role (Admin or Member) on any account,
  moving it from pending to active. Priority: must-have
  > Challenge: Should role changes be logged/audited? Out of scope for v1 (see Non-Goals),
  > but the role field should be designed so an audit trail can be added later.

- FR-006: When a Microsoft email matches an existing account's email, sign-in links to
  that same account and profile rather than creating a duplicate. Priority: must-have
  > Challenge: What if two records share an email or the email differs by case? Matching
  > must be case-insensitive and assume one account per email; conflicts surface to an Admin.

- FR-007: Email/password login, self-registration, forgot-password and reset-password
  flows are removed. Priority: must-have
  > Challenge: Does removing password reset strand anyone mid-migration? Existing users are
  > linked by email (FR-006), so they keep their data and simply switch to the Microsoft
  > button; no password recovery is needed once SSO is the only path.

- FR-008: A designated account (piotr@rocksoft.pl) is seeded as Admin so access can be
  granted from the first sign-in onward. Priority: must-have
  > Challenge: What if that account is unavailable? The seed should be data-driven so the
  > designated admin can be changed without a code change.

- FR-009: Admin can view a list of all accounts with their access role and pending/active
  status, to manage who can use the tool. Priority: must-have
  > Challenge: Is a dedicated screen needed, or can role be edited inline on the People
  > view? Either is acceptable; the requirement is that an Admin can see status and assign
  > roles somewhere in the tool.

- FR-010: An active Member can use the planner (timeline, projects, people, allocations,
  time off) per the tool's existing capabilities. Priority: must-have
  > Challenge: Do Members and Admins differ beyond role assignment? For v1 the only
  > guaranteed difference is that Admins manage access roles; finer permission splits are
  > an open question (see Open Questions).

- FR-011: A signed-in employee can sign out, ending their session. Priority: must-have
  > Challenge: Does sign-out also sign them out of Microsoft? No — local session only;
  > the Microsoft session is managed by the identity provider.

## User Stories
### US-01 — Existing employee, first SSO sign-in
- Given I previously had an email/password account and an Admin has since granted my role,
- When I open RS Planner and click "Sign in with Microsoft" and authenticate with my
  Rocksoft account,
- Then I am signed in to the same account as before and see my existing timeline data.

### US-02 — New employee awaiting approval
- Given I have never used RS Planner,
- When I sign in with my Rocksoft Microsoft account for the first time,
- Then my account is created in a pending state and I see an "access awaiting approval"
  screen with no planner data until an Admin grants me a role.

### US-03 — Admin grants access
- Given I am an Admin and a colleague's account is pending,
- When I open the accounts list and assign them the Member role,
- Then their account becomes active and they can use the planner on their next visit.

## Business Logic
Access to the planner is gated by an access role that an administrator must grant; a valid
Rocksoft Microsoft identity by itself confers no access.

The user-visible input is a single "Sign in with Microsoft" action plus, for Admins, the
act of assigning a role to an account. The output is a binary, role-shaped access decision:
pending (no data), Member (use the planner), or Admin (use the planner and manage access
roles). Employees meet this rule at two moments — at first sign-in, where they land on the
pending screen, and on every subsequent visit, where their granted role determines what
they can do.

This is a workflow/validation rule, not generic CRUD: the system does not simply create a
user record on sign-in, it withholds capability until an explicit administrative approval
moves the account through the pending → active transition.

## Non-Functional Requirements
- Sign-in via Microsoft should feel immediate — a redirect-and-return flow completing in a
  couple of seconds under normal conditions.
- Only Rocksoft tenant identities can ever reach planner data; the tenant boundary is the
  primary access guarantee.
- The tool should be available to employees during working hours on a par with its current
  availability; SSO must not introduce a new single point of prolonged downtime beyond the
  identity provider's own availability.
- Works on the desktop browsers employees already use for the planner; no new device
  requirements.
- No employee passwords are stored or handled by the tool once SSO is the only login.

## Non-Goals
- Automatic deprovisioning / offboarding (disabling accounts when someone leaves Entra) —
  v1 relies on tenant restriction plus manual role removal; lifecycle automation is later.
- Mapping Entra groups to access roles automatically — roles are assigned manually in-app.
- External guests, contractors outside the tenant, or multi-tenant access — explicitly
  excluded; this release is "employees only".
- Fine-grained, per-project or per-resource permissions — the role model stays coarse
  (Admin/Member) for v1.
- Self-service access requests or approval notifications/emails — an Admin checks and
  grants; no request workflow.
- Audit logging of role changes — designed to be addable later, not built now.

## Glossary
- **Microsoft SSO** — signing in to RS Planner with a Rocksoft Microsoft (Entra) identity;
  the sole authentication method. Avoid: "social login".
- **Rocksoft tenant** — the company's Microsoft Entra directory; the only directory whose
  identities may sign in.
- **Access role** — the in-app permission level granted to an account: Admin or Member
  (extensible). Avoid: confusing with "Job role".
- **Job role** — the existing free-text descriptor of what a person does (e.g. "Developer")
  shown in the planner; unrelated to access. Avoid: "role" used unqualified.
- **Pending account** — an account that has signed in but has no access role yet and cannot
  see planner data.
- **Active account** — an account that has been granted an access role and can use the tool.
- **Seeded admin** — the pre-designated account that holds the Admin role from day one so
  access can be granted to everyone else.
- **Profile** — the existing per-person record (name, job role, capacity, avatar) that an
  account is linked to.

## Open Questions
- Beyond managing access roles, do Members and Admins differ in what they can edit
  (projects, other people's allocations)? Current data access is flat for all signed-in
  users; the desired Member/Admin split needs deciding.
- Offboarding: when an employee leaves, what should happen to their account and their
  historical allocations (disable vs. retain vs. anonymise)?
- Rough effort estimate for the release — not yet provided.

## Forward: tech-stack
Volunteered/observed stack context (not a commitment, for the build phase):
- Auth is Supabase (`@supabase/ssr`); Microsoft SSO maps to Supabase's Azure (Entra) OAuth
  provider via `signInWithOAuth({ provider: 'azure' })`, restricted to the Rocksoft tenant.
- The existing `auth/callback/route.ts` already performs `exchangeCodeForSession`, so the
  OAuth code-exchange path is largely in place.
- The `proxy.ts` route guard and the `profiles` table (which already has `is_admin` and a
  trigger that auto-creates a profile on signup) are the natural places for the pending
  state and access-role model; expect a new column/concept for access role + status and
  updated RLS policies, plus removal of the password auth pages.
