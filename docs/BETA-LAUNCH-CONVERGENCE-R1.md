# BETA-LAUNCH-CONVERGENCE-R1

Status: ACTIVE IMPLEMENTATION AUTHORITY
Target: public Beta launch on globalnewsai.live
Base: release/alpha-m08-integrated-r1 @ df664f58324bf6aba08fd63b1df6da7b31089315
Working branch: integration/beta-launch-convergence-r1
Production: HOLD until Product Owner explicitly authorizes promotion.

## 0. Product Owner ruling

From this point, the project target is Beta launch. Do not create work that cannot be inspected on the front end unless it is strictly required to make an approved visible Beta feature work.

The Product Owner requires a new Beta Launch visual authority for BOTH desktop and phone before dashboard redesign continues. The separate Design lane owns that visual authority. Claude Code MUST NOT improvise or redesign around missing authority.

Once the Design authority is supplied, implementation must reproduce it faithfully. "Close enough", generic admin cards, retained-record dumps, raw engineering consoles, and hidden primary intelligence do not count as visual convergence.

## 1. Current measured Git / Railway state

- Alpha integration head: df664f58324bf6aba08fd63b1df6da7b31089315.
- Alpha backend latest successful deployment: df664f58324bf6aba08fd63b1df6da7b31089315.
- Alpha frontend latest successful deployment: d49bd5a9970fd7c0673f347a50f2cf5368750293 (Market retained TED presentation). Therefore the Alpha frontend is behind the current integration head.
- Successful retained one-shot services exist for:
  - UCDP Conflict candidate capture.
  - TED Market procurement capture.
  - Eurostat Energy retained capture.
- Market PR #22 remains a draft and is NOT the Beta visual authority.
- Neither Alpha nor Production frontend currently has globalnewsai.live attached as a Railway custom domain.
- Existing Alpha/Production Railway-generated domains remain in place.
- No Production promotion is authorized by this contract.

## 2. Design authority gate — mandatory before UI implementation

The incoming Beta Launch Design package must provide, at minimum:

1. Desktop master frame at >=1440px.
2. Phone master frame at 390x844.
3. Adaptation rules/evidence for 360x800 and 430x932.
4. Home/Beta Launch visual authority.
5. Shared header/navigation/footer/mobile navigation authority.
6. Module-entry card behaviour and click-through transition.
7. For every dashboard: primary first-screen composition, populated state, partial-data state, gap state, selected-subject state, drawer/lens state where applicable.
8. Typography, spacing, card/surface shapes, colour families, interaction states, contrast expectations, and responsive behaviour.
9. EN and PL behaviour.
10. Explicit indication of which controls are public reader controls versus analyst/deep-intelligence controls.

No dashboard visual rewrite begins until these artifacts are committed or otherwise supplied as immutable implementation authority.

## 3. Beta principle: intelligence first, evidence behind it

Every public-facing specialist route must answer, without forcing the user into a drawer or lens:

- What is happening / what data is available?
- Where?
- What is the latest period/date?
- What changed, when comparable evidence exists?
- What is known versus not established?
- How fresh is the evidence?
- What can the user do next?

Raw IDs, parser/retrieval identities, hashes, revision internals, provider execution state, and other engineering provenance remain available through evidence/provenance detail, but MUST NOT dominate the first public frame.

Unsupported assessments remain withheld. Withholding an assessment MUST NOT hide or visually suppress valid observed facts.

## 4. Data breadth rule

A single-country proof capture is a pipeline proof, not a Beta dataset.

For each declared Beta region and specialist domain, Claude Code must produce a coverage matrix where every declared country is accounted for as one of:

- DATA_AVAILABLE
- PARTIAL
- DELAYED
- COVERAGE_GAP

No country silently disappears.

Priority regional programme:
- East Africa
- Europe / EU-27
- Middle East

International sources may supplement local evidence but may not silently substitute for missing local coverage.

## 5. Module implementation sequence

Implement and visually validate ONE module at a time. Do not batch several invisible back-end lanes and defer visual inspection.

Sequence:

### Gate A — Beta shell
1. Home / Beta Launch desktop.
2. Home / Beta Launch phone.
3. Shared navigation, search, language, sign-in/get-started, Ask entry, module cards, footer.
4. Verify every public card destination has an intentional reader-facing landing state.

### Gate B — high-value modules
5. Conflict Intelligence.
6. Economy Intelligence.
7. Energy Intelligence.
8. Market Intelligence.

### Gate C — remaining specialist/public modules
9. Security Intelligence.
10. Humanitarian Intelligence.
11. Politics Intelligence.
12. Country / Map Intelligence.
13. Ask GlobalNewsAI / Analysis Workspace.
14. World Intelligence only if a real distinct surface exists; do not route a missing World surface to Home merely to make it clickable.

At the end of EACH module:
- run full relevant unit/contract tests;
- build frontend/backend/shared as affected;
- run browser verification;
- capture desktop;
- capture 390 phone;
- capture 360 and 430 adaptation checks;
- inspect EN;
- inspect PL;
- deploy to Alpha only after candidate tests pass;
- Product Owner performs visual acceptance before the module is marked Beta-ready.

## 6. Module acceptance contract

A module cannot be marked Beta-ready unless ALL are true:

### DESIGN
- The approved Beta/Claude Design frame is reproduced.
- No generic retained-reporting overlay replaces the approved composition.
- No internal engineering/readiness console dominates the reader surface.
- Desktop and phone both pass visual inspection.
- Information is readable at normal zoom without tiny metadata-first typography.

### DATA
- Real available data is shown in the designed regions.
- Primary useful data is visible without deep navigation.
- Multi-country coverage is exposed where the domain is regional/global.
- Coverage gaps are explicit and understandable.
- No illustrative/fixture values can leak into a public reader route.
- Known observations and unavailable assessments are visually distinct.

### INTERACTION
- Module card -> module landing -> subject -> deeper evidence is coherent.
- No dead or misleading buttons.
- Drawers replace rather than stack where governed.
- Mobile interactions remain reachable and do not overlap Ask/navigation.
- Search/filter/scope controls explain themselves.

### TRUST
- Source/provenance is reachable.
- No unsupported severity, ranking, confidence, actor kind, geometry, change state, or assessment is invented.
- Reader copy is plain-language first; technical provenance is secondary.
- Date/period/source/freshness semantics remain correct.

### QUOTA / COST
- Normal navigation, filtering, category selection and reading stored observations do not invoke AI.
- Ask/analysis compute is explicit.
- No provider-on-open pattern.

### RELEASE
- No unresolved P0/P1 regression.
- Alpha deployment stable.
- Product Owner explicit visual PASS.
- Only then may the module enter the Beta release candidate.

## 7. Mandatory populated-state testing

An empty-state screenshot is not sufficient.

For every specialist dashboard, automated/browser evidence must include:
- populated multi-record state;
- populated multi-country or multi-geography state where relevant;
- partial/gap state;
- selection state;
- mobile state;
- EN;
- PL.

Where existing browser/visual gates are usable, extend them rather than replacing them. Preserve the existing spatial Part A/B/C governance and Product Owner visual acceptance.

## 8. What Claude Code does now — before Design authority arrives

Allowed now:
1. Checkout this branch.
2. Audit current routes/components/data readers against this contract.
3. Produce a Beta route matrix: route, current state, current data source, current visible data, current hidden/deep-only data, mobile route/state, noindex/index state.
4. Produce a data coverage matrix by module/region/country from currently admitted data and source packs.
5. Identify exact files that will receive the incoming Design implementation.
6. Identify stale fixtures, internal-only surfaces, duplicate preview/public routes, and generic reporting overlays.
7. Verify which existing visual/browser gates can be reused and which modules lack populated-state capture.
8. Do NOT redesign the visible UI before the new Design authority lands.
9. Do NOT activate new Production providers or deploy Production.
10. Do NOT spend time on work that has no Beta-visible consumer unless it blocks a required visible feature.

## 9. What Claude Code does immediately after Design authority lands

For each module, starting with the Beta shell and then Conflict/Economy/Energy/Market:

1. Compare approved frame vs current implementation.
2. Write an explicit delta list before editing.
3. Bind existing real data into approved visible components.
4. Add missing data adapters only where a visible approved component needs them.
5. Keep real observations visible even when assessment is unavailable.
6. Move raw engineering provenance behind the evidence/provenance affordance.
7. Add/repair desktop and phone responsiveness.
8. Run tests/build/browser captures.
9. Return screenshot evidence and a changed-file list.
10. STOP that module at Alpha visual review until Product Owner PASS.

## 10. Git discipline

- Work only on integration/beta-launch-convergence-r1 or module branches created from it.
- One module convergence PR at a time.
- No direct writes to Production.
- No merging stale Alpha experimental branches into the Beta branch without diff review.
- Existing draft PR #22 is evidence/work-in-progress, not automatic merge material.
- Preserve accepted security, provenance, quota and evidence contracts unless the Beta implementation explicitly needs a compatible extension.
- Every PR must state:
  - visible user change;
  - data source(s);
  - routes changed;
  - desktop evidence;
  - phone evidence;
  - EN/PL evidence;
  - tests;
  - quota effect;
  - known gaps.

## 11. Railway / public-launch sequence

Do not bind globalnewsai.live yet.

Sequence:
1. Beta visual authority approved.
2. Beta branch module-by-module convergence.
3. Alpha candidate deployed and visually accepted.
4. Full Beta regression + security + quota + SEO review.
5. Prepare Production deployment candidate.
6. Configure globalnewsai.live/custom domain and required site URL/DNS only as part of the authorized release operation.
7. Smoke-test canonical URLs, robots/sitemap/indexability, auth, API routing, EN/PL, mobile and desktop.
8. Product Owner authorizes public Beta promotion.
9. Production deploy.
10. Post-deploy smoke and rollback readiness.

## 12. Definition of done

Beta launch is done when a first-time user can enter GlobalNewsAI from the polished Home page, click any public module card, immediately understand the information shown, inspect meaningful real available data, move deeper only when they choose, and receive the same coherent product quality on phone and desktop.

A technically correct retained record hidden in a confusing surface is NOT done.
A beautiful design populated only with fixtures is NOT done.
A working backend with no approved visible consumer is NOT done.
