# Data-fed Market and Energy R1 — visual authority correction

Branch: feature/datafed-market-energy-r1
Base: e4e010ac7604d40c7a4c2414cf16dc7e9bc8850a

## Current review status

VISUAL AUTHORITY CORRECTION ACCEPTED — DATA BINDING ONLY. The previous replacement Energy surface and Market substrate removal are withdrawn. The accepted frame is restored. Backend/read-model work remains. Energy public data binding is held: DESIGN ESCALATION REQUIRED (details below).

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

## Energy seam and coverage

The shared EnergyObservation contract reuses SourceProvenance, evidence-role vocabulary and SpatialPrecision. It carries subject identity/type, stated geography, metric, period, nullable value, unit, release status, publisher timestamp and retrieval identity. It carries no inferred geometry or assessment.

The new EnergyObservation table references the existing SnapshotRetrieval byte store, has ordered revisions, defaults to REFUSED and publicDisclosureApproved=false, and requires recorded review before the reader will expose anything. Migration: backend/prisma/migrations/20260922150000_energy_retained_read/migration.sql. It was validated but not applied.

GET /energy/observations has no producer or scheduler. The energy-record-v1 parser only accepts a reviewed JSON Pointer into retained JSON whose subject, geography, measurement, period, unit, status, publisher date and institution exactly reproduce the projection. It rechecks capture admission, rights, digest, timestamps and source role. Generic news, altered values, mismatched geography, unknown parsers and undisclosed records fail closed. The latest refused/withdrawn revision prevents resurrection of an older value. Public output uses an explicit field allowlist; internal reviewers and review references are not exposed.

This is deliberately a narrow future seam, not an adapter for ENTSO-E, storage feeds or another new provider. A real source with a different record shape needs a reviewed parser before it can populate this table; normalizing a fixture and pretending it was a publisher record is prohibited.

Future Energy admission prerequisites:

1. Apply the migration only to an approved target in a separately authorized release process.
2. Obtain an already admitted, reproducible E-5 snapshot through the shared pipeline, preserving its original publisher bytes and provenance.
3. Review subject identity, geographic precision, units, release meaning, evidence pointer and public disclosure. Add a tested source-specific parser if energy-record-v1 cannot reproduce the source record.
4. In an approved offline transaction, store the exact projection, snapshot FK, positive per-key revision, parser version, pointer, reviewer and review reference; set ADMITTED and publicDisclosureApproved only after both reviews pass. Pin the snapshot using the existing SnapshotPin lifecycle before relying on long-term availability. No generic runtime writer is introduced here.
5. Verify the public reader against the retained record, including refusal/withdrawal of later revisions. Do not expose these rows through a replacement frontend. The public Energy adapter is held until the accepted Part XI mapping is resolved below.

The public /energy route is restored byte-for-byte to the accepted base. It renders ENERGY_GOVERNED_FRAME through the original EnergyShell. The internal backend endpoint and validated frontend read helper remain available as a seam, but the helper is deliberately not imported by the public route. No facts are silently coerced into assessments or fixture subjects.

## Recovered visual authority

Inspected in D:/Desktop/GlobalNewsAI/Claude_Output before changing visual components:

- GlobalNewsAI Part VII - Market Intelligence v1.0 Review.zip: START HERE README and R11 First Viewport Zoning. SHA-256 e482bbe71ff25cd447bd1a91d168d3c03de77589108e0f06e1b651fb4314dbca.
- H-MARKET-PARTVII-ALPHA-VISUAL-R1.zip: 00-README.md identifies the accepted observation-first implementation, existing capped capability rail and compact detents. H-MARKET-VISUAL-CHECKPOINT-4/README-CHECKPOINT.md explicitly marks that checkpoint HOLD, not a promotion candidate; it was not substituted for the base.
- GlobalNewsAI Part XI - Energy Intelligence v1.0 Review.zip: README defines one permanent shell, three substrates, one HUD/drawer/lens and compact bottom sheet/four-tab composition. SHA-256 fa61230008e73dd22e1f70a6c6c1229fd26339e3a36d65cfa94d904314106b28.
- H-ENERGY-PARTXI-IMPLEMENTATION-R2-README.md describes corrections without geometric changes. H-ENERGY-PARTXI-IMPLEMENTATION-R4.zip README and ALPHA-RELEASE-AUTHORITY-ENERGY-R2.zip README establish R4 as the accepted hydration correction, preserving the frozen frame. R4 SHA-256 774528b1dfa2b8b6f65c66682236d92b8ade7eb6d0b1c44e6e468d59d28df84b matches the release report.
- The user's accepted base e4e010ac7604d40c7a4c2414cf16dc7e9bc8850a and its Part VII / Part XI guards resolve the final implemented bytes. No original package was missing.

## Exact visual diff and validation matrix

Only MktReader.tsx differs among Market/Energy visual components relative to the accepted base: one helper import and one data expression replacing the fixed fallback text inside the existing paragraph. All original markup, style values and hierarchy are identical. MarketScreen.tsx, MarketCompactScreen.tsx, EnergyShell.tsx, Energy page/model and original visual/contract guards were restored; EnergyRetainedSurface.tsx was removed. Other Energy components, tokens, URL handling, map/substrates, HUD/drawer/lens were untouched.

| File relative to repository | Why a change is needed / authority proof | Desktop result | Phone result | EN result | PL result |
|---|---|---|---|---|---|
| frontend/src/components/market/MktReader.tsx | The existing context note previously read only a constant. Its expression now reads verified context; no new slot. visualAuthorityCorrection.spec.ts reverses those two expression/import edits and requires exact base equality. Original mktContract.spec.ts and mktReader tests pass. | Accepted zones/rail/substrate preserved at 1512x900 | Accepted compact composition and substrate preserved at 390x844 | Existing copy plus data note | Existing disclosed English Market fallback preserved |
| frontend/src/lib/market/mktStrings.ts | One existing STALE text value corrected to match retained-only provenance; no key or typography change | Existing freshness chip | Same chip | Current edition unverified | Same disclosed fallback |
| frontend/src/components/market/MarketScreen.tsx; MarketCompactScreen.tsx | Prior edits withdrawn; exact base bytes | Original desktop regions | Original compact detents | Preserved | Fallback preserved |
| frontend/src/components/energy/EnergyShell.tsx; frontend/src/app/energy/page.tsx | Replacement entry path withdrawn; exact base bytes | Map, module rail, right region and substrate switching restored | Original map, bottom sheet and four tabs restored | Preserved | Polish navigation and absence copy preserved |
| frontend/src/components/energy/EnergyRetainedSurface.tsx | Unauthorized alternative architecture removed; guard asserts file absence | No substitute dashboard | No substitute dashboard | No alternate copy | No alternate copy |

Browser checks used the in-app browser against localhost with SERVER_INTERNAL_API_URL and NEXT_PUBLIC_API_URL pointing to an unconnected local backend. No data fixtures were served. Results:

| Domain | Locale | Viewport | Measured result |
|---|---|---|---|
| Energy | EN | 1512x900 | Desktop shell, map/rail/right region present; no document horizontal overflow |
| Energy | EN | 390x844 | Compact shell, map/bottom sheet/four tabs present; no document horizontal overflow |
| Energy | PL | 1512x900 | Desktop shell, localized controls; change switch updates substrate URL; no document horizontal overflow |
| Energy | PL | 390x844 | Compact shell and Polish bottom-sheet/tab labels present; no document horizontal overflow |
| Market | EN | 1512x900 | Accepted frame present; document scroll width 1497 <= 1512 |
| Market | EN | 390x844 | Compact route and original substrate present; no document horizontal overflow |
| Market | PL | 1512x900 | English fallback disclosed; global navbar Sign In link reaches x=1534 (22px overflow). This unchanged global navigation was not edited. |
| Market | PL | 390x844 | English fallback disclosed; no document horizontal overflow |

Browser limitations: Google font download attempts timed out and development fallback fonts were used. These are composition/behavior checks, not a claim of font-exact screenshot parity. The Polish global-navbar overflow needs separate review under the existing global navigation authority; it was not fixed by changing the Market frame. Energy retains baseline untranslated administrative gate fragments, as required by byte-preservation. Populated-context behavior is tested with explicitly synthetic unit-test records only; no real deployment holdings were available to screenshot.

## DESIGN ESCALATION REQUIRED — Energy public binding

The new generic EnergyObservation seam is not itself the accepted Part XI presentation contract. SYSTEM does not determine SUPPLY_SITUATION versus GRID_SITUATION. A retained numeric observation does not establish a reviewed change-state pair, artifactsReviewed, lastChecked assessment time, attention/feed ordering, or corridor/asset role. A raw FLOW value cannot be converted into the designed sharePct Sankey, and generic STORAGE cannot be treated as levelPct without its unit and meaning being established. No route/asset geometry is present.

Required ruling/input: approve a source-specific mapping into existing EnergySubject fields/evidence and exact existing subject types, keeping absent assessments/geometry explicit; identify which evidence produces each designed change/flow/storage slot. If a raw record list is desired instead, that is a separate Claude Design/CTO design change. It is not authorized here. Public binding stops at this boundary; the governed frame remains in place and the backend seam remains dormant with respect to the route.

## Validation and remaining limits

- 250 frontend Market/Energy tests pass, including the original visual guards restored byte-for-byte and 20 added authority checks (18 exact-file checks, one expression-only check, one replacement-surface exclusion).
- Frontend TypeScript passes. Backend is unchanged by this correction; the prior 68 retained-reader tests, schema validation and backend build remain applicable.
- No provider activated, no runtime acquisition, no migration applied, no deployment, no merge. Live holdings remain unmeasured because no database was configured.
- Initial automatic approval review rejected restoration due to a mistaken empty-request/uncommitted-work concern. Read-only checks proved both worktree and index clean and the prior implementation safely committed in f8a447b; the authorized retry succeeded. No approval blocker remains.

READY FOR CTO DATAFED MARKET ENERGY REVIEW
