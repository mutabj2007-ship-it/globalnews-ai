# Data-fed Market and Energy R1 — Plan B delivery

Branch: feature/datafed-market-energy-r1
Accepted visual base: e4e010ac7604d40c7a4c2414cf16dc7e9bc8850a
Preserved correction commit: 7779322. Plan B is an additional commit, not a history rewrite.

## Result

Product Owner Plan B applied. Energy public binding is mounted into the accepted Part XI shell. The previous design escalation is resolved by the engineering adapter. Market Part VII and its retained reader are unchanged. No new dashboard, permanent region, geometry or style was introduced. Production HOLD remains. No merge, deploy, production operation, migration application, acquisition or provider activation occurred.

No admissible Energy or Market trade observations were found in the inspected repository material. Deployment holdings remain unknown: no database was configured. No fixtures were added to public routes. Empty and failed Energy reads retain the governed absence frame. Existing banner copy distinguishes an unavailable read from empty holdings and retained evidence; neither claims that no energy event occurred.

## Energy contract and mapping

The shared contract and a new SQL CHECK require exact public subject types: SUPPLY_SITUATION, CORRIDOR, INFRASTRUCTURE_ASSET or GRID_SITUATION. Generic SYSTEM and ASSET records are refused even if retained bytes match. The reader still verifies admission, independent public disclosure, review, rights, bytes/digest, capture times and exact publisher fields at the JSON Pointer. Later refusal/withdrawal suppresses older values.

The route performs one bounded internal GET /energy/observations. It calls no provider, producer or AI engine. The adapter binds identity/type, geography, precision, metric, period, value/unit, release status, publisher changed time, provenance and retrieval identity into existing slots. Null measurements remain absent with their unit. Freshness states that only retained evidence is known; the latest publisher edition is unverified.

Subjects are unranked, ordered lexically by source identity. Opaque deterministic URL keys support source identities outside the URL alphabet; exact source identities remain in the details. All observations for a consistent subject are retained. Conflicting identity/name/type/geography is withheld rather than arbitrarily selected.

Desktop uses the existing subject list, HUD, drawer and evidence regions. Phone uses its existing compact list in spatial mode and the existing selected-subject text slot for raw facts/provenance. Its existing header reads Evidence when showing these unranked identities. Change remains absent. No assessed attention feed is generated.

Geometry, change-state pair, cause, confidence, corridor/asset roles, Watch state, cross-domain consequences, assessment check time and timeline remain absent. Raw FLOW cannot fill Sankey sharePct; raw STORAGE cannot fill levelPct. This narrow contract carries no admitted ratio or geometry semantics, so those charts retain existing absence states.

Evidence is CONTEXT for the absent assessment; the original source evidenceRole is preserved in detail. Specific source class and language remain absent, not inferred from PUBLIC_DATA or institution names. Existing Watch controls show the absent marker and are disabled when state is unknown. Public evidence availability reflects both independently validated rights and disclosure gates.

## Exact Energy admission steps

These are instructions for a separately authorized non-production admission/release, not executed operations.

1. Configure the approved database and inventory SnapshotRetrieval, SnapshotPayload and EnergyObservation. Do not acquire new data or activate providers in this lane.
2. Apply 20260922150000_energy_retained_read and 20260923120000_energy_partxi_subject_type through the approved release process. Inspect legacy public payload types first. The new constraint deliberately fails on generic public types until those records are explicitly refused/re-reviewed; it does not coerce or rewrite them. DOWN.sql removes only the new constraint.
3. Use an already admitted COMPLETE HTTP 200 E-5 snapshot, with rights reference, permitted retained bytes, reproducible digest and provenance.
4. Review exact subject type, identity, geography/precision, metric, period, value/unit, release status, publisher changed time and institution. energy-record-v1 requires exact fields at its JSON Pointer. A different publisher shape needs a reviewed source-specific parser, never a guessed mapping.
5. In an approved offline transaction, store the projection, snapshot FK, positive per-key revision, parser version, pointer, reviewer and review reference. Set ADMITTED/publicDisclosureApproved only after separate reviews. Pin the snapshot through SnapshotPin for retention. No runtime writer or scheduler is introduced.
6. Verify GET /energy/observations against original bytes and later refusal/withdrawal; then select the record on /energy in desktop/phone EN/PL. Unsupported charts, assessments and geometry must stay absent.

## Visual change ledger

| File | Binding reason | Desktop/phone and EN/PL result |
|---|---|---|
| frontend/src/app/energy/page.tsx | Retained read and adapter | Accepted returned JSX hierarchy; existing banner strings bound to read state and locale |
| frontend/src/components/energy/EnergyShell.tsx | Null Watch propagation; existing compact list and selected-text binding | Selected evidence and unselected phone discoverability tested in EN/PL at 1512/390; no style or region changes |
| frontend/src/components/energy/EnergyParts.tsx | Null Watch marker and disabled behavior | Same control dimensions/styles; language-neutral absence |
| frontend/src/components/energy/EnergySubjectSurfaces.tsx | Null source-class marker and stable field keys | Existing HUD/drawer/lens markup and styles retained |
| frontend/src/lib/energy/energyModel.ts | Nullable missing metadata and optional field identity | Data contract only |
| frontend/src/lib/energy/energyRetainedAdapter.ts | Exact facts and localized labels/status/metrics | Existing detail slots only; no assessments inferred |

visualAuthorityCorrection.spec.ts reverses only the specifically authorized expression/null-handling changes and requires equality with the accepted base. Untouched visual files remain byte-pinned. Route JSX is separately pinned after reversing only the banner-strings binding. Existing Energy tests now allow only the retained reader request instead of requiring a permanently data-free route; provider/model/tile-host prohibitions remain.

Render integration tests use synthetic test-only records and a mocked map renderer. They establish responsive branch behavior and binding, not font-exact browser pixels. Prior 7779322 browser checks of the unchanged empty frame found no Energy horizontal overflow at 1512x900/390x844 in EN/PL. No new populated production screenshot is claimed.

Prior limitations remain: development font downloads timed out, Market PL explicitly falls back to English, and its unchanged global navbar overflowed by 22px at 1512px. Baseline Energy administrative gate fragments remain unchanged. None is claimed fixed here.

## Validation

- Focused frontend Market/Energy suite: 272 tests passed across 9 suites.
- Backend Energy reader: 25 tests passed, including exact-type acceptance and generic-type refusal.
- Shared and backend builds, backend runtime packaging, frontend TypeScript and Prisma schema validation passed.
- New SQL migration has not been run against a database; no live holdings are claimed.
- Automatic approval review briefly failed because of a usage limit; the command did not run. After the user's continue instruction the same approval path succeeded. No approval blocker remains.

## Scope and evidence inventory

No merge, deployment, production database operation, acquisition, or provider activation was performed. No retained observations were fabricated or seeded. Test-only synthetic records remain in tests.

- Market already has MarketObservation, MarketIngestRun, SnapshotRetrieval, SnapshotPayload and SnapshotPin persistence, an offline MarketRetainedProducer, and GET /market/observations. The Alpha page already consumes this internal reader.
- The Comext capture in backend/src/modules/market-ingest/market-retained.spec.ts explicitly declares itself synthetic and test-only. It is not an admissible production holding.
- The committed Eurostat D2 bodies in backend/src/modules/official-data/fixtures are inflation (prc_hicp_manr), unemployment (une_rt_m), and an HTTP 404 control. Their dimensions differ from monthly Comext. They are not admitted Market trade observations and were not reclassified.
- The committed source-pack capture audit and Imihigo material do not establish a structured, admitted EnergyObservation. News and source listings were not converted into energy measurements.
- frontend/src/lib/energy/energyFixtures.ts is illustrative design data. The public Energy route still cannot select it by URL.
- No admissible Market Comext or structured Energy holding was identified in the inspected repository material. This is not a statement that a deployment database is empty: this worktree has no configured DATABASE_URL and no local .env. Live database inventory was therefore not performed.

## Market implementation

The retained reader continues to revalidate admission, rights, digest, capture identity, publisher revision, unit, value and release status. It now returns verified reporting country, partner, product, flow, indicator and frequency, optional publisher-provided labels, retrieval identity and retrieval time. Labels are never guessed from product codes. Unsupported instruments and sectors remain absent.

The scan now continues in 250-row batches instead of silently stopping after the first 250 rows. With no limit supplied, all qualifying latest observations are returned. An explicit limit remains bounded at 250. Latest refused or withdrawn revisions still suppress older values.

Admitted null measurements remain explicit as absent values rather than disappearing from holdings. The original desktop and compact compositions, coverage strip, substrate well, change/freshness regions, source rail and drawers are restored. Market binds reporting country/partner, product, flow/indicator and retrieval time into the existing ObservationCard context paragraph. Its period/value/unit/publisher timestamp/source/status slots remain unchanged. The existing freshness token now says "Current edition unverified" rather than incorrectly saying no vintage exists. No new element, card family, style or layout was added.

The existing Polish Market behavior is preserved: its incomplete catalogue explicitly falls back to English. This change does not claim a complete Polish Market translation.

## Exact Market inventory and admission steps

These are operator instructions for an approved non-production database, not actions executed in this delivery.

1. Configure DATABASE_URL securely for the intended database. Do not point these commands at Production as part of this task. Ensure the existing Market and Snapshot migrations are present.
2. From the repository root, prepare local types:

~~~powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run build:shared
npx prisma generate --config backend/prisma.config.ts
~~~

3. Inventory retained Eurostat captures without contacting Eurostat or writing rows:

~~~powershell
npx ts-node --project backend/tsconfig.json backend/tooling/market-retained.ts
~~~

4. Inspect one real retrieval ID from that output:

~~~powershell
npx ts-node --project backend/tsconfig.json backend/tooling/market-retained.ts --retrieval <approved-retrieval-id>
~~~

5. Only after capture-specific approval, backfill that retained capture:

~~~powershell
npx ts-node --project backend/tsconfig.json backend/tooling/market-retained.ts --retrieval <approved-retrieval-id> --author <reviewer-identity> --apply
~~~

The explicit ID becomes the producer's approval allowlist. The existing producer performs a serializable, idempotent transaction, records the author, writes observations and pins their payload. There is no scheduler, HTTP write endpoint, or network acquisition in this tool.

Admission requires an already ADMITTED, COMPLETE, HTTP 200 Eurostat capture; E-5 retention rights with an instrument reference; retained bytes matching their SHA-256 digest and length; pinned monthly freq/reporter/partner/product/flow/indicators; a permitted reporter/product combination under existing Comext carve-outs; matching JSON-stat 2.0 ESTAT endpoint/dimensions; explicit publisher UNIT and UPDATE_DATA annotations; a valid time axis; numeric/null cells; and explicit p or r cell flags. Missing status is not FINAL.

If inventory finds no admissible capture, stop. Populating Market first requires separately approved retention through the existing official-data admission/snapshot pipeline with the above transport, rights and request evidence. Do not manufacture SnapshotRetrieval rows from a fixture or turn on a runtime provider. This delivery does not authorize that missing acquisition.

6. Verify GET /market/observations on the approved local backend, then /market and /market/compact. A healthy empty array remains an honest empty state.


## Recovered visual authority

Inspected in D:/Desktop/GlobalNewsAI/Claude_Output before changing visual components:

- GlobalNewsAI Part VII - Market Intelligence v1.0 Review.zip: START HERE README and R11 First Viewport Zoning. SHA-256 e482bbe71ff25cd447bd1a91d168d3c03de77589108e0f06e1b651fb4314dbca.
- H-MARKET-PARTVII-ALPHA-VISUAL-R1.zip: 00-README.md identifies the accepted observation-first implementation, existing capped capability rail and compact detents. H-MARKET-VISUAL-CHECKPOINT-4/README-CHECKPOINT.md explicitly marks that checkpoint HOLD, not a promotion candidate; it was not substituted for the base.
- GlobalNewsAI Part XI - Energy Intelligence v1.0 Review.zip: README defines one permanent shell, three substrates, one HUD/drawer/lens and compact bottom sheet/four-tab composition. SHA-256 fa61230008e73dd22e1f70a6c6c1229fd26339e3a36d65cfa94d904314106b28.
- H-ENERGY-PARTXI-IMPLEMENTATION-R2-README.md describes corrections without geometric changes. H-ENERGY-PARTXI-IMPLEMENTATION-R4.zip README and ALPHA-RELEASE-AUTHORITY-ENERGY-R2.zip README establish R4 as the accepted hydration correction, preserving the frozen frame. R4 SHA-256 774528b1dfa2b8b6f65c66682236d92b8ade7eb6d0b1c44e6e468d59d28df84b matches the release report.
- The user's accepted base e4e010ac7604d40c7a4c2414cf16dc7e9bc8850a and its Part VII / Part XI guards resolve the final implemented bytes. No original package was missing.


READY FOR CTO DATAFED MARKET ENERGY REVIEW
