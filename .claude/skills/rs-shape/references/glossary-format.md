# glossary.md format

`context/discovery/glossary.md` is the project's **ubiquitous language** — the
shared vocabulary that lets humans and agents talk about the domain in one
canonical set of terms. Captured inline during the discovery conversation, the
moment a term is resolved or a fuzzy word is sharpened. Never batched.

The biggest payoff: once a term exists here, variables, functions, files, and
future conversations all use it consistently — the codebase gets easier to
navigate and reasoning costs fewer tokens.

## Structure

```md
# {Project} — Glossary

{One or two sentences on what this project is and why this vocabulary exists.}

## Language

**Order**:
A confirmed request for goods placed by a Customer.
_Avoid_: purchase, transaction

**Invoice**:
A request for payment sent to a Customer after delivery.
_Avoid_: bill, payment request

**Customer**:
A person or organization that places Orders.
_Avoid_: client, buyer, account
```

## Rules

- **Be opinionated.** When several words mean the same thing, pick the best one
  and list the rest under `_Avoid_`.
- **Keep definitions tight.** One or two sentences. Define what it IS, not what
  it does.
- **Project-specific terms only.** General programming concepts (timeouts,
  retries, error types, utility patterns) do not belong, even if the project
  uses them heavily. Before adding a term, ask: is this unique to this domain,
  or a general concept? Only the former belongs.
- **Group under subheadings** when natural clusters emerge; a flat list is fine
  for a single cohesive area.

## During discovery

- **Challenge conflicts.** If the user uses a term that contradicts an existing
  definition, call it out: "Your glossary defines 'cancellation' as X, but you
  seem to mean Y — which is it?"
- **Sharpen fuzzy language.** When a word is overloaded, propose a precise
  canonical term: "You're saying 'account' — do you mean the Customer or the
  User? Those are different things."
- **Cross-reference code** (brownfield). If the user states how something works,
  check whether the code agrees and surface contradictions.
