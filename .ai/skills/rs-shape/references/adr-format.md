# ADR format

Architecture Decision Records live in `context/discovery/decisions/` with
sequential numbering: `0001-<slug>.md`, `0002-<slug>.md`, etc. Create the folder
lazily — only when the first ADR is needed.

## Template

```md
# {Short title of the decision}

{1–3 sentences: the context, what we decided, and why.}
```

That's it. An ADR can be a single paragraph. The value is recording *that* a
decision was made and *why* — not filling out sections.

## Optional sections

Include only when they add real value; most ADRs won't need them.

- **Status** frontmatter (`proposed | accepted | deprecated | superseded by
  ADR-NNNN`) — useful when decisions get revisited.
- **Considered Options** — only when the rejected alternatives are worth
  remembering.
- **Consequences** — only when non-obvious downstream effects need calling out.

## Numbering

Scan `context/discovery/decisions/` for the highest existing number and
increment by one.

## When to offer an ADR

All three must be true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful.
2. **Surprising without context** — a future reader will look at the result and
   wonder "why on earth did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and one
   was picked for specific reasons.

If a decision is easy to reverse, skip it — you'll just reverse it. If it's not
surprising, nobody will wonder why. If there was no real alternative, there's
nothing to record beyond "we did the obvious thing."

### What qualifies

- **Architectural shape.** "Monorepo." "Write model is event-sourced, read model
  projected into Postgres."
- **Integration patterns.** "Ordering and Billing communicate via domain events,
  not synchronous HTTP."
- **Technology choices with lock-in.** Database, message bus, auth provider,
  deployment target — the ones that would take a quarter to swap, not every
  library.
- **Boundary and scope decisions.** "Customer data is owned by the Customer
  context; others reference it by ID only." The explicit no-s matter as much as
  the yes-s.
- **Deliberate deviations from the obvious path.** "Manual SQL instead of an ORM
  because X." Anything a reasonable reader would assume the opposite of — it
  stops the next engineer from "fixing" something deliberate.
- **Constraints not visible in the code.** "Can't use AWS due to compliance."
  "Response times must be under 200ms because of a partner API contract."

> Note for discovery: most ADRs surface in brownfield sessions, where the
> existing system forces real trade-offs. In greenfield, stay stack-open — an
> ADR that commits to a framework or database is premature during discovery.
> Capture those as `## Forward: tech-stack` notes instead.
