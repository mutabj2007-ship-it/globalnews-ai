# T1 — Coverage Truthfulness (CTO contract R2 T1)

- **Base SHA:** `5513275ff731936a07c01e937b92c263ba6d6cf9` (live Alpha)
- **Branch:** `claude/stage2-t1-coverage-truthfulness`
- **History:** an interrupted run left a WIP commit (`a39bdb29`); it was reviewed, corrected, completed and squashed into the commits on this branch. Nothing from the WIP was kept unreviewed.

## 1. What changed for the reader

GlobalNewsAI no longer implies it has local coverage it does not have. A country read on the map (the selected-country card and the country context shelf) now says so whenever no rights-cleared local news source is active for that country, for example: *"Local coverage gap: no rights-cleared local news source is active here. These reports come from international or aggregated sources."* (en + pl). Today that applies to every governed country (54 of 54) and to every non-governed country, because no local source in any registry is both active and rights-cleared.

## 2. Design

### 2.1 One canonical coverage state (shared/src/global-reach.ts)

The existing shared accounting `accountSourceCoverage` is **extended**. No second coverage system exists, and no module has its own. Each row keeps its legacy research `state` (`VALIDATED_LOCAL_BASELINE | PARTIAL | UNVERIFIED | COVERAGE_GAP`, semantics unchanged) and gains:

| field | meaning |
|---|---|
| `coverageState` | `COVERED_LOCAL` / `UNVERIFIED` / `COVERAGE_GAP`, rolled up as the weakest domain |
| `coverageDomains[]` | per domain: `state`, listed / active / rights-cleared / qualified / rights-blocked local counts |
| `activeInternationalSources[]` | aggregators active for this process, each with its recorded rights state |
| `coverageGapReason` | the reason in words, e.g. `NEWS_REPORTING: 3 local source(s) listed, none active` |

Rule (`accountDomainCoverage`):

- **COVERED_LOCAL**: at least one LOCAL source in the domain is ACTIVE, rights `CLEARED` (only `standing PERMITTED` with a resolved binding counts) and measured (verified, healthy, capture-capable).
- **UNVERIFIED**: a source is active and rights-cleared but has no delivery measurement.
- **COVERAGE_GAP**: every other case, including listed but disabled, active with unresolved rights, and nothing listed.

**Domains** come from the existing pack field `sourceClass`: `NEWS_PROVIDER` maps to `NEWS_REPORTING`, and every other class (official / statistics / central bank / parliament ...) maps to `OFFICIAL_PUBLIC_DATA`. No new pack field was declared.

**Registries folded in** (`backend/src/modules/global-reach/source-coverage.authority.ts` gathers them; the shared code does the accounting): the canonical global-reach packs (N/O/P), the curated feed registry, and the official-source registry. One publisher that appears in several registries is merged by host or subdomain and counted once. When merged, the rights state takes the more restrictive value (`stricterRightsState`) and is never upgraded.

**Rights states** (`SourceRightsState`): `CLEARED | RESTRICTED | PROHIBITED | UNRESOLVED | LIMITED_SCOPE_REVIEW | UNREVIEWED | RIGHTS_UNDER_E1_REVIEW`. For pack entries, `packEntryRightsState` reads the original research status that the canonical normalizer preserved verbatim:

- `RESTRICTED` and `RESTRICTION_OBSERVED` map to RESTRICTED.
- `NOT_REVIEWED` maps to UNREVIEWED.
- `RESTRICTION_OR_NOTICE_OBSERVED` maps to UNRESOLVED. This is deliberate: the normalizer keeps it as standing UNKNOWN, not RESTRICTED, so it is never cleared and is also not a recorded restriction.
- Anything unknown maps to UNRESOLVED.

### 2.2 Local vs international evidence (backend/src/modules/news/identity/evidence-locality.util.ts)

`classifyEvidenceLocality(url, iso3, registry)` works only from the record's **registrable domain**, using the same `resolveRegistrableDomain` as `publisher-identity.util.ts`:

- `LOCAL`: matches a registered LOCAL publisher or institution host for that country (packs, feeds, official registry).
- `INTERNATIONAL`: matches a registered host of another country, or a registered INTERNATIONAL publisher.
- `UNVERIFIED_LOCALITY`: no registered host matches, or the URL is unusable. Such a record is never presented as local.

The classifier never uses `sourceName`, never uses the transporting provider and never uses a provider country tag. A GNews record is therefore non-local unless its own URL proves local. A suffix-collapse guard covers unknown multi-part suffixes (e.g. `com.sa`): it falls back to exact host or subdomain matching, so an error can only under-claim locality.

### 2.3 Reader-facing disclosure

- **Backend (additive, optional):**
  - `CountryNewsResponse.sourceCoverage` is stamped by `CountryNewsController` on a copy of the response; the service cache is never mutated.
  - `AnalysisRetrievalContext.sourceCoverage` is stamped in `AnalysisService` when a country was established.
  - Both use `SourceCoverageDisclosure`: `{ iso3, governed, state (news domain), domains[], evidence{local, international, unverifiedLocality}, internationalSources[{sourceId, displayName, rightsState}], notice }`, where `notice` is `LOCAL_COVERAGE_ABSENT | LOCAL_COVERAGE_UNVERIFIED | null`.
- **Frontend (non-protected surfaces):**
  - `EvidenceSelectionCard` (map rail, through `countryReadPresentationFrom`, in both READY states).
  - `MobileSpatialShell` (phone sheet; the same sentence from the same presentation field).
  - `CountryContextShelf` (through `resolveSourceCoverageNotice`).
  - Dictionary keys were added for **en + pl only**: `map.sourceCoverage.*` and `map.spatial.card.countryRead.coverageAbsent|coverageUnverified`. Other locales are T2; `getDictionary` falls back to en.
- **Admin:**
  - `GET admin/global-reach/coverage-state` returns the canonical state per governed country and domain.
  - The global-reach `summary()` gains `coverageStates`.
  - Admin news providers list each feed's `rightsState` and `activationRefused`.

### 2.4 Machine-readable coverage check

`backend/src/modules/global-reach/coverage-check.ts` generates the deterministic JSON, and the result is committed at `docs/convergence/stage2/coverage-check.json`. To regenerate:

```
cd backend && npx ts-node --transpile-only src/modules/global-reach/coverage-check.ts --write
```

The JSON covers each priority region (East Africa 11, EU-27 27 with **Poland as the deep reference** carrying a per-source list, Middle East 16), each country, and each domain. For each it gives the canonical state, the listed / active / rights-cleared / qualified / rights-blocked local counts, the active international sources with their rights, the GNews rights state, the feed rights-gate refusals and the activatable-but-unresolved feeds.

- It reads no clock, no environment and no network.
- It runs under a **declared activation profile**: GNews holds a usable key, and RSS and GDELT DOC are at their shipped defaults (off). The profile is stated inside the JSON.
- `stateIndependentOfActivation` shows that switching on every activatable source changes no state today.
- `coverage-check.spec.ts` pins the committed file byte-for-byte to the registries, so it fails on drift.

Current result: **54/54 COVERAGE_GAP**, in both domains; 0 COVERED_LOCAL; 0 UNVERIFIED.

### 2.5 Rights gate on activation (PROVIDER-RIGHTS-ACTIVATION-GATE-1)

- Every `FEED_SOURCES` entry now carries `rights: { state, evidence }`, copied from pack evidence and never inferred from a fetch. **None is CLEARED.**

| feed | recorded state | evidence |
|---|---|---|
| feed:ktpress-rw | UNRESOLVED | east-africa-r1/RWA.json ea-r1:rwa:ktpress |
| feed:taarifa-rw | LIMITED_SCOPE_REVIEW | east-africa-r1/RWA.json ea-r1:rwa:taarifa |
| feed:standardmedia-ke | **RESTRICTED** | east-africa-r1/KEN.json ea-r1:ken:standard (terms §§11–12) + G R10 |
| feed:cbk-ke | UNRESOLVED | east-africa-r1/KEN.json ea-r1:ken:cbk |
| feed:gus-pl | UNREVIEWED | eu27/countries/PL.json (statistics) |
| feed:wp-pl | **PROHIBITED** | G R10 ruling "ACTIVATION PROHIBITED" (stricter than pack UNREVIEWED) |

- `resolveActiveFeedSources` refuses RESTRICTED or PROHIBITED feeds, whether they are named in `RSS_FEED_SOURCES` or shipped `enabled`. Each refusal is returned in `refused` with its reason and evidence, logged once, and shown in provider health (message + structured `sourceRights`) and in the admin provider list. Activated feeds whose rights are not CLEARED stay activatable and are listed in `rightsUnresolved`.
- The global-reach acquisition worker applies the same predicate (`rightsBlockActivation(packEntryRightsState(...))`) and refuses with `RIGHTS_RESTRICTED` before readiness is considered.

### 2.6 Placeholder credentials (backend/src/security/placeholder-credential.ts)

There is one shared helper, `isUsableApiCredential`, with `isPlaceholderCredential` and `describeUnusableCredential`. It is used by:

- GNews: selection, startup guard, health, request path
- Event Registry
- OpenAI: selection, startup guard, admin AI posture
- X / YouTube social lanes

Every `.env.example` placeholder (`replace_with_your_gnews_key`, `..._event_registry_key`, `..._openai_key`) counts as **not configured**; an anti-drift test reads `.env.example`.

The matching is conservative by design. Only whole-value matches count, never substrings: the shipped placeholder set from `auth-secrets.config.ts`, `replace_with_*`, `your_*_key`, unrendered templates (`<...>`, `${...}`, `{{...}}`), `xxx` / `****` runs, and bare `test-key` / `dummy_api_key` style values. Values such as `test-key-12345` are accepted. A false negative costs a clear upstream auth error; a false positive would silently switch a real key off.

### 2.7 Zero new provider calls

Coverage is computed only from static registries, configuration values and the articles already retrieved. Tests prove it:

- `global.fetch` spies are asserted uncalled for accounting, classification, disclosure and the coverage check.
- The country controller stamps coverage after exactly one service read.
- The analysis spec shows no extra provider call.
- The frontend resolvers contain no fetch or API import, and the runtime fetch spy stays uncalled.

### 2.8 GNews

GNews is **not** disabled for lacking a rights record, and its rights are **not** declared accepted. Its recorded state is `RIGHTS_UNDER_E1_REVIEW`, with a note pointing at the open public-beta review item. Its evidence never counts as local. No AI calls and no quota changes were made.

## 3. Changed-file manifest

| status | file | +/- |
|---|---|---|
| modified | `backend/src/modules/admin/admin-global-reach.controller.ts` | +27 / -0 |
| modified | `backend/src/modules/admin/news/admin-news.service.ts` | +3 / -0 |
| modified | `backend/src/modules/admin/system/admin-system.contract.ts` | +4 / -0 |
| modified | `backend/src/modules/admin/system/admin-system.service.ts` | +3 / -2 |
| modified | `backend/src/modules/analysis/providers/provider.tokens.ts` | +3 / -1 |
| modified | `backend/src/modules/analysis/service/analysis.service.spec.ts` | +9 / -0 |
| modified | `backend/src/modules/analysis/service/analysis.service.ts` | +49 / -0 |
| added | `backend/src/modules/analysis/service/analysis.source-coverage.spec.ts` | +178 / -0 |
| modified | `backend/src/modules/analysis/startup/analysis-startup-validator.ts` | +2 / -4 |
| added | `backend/src/modules/global-reach/coverage-check.spec.ts` | +69 / -0 |
| added | `backend/src/modules/global-reach/coverage-check.ts` | +218 / -0 |
| modified | `backend/src/modules/global-reach/global-reach-acquisition.service.ts` | +9 / -1 |
| modified | `backend/src/modules/global-reach/global-reach.service.ts` | +34 / -4 |
| modified | `backend/src/modules/global-reach/regional-admission.spec.ts` | +20 / -2 |
| added | `backend/src/modules/global-reach/source-coverage.authority.spec.ts` | +219 / -0 |
| added | `backend/src/modules/global-reach/source-coverage.authority.ts` | +244 / -0 |
| modified | `backend/src/modules/news/article-metadata-hygiene.util.spec.ts` | +2 / -1 |
| modified | `backend/src/modules/news/country/country-news.controller.ts` | +42 / -3 |
| added | `backend/src/modules/news/identity/evidence-locality.util.ts` | +114 / -0 |
| modified | `backend/src/modules/news/providers/b5ProviderDormancy.spec.ts` | +28 / -20 |
| added | `backend/src/modules/news/providers/feed-rights-gate.spec.ts` | +102 / -0 |
| modified | `backend/src/modules/news/providers/feed-source-registry.ts` | +110 / -5 |
| modified | `backend/src/modules/news/providers/gnews.failure-kind.spec.ts` | +1 / -1 |
| modified | `backend/src/modules/news/providers/gnews.provider.spec.ts` | +38 / -38 |
| modified | `backend/src/modules/news/providers/gnews.provider.ts` | +5 / -3 |
| modified | `backend/src/modules/news/providers/provider.tokens.ts` | +4 / -1 |
| modified | `backend/src/modules/news/providers/rss-feed.provider.spec.ts` | +19 / -8 |
| modified | `backend/src/modules/news/providers/rss-feed.provider.ts` | +41 / -5 |
| modified | `backend/src/modules/news/social/social-search.providers.ts` | +5 / -2 |
| modified | `backend/src/modules/news/startup/news-startup-validator.ts` | +2 / -4 |
| modified | `backend/src/modules/signals/providers/event-registry.provider.ts` | +3 / -1 |
| added | `backend/src/security/placeholder-credential.spec.ts` | +150 / -0 |
| added | `backend/src/security/placeholder-credential.ts` | +96 / -0 |
| added | `docs/convergence/stage2/T1-COVERAGE-TRUTHFULNESS.md` | (this file) |
| added | `docs/convergence/stage2/coverage-check.json` | +2191 / -0 |
| modified | `frontend/src/components/map/CountryContextShelf.tsx` | +23 / -1 |
| modified | `frontend/src/components/map/countryPanelText.ts` | +24 / -0 |
| modified | `frontend/src/components/map/mobile/MobileSpatialShell.tsx` | +17 / -0 |
| modified | `frontend/src/components/map/shell/EvidenceSelectionCard.tsx` | +22 / -0 |
| modified | `frontend/src/components/map/shell/GlobalMapShell.tsx` | +1 / -0 |
| added | `frontend/src/components/map/sourceCoverageDisclosure.spec.ts` | +164 / -0 |
| modified | `frontend/src/lib/i18n/dictionaries/en.ts` | +22 / -0 |
| modified | `frontend/src/lib/i18n/dictionaries/pl.ts` | +15 / -0 |
| modified | `frontend/src/lib/map/retrieval/countryReadPresentation.ts` | +12 / -2 |
| modified | `shared/src/analysis.ts` | +10 / -0 |
| added | `shared/src/global-reach-coverage.spec.ts` | +158 / -0 |
| modified | `shared/src/global-reach.ts` | +375 / -0 |
| modified | `shared/src/news.ts` | +19 / -0 |

The dossier itself is included. No protected file (scratchpad `protected-files.tsv`, 216 paths across H+R4 / HUMANITARIAN / POLITICS) is touched. No changed file is stored with CRLF at base, so no byte-identity restaging was needed.

## 4. Tests added / updated

**Added**

- `shared/src/global-reach-coverage.spec.ts`: domain rule, merge strictness, rights mapping (incl. NOT_REVIEWED, RESTRICTION_OR_NOTICE_OBSERVED), disclosure.
- `backend/src/modules/global-reach/source-coverage.authority.spec.ts`: 54-country gap, Kenya dedup, activated-unresolved feed, GNews activation by usable key, locality classifier (sourceName ignored, suffix-collapse guard, every pack host LOCAL), disclosure, zero HTTP, controller single read.
- `backend/src/modules/global-reach/coverage-check.spec.ts`: committed JSON equals generated output, determinism, regions and Poland, GNews state, maximal activation, zero HTTP.
- `backend/src/modules/news/providers/feed-rights-gate.spec.ts`: recorded rights, gate refusals (allowlist + shipped enabled), health surfacing, refused feed never fetched.
- `backend/src/modules/analysis/service/analysis.source-coverage.spec.ts`: retrievalContext.sourceCoverage, ISO2 to ISO3, absent when no country, no extra provider call.
- `backend/src/security/placeholder-credential.spec.ts`: helper, `.env.example` anti-drift, every provider check, startup guard, GNews health makes no request, social lanes.
- `frontend/src/components/map/sourceCoverageDisclosure.spec.ts`: shelf notice en/pl, card notice in both READY states, nothing when covered or absent, no fetch.

**Updated deliberately** (they asserted the old placeholder-accepting / restricted-activating behaviour)

- `backend/src/modules/news/providers/b5ProviderDormancy.spec.ts`: the "RECORDED GAP" tests were rewritten as their own comments instructed, so they now assert the gate is closed.
- `backend/src/modules/news/providers/rss-feed.provider.spec.ts`: six named feeds now give four active feeds and two refused (standardmedia RESTRICTED, wp.pl PROHIBITED); request counts go from 6 to 4.
- `backend/src/modules/global-reach/regional-admission.spec.ts`: the service now equals shared accounting plus the registry candidates; `coverageStates` was added; RESTRICTED pack entries are refused as `RIGHTS_RESTRICTED`.
- `backend/src/modules/news/providers/gnews.provider.spec.ts`, `gnews.failure-kind.spec.ts`, `backend/src/modules/news/article-metadata-hygiene.util.spec.ts`: the fixture key `test-key` is a placeholder under the new rule, so it was replaced with a non-placeholder fixture.
- `backend/src/modules/analysis/service/analysis.service.spec.ts`: three exact `toEqual` assertions on `retrievalContext` (ESP live, RWA cached, RWA+Kigali) now also expect the additive `sourceCoverage` (`expect.objectContaining({ iso3, notice: 'LOCAL_COVERAGE_ABSENT' })`).
- `frontend/src/components/map/mobile/MobileSpatialShell.tsx` is new code, not a test; it is listed here because `sourceCoverageDisclosure.spec.ts` asserts the phone sheet renders the notice.

## 5. Qualification

All runs are on this worktree at the final state, executed sequentially.

| check | result |
|---|---|
| `npm run build:shared` | pass |
| `npm run build:backend` | pass (packaging verifier: 11 runtime data files OK) |
| `npm run build:frontend` | pass (two pre-existing exhaustive-deps warnings in untouched lines) |
| `npm run test --workspace=shared` | 15/15 suites, 540/540 tests |
| focused backend (global-reach, news providers/country/identity, security, analysis coverage) | pass, except the 3 pre-existing `gnews.provider.spec` health failures that are also in the baseline |
| focused frontend `sourceCoverageDisclosure.spec.ts` | 11/11 |

**Full suites compared with the Stage-0 baselines (same base SHA).** The comparison keys are suite path relative to `backend/` or `frontend/` plus the test fullName, together with the set of suites that failed to run.

| suite | baseline tests / passed / failed (suites, failed suites, runtime errors) | T1 tests / passed / failed (suites, failed suites, runtime errors) |
|---|---|---|
| backend | 11868 / 11385 / 33 (439, 10, 0) | 11945 / 11462 / 33 (444, 10, 0) |
| frontend | 8293 / 8259 / 21 (380, 13, 3) | 8304 / 8270 / 21 (381, 13, 3) |

- **New failures:** none (backend and frontend).
- **Fixed failures:** none.
- **New or resolved suites that failed to run:** none.
- **SIGKILL / OOM:** none observed.

The first full backend run showed 6 new failures: 3 exact-`toEqual` assertions on `retrievalContext` in `analysis.service.spec.ts`, and 3 GNews cases in `article-metadata-hygiene.util.spec.ts` whose fixture key was `test-key`. Both were updated deliberately (§4) and the full run was repeated; the table shows the repeated run.

## 6. Integration dependencies

### 6.1 Ask-answer surface (protected H+R4 files) — exact spec, not implemented here

The Ask path already receives `AnalysisApiResponse.retrievalContext`, and since T1 that object carries `sourceCoverage` whenever a country was established. **No backend change and no extra request are needed.** Integration to be done by the Ask lane owner:

1. `frontend/src/lib/ask/askR2View.ts` (protected). Next to `const retrieval = analysis?.retrievalContext;` (around L323), derive `const localCoverage = retrieval?.sourceCoverage?.notice ?? null;` and expose it on the view model, e.g. `coverageNotice: 'LOCAL_COVERAGE_ABSENT' | 'LOCAL_COVERAGE_UNVERIFIED' | null`. Do not derive it from `providerDisplayName` or `sourceName`.
2. `frontend/src/lib/ask/askR2Strings.ts` / `askSevenStrings.ts` (protected). Add one sentence per notice: en and pl now, the other five locales in T2. Reuse the meaning of `map.spatial.card.countryRead.coverageAbsent` and `coverageUnverified`: "Local coverage gap: no rights-cleared local news source is active here. These reports come from international or aggregated sources."
3. `frontend/src/components/ask-frame/AskSourcesColumn.tsx` and/or `AskIntelligenceBasis.tsx` (protected). Render the sentence once, under the sources heading, when `coverageNotice !== null`, with `data-gn="ask-source-coverage"`. Never label any source "local" unless its registrable domain classified `LOCAL`. Server-side, `sourceCoverage.evidence.local` is the count to show; no per-article locality is shipped yet (see §7).
4. `backend/src/modules/ask-v2/ask-r2-execution.adapter.ts` (protected). No change is required. If the adapter ever rebuilds `retrievalContext`, it must carry `sourceCoverage` through unchanged.
5. Tests: when `retrievalContext.sourceCoverage.notice === 'LOCAL_COVERAGE_ABSENT'`, the Ask turn renders the sentence; when the fact is absent or null it renders nothing. No fetch is added (spy on `global.fetch`, as `sourceCoverageDisclosure.spec.ts` does).

### 6.2 Other

- **Whole-product matrix:** read `docs/convergence/stage2/coverage-check.json` (schemaVersion 1).
- **T2 (locales):** add `map.sourceCoverage.*` and the two `countryRead.coverage*` keys for de/es/fr/pt/ar/sw/rw when those dictionaries become real; `getDictionary` currently falls back to en.
- **Rights lane / E1 legal review:** the only way to reach COVERED_LOCAL is a pack entry with `rights.standing PERMITTED` plus a binding (or a feed recorded `CLEARED` with evidence), and it must be ACTIVE and measured. Clearing GNews means changing `INTERNATIONAL_NEWS_SOURCES[gnews].rightsState`, and it still would not count as local.

## 7. Known limitations

- **Declared activation profile.** The committed coverage check assumes "GNews key usable, RSS/GDELT off". It cannot see a deployment's real secrets. Live responses use the running process's actual configuration. Under current registries the canonical states do not depend on activation (`stateIndependentOfActivation: true` everywhere).
- **Feed fetch is not counted as delivery measurement.** A feed `verifiedAt` fetch is a technical check, so feeds have `measured: false`. A rights-cleared active feed would therefore show UNVERIFIED, not COVERED_LOCAL, until a delivery measurement exists.
- **Official-source registry rights are recorded as UNRESOLVED.** The rights binding there is a key to a record, not a grade, and resolving it belongs to the economy lane.
- **Locality is only as good as the registered hosts.** Unregistered domains are `UNVERIFIED_LOCALITY`, which errs toward never claiming local. The disclosure carries counts, not per-article labels.
- **Placeholder detection is deliberately narrow.** It matches whole values only, so an unusual placeholder string can still pass as configured. That shows up as an upstream auth error, as before.
- **Ask surface.** The Ask surface does not render the notice yet; that is protected files, spec in §6.1.
