# ER1 · Regional Early-Signal R1 · T1/T2 local candidate (Master CTO R17 limited GO)

**Status: `T1_T2_LOCAL_CANDIDATE` · NO_DEPLOY · ALL_RIGHTS_HOLD · EA_REGIONAL_HOLD**

## Contents

| Path | What it is |
|---|---|
| `contract/early-signal.contract.ts` | **T1.** A pure, typed proposal of:<br>• source publisher / endpoint / country coverage links (one publisher, many country roles);<br>• observation with provider lineage, original language, and separate publication, event and first-observed clocks;<br>• reporting chain;<br>• attributed claim and relations;<br>• event / case;<br>• impact statement vs impact assessment;<br>• the evaluation ledger;<br>• the Story-Alert truth projection (`lastEvaluatedAt` + `NOT_ASSESSED`);<br>• the operator-only shadow candidate. |
| `derive/early-signal.derive.ts` | **T2.** Pure derivations, each encoding one ruling (see the file header). It also reproduces two live rules verbatim (`liveChangeStateOf`, `liveBringsNewEvidence`) as arm A. |
| `fixtures/ea-17-cases.fixture.json` | EA's 17 real cases (6 replays). A metadata-only extraction pinned to EA's original sha256 `e13f8f84…`. |
| `fixtures/eight-row-coverage.fixture.json` | All 86 EA research rows, the runtime admission report (298 → 290 + 8 refused) and the 290 canonical identities. |
| `fixtures/regions.fixture.json` | EA 11 / ME 16 / EU27 27 member lists, copied from `shared/src/global-reach-regions.ts` (pinned). |
| `fixtures/synthetic-27.fixture.json` | 27 **synthetic** negative / failure cases (S-01..S-27), each citing its ruling. |
| `early-signal-r1.spec.ts` | The behavioural harness. **Queued, not run** (see "Running it later"). |
| `tools/build-fixtures.mjs` | The deterministic generator. Inputs are pinned by sha256 and a mismatch refuses. Output is byte-identical on re-run. |
| `tools/check-static.mjs` | A tiny static manifest check (inventory and provenance only). |

## Boundaries (why the effect on existing code is zero)

- **Not in any build or default test run:**
  - `backend/tsconfig.build.json` excludes `test`;
  - backend jest uses `rootDir: src`;
  - e2e matches only `.e2e-spec.ts`.
- **Not wired anywhere:**
  - no import from `app.module.ts` or any production file;
  - nothing exported from `@globalnews-ai/shared`;
  - no Prisma change; no migration;
  - no new runtime switch;
  - the frozen `WatchChangeState` union is not extended.
- **No external calls or data:** no network, clock, DB, provider or model call. No article body, premium text, image or screenshot.
- **Not evidence of capability:** this harness is not evidence of monitoring, coverage or early detection. It does not replace the 24 missing real EU27 / Middle East cases or independent regional reviewers.

## Running it later

Run only when the single heavy runner is free and the CTO authorises it:

```
node backend/test/evaluation/early-signal-r1/tools/check-static.mjs
npx jest -c backend/test/evaluation/early-signal-r1/jest.config.json --runInBand
```

To regenerate the fixtures (pinned inputs only):

```
node backend/test/evaluation/early-signal-r1/tools/build-fixtures.mjs <EA-12-CASE-CHRONOLOGICAL-BENCHMARK.json>
```
