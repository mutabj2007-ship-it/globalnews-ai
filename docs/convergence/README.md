# docs/convergence — Whole-Product Convergence R1

The single, measurable capability record for GlobalNewsAI. It replaces per-lane status claims.

**Start with:** `01-WHOLE-PRODUCT-INVENTORY.md` (answers and P0s), then `09-ALPHA-ACCEPTANCE-MATRIX.md` (the finish line) and `status.json` (roll-up).

| File | Purpose |
|---|---|
| 01-WHOLE-PRODUCT-INVENTORY.md | Stage 0 answers, P0s, baseline, workstreams, what couldn't be measured |
| 02-GLOBAL-CAPABILITY-REGISTRY.json / .md | 33 capabilities × every contract field (generated) |
| 03-LANGUAGE-CAPABILITY-MATRIX.md | Seven-locale system measurement |
| 04-FRONTEND-ROUTE-REGISTRY.md | Every route, classified (table generated) |
| 05-BACKEND-MODULE-REGISTRY.md | Every backend module, classified (table generated) |
| 06-SHARED-SEARCH-BINDING-MATRIX.md | One-engine check, domain binding, negative controls |
| 07-SOURCE-ADMISSION-REGISTRY.json | 348 source records (generated) |
| 08-SOURCE-COVERAGE-MATRIX.md | 54 priority countries (table generated) |
| 09-ALPHA-ACCEPTANCE-MATRIX.md | Acceptance matrix + seven-locale journey (table generated) |
| 10-PRODUCTION-BLOCKERS.md | P0–P3 gap classification (table generated) |
| 11-WHOLE-PRODUCT-ROADMAP.md | Tranches T1–T15 with measurable exits |
| 12-INTEGRATION-DECISIONS.md | Decision log + open questions |
| 13-ROLLBACK-REGISTRY.md | Release / rollback refs |
| east-africa/EA-CAPABILITY-REGISTER.md / .json | East Africa contract (2026-10-05): the seven contract statuses (IMPLEMENTED, TESTED, DEPLOYED, ENABLED, LIVE_VERIFIED, BLOCKED, NOT_IMPLEMENTED) per capability above, derived from 02 + evidence overrides (generated) |
| east-africa/EA-FINDING-LEDGER.md | East Africa finding-to-fix ledger: commit, tests, migration, deployed and live state, remaining blocker (generated) |
| stage0/ | Raw measurements at `5513275f` (JSON) |
| tools/ | `capabilities.source.py` (hand-edited truth) and `render.py` (regenerates everything); `ea-register.mjs` regenerates `east-africa/` from 02 + `east-africa/ea-register.source.json` (hand-edited truth). Run `render.py` first when 02 changes. |

## Updating after a tranche

1. Re-measure the affected area and update `stage0/*.json`, or edit cells in `tools/capabilities.source.py` with new evidence.
2. Run `python3 docs/convergence/tools/render.py`. It validates states, cells and blockers, and rewrites the generated sections and `status.json`.
3. Commit the diff. `status.json` shows movement toward the finish line.
