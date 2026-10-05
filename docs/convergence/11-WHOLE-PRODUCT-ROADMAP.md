# 11 — Whole-Product Roadmap

> **Stage 2 runtime correction (2026-10-04, CTO contract R2).** Railway runtime authority replaces the Git-derived Production assumption below:
> - **Alpha:** backend and frontend at `5513275f` (SUCCESS); live root is platform Home (`GNA_PUBLIC_ROOT` configured); Ask V2 active for signed-in users; guest trial **OFF by design** during controlled acceptance (not a defect).
> - **Production:** backend `5b714833`, frontend `58f80fd4` (SUCCESS). Strict ancestors of Alpha, 85 and 84 commits behind. Not `release/production-c908`.
> - **Production flags are not inferred; Production stays HOLD.**
>
> Registries (02, 09, 10, `status.json`) are regenerated with these facts. See `stage2/STAGE2-REPORT.md`.

Authority `5513275f`. Stage numbering follows contract Part XIII.

**Exit criteria are measurable.** Each one names the matrix cells (09) or blocker IDs (10) that must change. Re-run `python3 docs/convergence/tools/render.py` after every tranche. `status.json` is the progress metric.

Current: **0 GREEN · 1 AMBER · 32 RED**. Blockers: 5 P0 · 30 P1 · 11 P2 · 2 P3.

## Tranche numbering after contract R2

| Contract R2 | Stage 0 roadmap item | Status |
|---|---|---|
| T1 Coverage truthfulness | T2 | **building** (branch `claude/stage2-t1-coverage-truthfulness`) |
| T2 Global language foundation | T3 + T4 + T5 (frontend half) | **building** on H final `266007c` |
| T3 Ask contributor selection | T1 | **reproduce + spec only** until final R4 |
| T4 Legacy Ask convergence | T15 (retirement half) + T10 telemetry | caller graph + legacy-use telemetry |
| T5 Pre-login consent + guest trial | T9 | **Public-Beta Production P0** |
| T6 Module → Ask binding | T7 | contract + matrix (`stage2/T6-…`) |
| T7 Data maturity | T11 | ranking (`stage2/T7-…`) |
| T8 Alerts / watch | T12 | after evidence identity and shared search are stable |
| T9 Whole-product acceptance | T14 | matrix maintained by `tools/render.py` |

## Stage 0 — Measure ✅ (this delivery)

Registries 01–13 and the raw measurements in `stage0/`.

## Stage 1 — Classify gaps ✅ (this delivery)

Every blocker carries P0–P3 with evidence (10).

**Open item:** record the deployed flag and SHA values so 31 UNVERIFIED cells become measurable. This needs network access to Alpha or an ops note.

## Tranche order (non-colliding first)

| # | Tranche | Closes | Collides with | Gate to start |
|---|---|---|---|---|
| T1 | **Ask domain-scoping fix.** `selectContributors` must select CONFLICT only on a security/conflict facet from SemanticTurnIR, never on country + "situation". Add the contract negative-control tests (travel, political, energy, economic, weather). | P0-ASK-01; 06 controls 1 and 4 → PASS | R4/H own the `ask-router`/`ask-v2` files, but `ask-intelligence/contributor-selection.ts` is in neither lane's diff | CTO go: it touches the shared Ask contributor layer |
| T2 | **Coverage truthfulness.** Disclose COVERAGE_GAP when an answer's country has no qualified local source; make `accountSourceCoverage` emit COVERAGE_GAP instead of UNVERIFIED; refuse RSS activation of rights-restricted feeds; reject placeholder API keys. | P0-SRC-01 (disclosure half), P1-SRC-02, P1-SRC-03 | none (news, global-reach and shared global-reach are safe zones) | none, inside contract scope |
| T3 | **Global language foundation (Stage 2 core).** One `DisplayLocale` authority read by the root layout and every route; `<html lang>` and `<html dir>` follow it; stop overwriting the stored choice; declared fallback per catalogue; seven-locale coverage test in CI. | P0-LANG-01/02/03; 03 grid moves from E to *declared* fallback; journey steps 1, 2, 7, 8, 10 | **H** (`lib/ask/shell/locales`, `app/globals.css`, `app/account`) and **L** (key manifest) | Consume H's final checkpoint first, then build on top. Do not re-author Ask catalogues H owns. |
| T4 | **Locale content fill.** Main dictionary fr/de/es/pt/ar, using the dormant C55 set (1655 keys) as seed and the Claude L manifest as authority; domain catalogues (hum, mkt, sec, energy, briefing, politics, election). | P1-LANG-04, P1-ASK-03, P1-MKT-02 | L | L handoff, or a CTO ruling that this programme drafts under L review |
| T5 | **Backend locale path.** Separate `LanguageCode` (source) from `DisplayLocale`; add de/pt to the analysis and telemetry DTOs and to retrieval strategy; localise backend errors; route fr/es/ar/de/pt through the deterministic routers. | P1-LANG-05, P1-ASK-04 | R4 (`ask-router`) for the router half | R4 final |
| T6 | **Briefing and continuity evidence.** Briefing snapshot keeps `payload.intelligence`; wire the prior-reference resolver; "still true now?" re-verifies against prior evidence. | P1-BRF-01, P1-CONV-01/02 | R4 (`ask-v2/conversation`) | R4 final |
| T7 | **Shared search binding (Stage 3).** Politics (consume lane), Energy, Security, Eurostat economy and Election as Ask contributors via governed reads; fix the procurement scan order. | P1-POL-01, P1-ENG-01, P1-SEC-01, P1-MKT-01; 06 states → ASK_BOUND | Politics lane; Humanitarian lane | Politics handoff; Humanitarian rebase |
| T8 | **Route hygiene.** Remove `/history` from the Production allowlist (or rebuild it on Ask V2 threads); remove or gate preview routes; drop the `?state=` switch outside dev; delete `/workspace`; fix NavBar dead links in Standalone; add `/saved/briefing` to `ASK_CONTINUITY_ROUTES`. | P1-HIST-01, P1-LEG-01, P1-PRV-01, P1-MI-01, P2-PRV-02 | H touches `components/ask-nav` | none for `app/*` preview removal |
| T9 | **Consent and privacy.** A pre-login consent / cookie / data-handling notice in seven locales, covering the guest trial. | P1-PRIV-01 | none | Product Owner copy approval |
| T10 | **Observability.** Telemetry for Ask V2 turns; admin analytics reads them. | P1-OBS-01 | `ask-observability` (R4) | R4 final |
| T11 | **Source data completion (Stage 4).** Rights-clear and activate local sources per region (East Africa → EU-27/Poland → Middle East); resolve NISR, Imihigo and IEBC rights records; GNews commercial terms. | P0-SRC-01 (coverage half), P1-ECON-01, P1-RIGHTS-04 | Humanitarian programme for its sources | **Stop condition:** provider rights need a Product Owner/legal decision; credentials need company identity |
| T12 | **Recurring intelligence (Stage 5).** Issue follow, material-change detection, in-app then push alerts, briefings across modules. | P2-FOL-01, P2-ALR-01 | — | after T6, T7 |
| T13 | **Cross-platform and theme (Stage 6).** Light theme on dashboards; device matrix. | P2-THEME-01/02, P2-MAP-01 | — | — |
| T14 | **Alpha whole-product acceptance (Stage 7).** Run 09 including the seven-locale journey on Alpha (needs host access). | 09 → GREEN except approved Production-only blockers | — | T1–T10 closed |
| T15 | **Production qualification (Stage 8).** Promote one exact Alpha-tested SHA with a rollback ref; retire `/analysis/news` after Production runs Ask V2. | P1-ASK-05, preconditions in 10 | — | **explicit CTO / Product Owner authorization only** |

## Recommended next step (first non-colliding P0/P1 work, Part XVI §9)

**T2 (coverage truthfulness)** lies entirely in safe zones. It adds no AI or provider calls, and it closes the "no silent fallbacks" principle (E) for sources.

**T1** is the highest-value P0 fix. It is small and testable, but it changes shared Ask behaviour, so it should go to the CTO as a ready patch, not be pushed into Alpha unannounced.

**T3** should start only after H's checkpoint is final. Building it earlier would collide with H's localisation work.
