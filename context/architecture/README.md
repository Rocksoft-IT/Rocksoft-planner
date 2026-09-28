# Architecture

The living architecture model of this repo, in [LikeC4](https://likec4.dev).
Written by `rs-arch-map`, enforced on every diff by `rs-arch-audit`.

| File | What | Who edits |
|---|---|---|
| `model.c4` | capabilities, domains, what each owns, relationships | rs-arch-map and humans |
| `specification.c4` | element kinds and tags (the policy's vocabulary) | nobody, copied from rs-skills |
| `views.c4` | diagrams | rs-arch-map and humans |
| `metrics.generated.c4` | churn, coverage and orphan overlay | scripts only |
| `findings.md` | numbered issues to address (AR-NNN) | rs-arch-map; humans set accepted / wontfix |
| `snapshots/`, `reviews/` | history of each run | rs-arch-map |

## View it

```bash
npx likec4@1.59.4 start context/architecture      # live diagrams in the browser
npx likec4@1.59.4 gen mermaid context/architecture -o /tmp/arch   # Mermaid for a PR
```

A shareable page with the map, the risk ranking and the findings:
`rs-arch-map --report client` (in the client's language) or `--report team`,
written to `reports/`.

The `boundaries` view shows core capabilities (green), business domains
(amber) and externals; `#hot` elements are red, `#untested` ones dashed.

## The rules

Domains (plugins) never depend on each other; they use core capabilities only
through each capability's `interface`; core never depends on a domain. A
crossing that must exist anyway is a relationship tagged `#exception` with
`reason`, `decided` and `expires` metadata, added by a human.
