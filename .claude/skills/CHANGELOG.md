# rs-skills Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-06-16

### Removed
- Removed time estimate questions from discovery workflow
  - Removed `estimated_effort` field from discovery-notes schema
  - Removed effort estimation from rs-shape skill
  - Removed estimated_effort from PRD schema and generation
  - Removed Estimated effort column from plan-brief template

### Why
Estimation is unnecessary when working on different tasks and adds friction to the workflow. The discovery process focuses on product definition, not timeline predictions.

### Migration
If your projects have existing discovery-notes files with `estimated_effort` field, they can remain unchanged — the field is simply no longer requested during `rs-shape`. Existing PRD files will not be affected.

### Skills Affected
- `rs-shape` — no longer asks for rough time estimate
- `rs-prd` — no longer copies/validates estimated_effort field
- `rs-plan` — plan-brief template no longer includes effort column

---

## [0.1.0] - 2026-05-XX

### Added
- Initial release of rs-skills plugin
- 12 skills: rs-init, rs-shape, rs-prd, rs-roadmap, rs-new, rs-research, rs-frame, rs-plan, rs-implement, rs-impl-review, rs-archive, rs-test-plan
- Full discovery → planning → implementation → review workflow
- Greenfield and brownfield support
- Risk-driven test planning via rs-test-plan
