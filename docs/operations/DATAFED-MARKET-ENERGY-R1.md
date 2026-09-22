# Data-fed Market and Energy R1

Branch: feature/datafed-market-energy-r1
Base: e4e010ac7604d40c7a4c2414cf16dc7e9bc8850a

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

Admitted null measurements remain explicit as absent values rather than disappearing from holdings. Both desktop and compact cards show context, period, value/unit, status, authority, publisher-change time and separate retrieval time. Retained evidence does not assert that it is the publisher's current edition. The coverage strip derives held corridor count from retained context; freshness no longer contradicts populated cards. The empty chart well is removed. Failed reads show unknown holdings rather than a zero count.

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
5. Verify the public reader against the retained record, including refusal/withdrawal of later revisions. The frontend already renders accepted facts; other metrics stay absent.

The public /energy route reads only the internal backend. It distinguishes EMPTY from UNAVAILABLE, with a five-second read timeout. Its responsive governed surface provides one coverage explanation and the existing URL-based Spatial/Change/Flows navigation. It never manufactures a map, Sankey, named asset or assessment from a missing measurement. EN/PL coverage text and navigation remain available; the fixture presentation architecture stays isolated for design tests.

## Validation and limitations

- Shared build, backend TypeScript, frontend TypeScript, and Prisma schema validation passed.
- Backend retained-reader tests: 68 cases (including capture rejection, public disclosure, tampering, revision suppression, label provenance, and scanning past 250 rejected rows).
- Frontend Market/Energy tests: 233 cases (including EN/PL coverage/navigation, empty vs unavailable, fixture isolation, and no giant empty chart).
- Local backend and frontend production builds passed during implementation; final small presentation/context edits are additionally covered by the focused regressions and TypeScript checks.
- No deployment database was inspected or migrated. No real observation count is asserted. Full browser viewport screenshot QA was not performed; responsive behavior was checked through existing layout guards and server-rendered EN/PL navigation tests.
- Existing Market PL catalogue incompleteness and lack of verified deployment holdings remain explicit limitations. Energy source admission and public disclosure remain required for any future data.

READY FOR CTO DATAFED MARKET ENERGY REVIEW
