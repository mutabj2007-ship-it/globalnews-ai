# 12 — Integration Decisions

> **Stage 2 runtime correction (2026-10-04, CTO contract R2).** Railway runtime authority replaces the Git-derived Production assumption below:
> - **Alpha:** backend and frontend at `5513275f` (SUCCESS); live root is platform Home (`GNA_PUBLIC_ROOT` configured); Ask V2 active for signed-in users; guest trial **OFF by design** during controlled acceptance (not a defect).
> - **Production:** backend `5b714833`, frontend `58f80fd4` (SUCCESS). Strict ancestors of Alpha, 85 and 84 commits behind. Not `release/production-c908`.
> - **Production flags are not inferred; Production stays HOLD.**
>
> Registries (02, 09, 10, `status.json`) are regenerated with these facts. See `stage2/STAGE2-REPORT.md`.

A decision log for the convergence programme. Each entry states the decision, the evidence behind it, and who must ratify it. Entries marked **ADOPTED (programme)** are working rules this programme applies inside its own contract scope. Entries marked **PROPOSED** need CTO or Product Owner ratification before any code depends on them.

| ID | Decision | Status | Evidence / rationale |
|---|---|---|---|
| D-001 | Measurement authority is the newest Alpha release `release/alpha-r4-search-conversation-5513275` @ `5513275f`, not `main` or `release/alpha-m08-integrated-r1`. | ADOPTED (programme) | `5513275f` contains c908, m08 (`6d8b736d`), the home/discussions/alerts candidate and trust-r3. `main` (`5149276f`) is 938 commits behind and not an ancestor. |
| D-002 | Deployment state is never inferred. A cell depending on a deployment flag is **UNVERIFIED**, never PASS, until the deployed value is recorded. | ADOPTED (programme) | Alpha host 403 from the measuring container; in-repo deployed-SHA claims are stale (10). |
| D-003 | The capability registry source (`tools/capabilities.source.py`) is the single hand-edited truth. The JSON, the 02 view, and the 09 and 10 tables are generated, and the validator refuses unknown maturity states, unevidenced blockers and divergent blocker definitions. | ADOPTED (programme) | Prevents per-lane re-statement drift (the cause of stale docs found in Stage 0). |
| D-004 | Ask V2 (`routeAskR2` / SemanticTurnIR) is the one Ask engine. `POST /analysis/news` is legacy, retired only after Production runs Ask V2; it is never extended. | PROPOSED (CTO) | Every Alpha surface already uses Ask V2 (06). c908 Production still uses the legacy engine. |
| D-005 | New evidence domains join Ask as **contributors** in `ask-intelligence` (governed read + domain facet), never as module-specific engines or search pages. | PROPOSED (CTO) | Contract principle A/D; existing contributor pattern (UCDP, TED, NISR, Imihigo). |
| D-006 | Contributor selection must key on SemanticTurnIR domain facets. "Country + generic noun" is never a selection rule. | PROPOSED (CTO), with T1 | P0-ASK-01. |
| D-007 | Display locale and source language are separate types. `DisplayLocale` (7) governs UI; `LanguageCode` governs retrieval and answer language; sw/rw leave UI tables. | PROPOSED (CTO) | P0-LANG-01, P1-LANG-05; `shared/src/language/index.ts` already defines `DisplayLocale`. |
| D-008 | Missing translations render a **declared** fallback (the `askSevenStrings` disclosure pattern), never a silent one. A CI coverage test enforces seven-locale-or-declared for every new key. | PROPOSED (CTO / Claude L) | Language acceptance rule Part I §5. |
| D-009 | Claude H owns Ask shell catalogues and Claude L owns translation qualification. This programme builds the locale *authority and plumbing* (T3) on top of H's final checkpoint and does not author Ask copy. | ADOPTED (programme) | Part XIV coexistence; `stage0/workstreams.json`. |
| D-010 | A country without an active, rights-cleared local source is reported **COVERAGE_GAP** to readers and in admin. International coverage is labelled as such and never presented as local. | PROPOSED (Product Owner) | Part V; P0-SRC-01. |
| D-011 | Rights clearance is a precondition of activation for every acquisition lane, including RSS feeds named by environment variable. | PROPOSED (CTO / E1) | P1-SRC-02 (Standard Media RESTRICTED activatable). |
| D-012 | Preview routes (`*-visual-preview`, orphan compacts, `/workspace`) are not product surfaces: removed from public routing or gated behind admin in every deployment mode. | PROPOSED (CTO) | Principle G; P1-PRV-01. |
| D-013 | Briefings either preserve governed evidence and citations or withhold. A weakened briefing is never saved. | PROPOSED (CTO) | Part III-N; P1-BRF-01. |
| D-014 | Convergence work stays on `claude/whole-product-convergence-r1` (docs) plus one tranche branch per T-item cut from the current Alpha release. Nothing merges into Alpha or Production from this programme without CTO review. | ADOPTED (programme) | Production HOLD; Part XIV. |

## Open questions for the Product Owner / CTO

These are genuinely new. Nothing already decided in the contract is re-asked.

1. **Deployed values.** What are the actual `GNA_PUBLIC_ROOT`, `ASK_V2_ENABLED`, `ASK_R2_ENABLED` and `ASK_PUBLIC_COMPUTE_ENABLED` on Alpha and on Production? Alternatively, may the cloud environment allow-list the Alpha host so they can be measured?
2. **GNews.** Are GNews commercial terms accepted for public display, or is GNews to be labelled "international aggregator" pending a decision? This is a contract stop condition (rights).
3. **T1.** May T1 (the Conflict over-selection fix) proceed as a reviewed patch on a tranche branch while R4 is still moving? It touches `ask-intelligence`, not R4's files.
