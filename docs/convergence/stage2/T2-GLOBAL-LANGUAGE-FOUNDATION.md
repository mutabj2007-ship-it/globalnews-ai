# T2 — Whole-Product Seven-Language Foundation

| | |
|---|---|
| Exact base | `266007c930e8293638bc7971670ee0264923c18c` (FINAL H Ask reading/localization handoff, `handoff/r4-h-answer-reading-5699eb7`: R4 semantic baseline 5699eb7 + Claude H + Claude L Ask-shell delivery) |
| Branch | `claude/stage2-t2-global-language-foundation` |
| Integration dependency | Lands **after final R4**. It consumes H's Ask locale modules read-only; any later H change to `askShellCoverage` / `askSevenStrings` re-measures automatically (and the manifest-equality test forces a regenerated manifest). |
| Public display locales | `en, pl, fr, de, es, pt, ar` — `DisplayLocale` (`shared/src/language`). Never collapsed with retrieval `LanguageCode` (`shared/src/analysis.ts`). |

## 1. Architecture

### 1.1 One selection + persistence authority — `frontend/src/lib/i18n/displayLocale.ts`

* Cookie `globalnews-ai-language` and localStorage key `globalnews-ai:language` are **unchanged** (no stored preference lost).
* Every stored value is validated against the shared `DISPLAY_LOCALES` (seven) — never `ACTIVE_LANGUAGES` (the en/pl retrieval set).
* `persistDisplayLocale` is the one writer (`persistLanguageSelection` in `languages.ts` is kept as an alias so every selector keeps working).
* `reconcileDisplayLocale` (pure) is the decision behind `LanguageSync` and `Hero`:
  * valid cookie → it **is** the choice; never overwritten (a disagreeing mirror is repaired from the cookie, no refresh);
  * cookie cleared, mirror valid → cookie restored from the mirror (refresh if not English);
  * nothing stored → browser detection over all seven (`navigator.languages` in order), persisted, refresh if not English.
  This retires the measured P0: `readLanguageCookie`/`resolveInitialLanguage` validated against en|pl, so a stored `fr` was rejected and a Polish browser **overwrote it with `pl`**.
* The **requested** locale is what is persisted; the effective (rendered) locale never is.
* Server side — `displayLocale.server.ts`: `requestedDisplayLocale()`, `surfaceLocale(surface)` (route pages / layouts / metadata). `documentLocale.server.ts`: `documentSurfaceLocale()` for the root layout — the surface is found from the `x-gna-pathname` header the middleware forwards (path only) via `surfaceRoutes.ts`.
* Client language controls (`NavBar`, `HomeLanguageControl`, `MapLanguageControl`, `WorkspaceNav`) show the **requested** locale via `useRequestedDisplayLocale` (first render = server value, so no hydration mismatch). Without this, a reader on a declared English fallback saw "English" as their choice and the `next === current` guard made choosing English a no-op (they could never switch back). Ask's `AskNavShell` (H+R4) needs no change: every Ask surface is FULL in all seven.
* `resolveInitialLanguage()` (still called by H's `SearchPageClient`) and the error boundary now return the document's **effective** language (`documentRenderLanguage`, read from `<html lang>`), so client components agree with the server render instead of re-deriving from storage. `global-error.tsx` (which replaces the root layout) resolves the stored choice against the failure catalogue itself.

### 1.2 The effective-locale rule — runtime `frontend/src/lib/i18n/surfaceLocale.ts`; measurement `frontend/src/qualification/i18n/{catalogueCoverage,surfaceCoverage}.ts`

* A surface renders the selected locale **only if every catalogue namespace it uses is complete** for it. A key is complete when translated, `QUALIFIED_UNCHANGED` or `NOT_TRANSLATED_BY_DESIGN` (`declaredKeyStates.ts`, 32 keys — brands, protocol tokens, window labels; a test asserts each declared key's English value is identifier-shaped, never prose).
* Otherwise the **whole surface renders English** and the root layout renders `DisplayLocaleNotice` — the declared fallback notice **in the selected language**, carrying that language's own `lang`/`dir`.
* **Measured, then generated.** The qualification tooling under `src/qualification/i18n/` reads every catalogue to measure completeness; `scripts/i18n/t2-reconcile-catalogues.cjs` writes the result to `lib/i18n/surfaceRenderable.generated.ts`, which is all the runtime reads. A test asserts generated == live measurement, and another that no product file imports `@/qualification/` — so a Politics preview does not load the Admin dictionary, the Ask shell or any other surface's catalogue to decide its own `<html lang>` (the Politics/Security/Alpha preview provider-reachability and domain-containment guards stay green). Completeness is measured, never hand-listed: the main dictionary is split into one namespace per top-level object (`dict:navBar`, `dict:map`, …), each module catalogue is a namespace, and H's Ask shell is measured by H's own `askShellCoverage` (consumed).
* Surface namespace lists are conservative supersets (listing one too many can only cause a declared fallback, never fake completeness).
* `LANGUAGE_CODE`-typed component trees cannot be given `de`/`pt`; such surfaces treat de/pt as incomplete (declared fallback), never a cast (`†` in the table below).
* Root `<html lang>` and `<html dir>` come from the shared `documentLanguageOf(resolveContentLocale(...))` — the **effective** locale; `dir` from the shared `LANGUAGE_DIRECTION` meta (`directionFor`; ar = rtl). `languages.ts`'s `LANGUAGE_DIRECTION` is now derived from the same table. An Arabic effective locale makes the **whole document** RTL; URLs/source names/IDs keep H's LTR isolation (`ScriptRun`/`AskLtr`, unchanged). (Economy's frame keeps its contract-pinned `dir="ltr"` — Economy cannot render `ar` today; see limitations.)
* `getDictionary` accepts any display locale and merges Claude L's qualified overlay (`qualifiedDictionaryOverlays.ts`, **empty**) over English — the slot where qualified FR–AR wording lands at runtime (under `frontend/src`).

### 1.3 Declared fallback notice — `fallbackNotice.ts`

* fr/de/es/pt/ar: the localisation lane's `languageFallback.chromeNotice` strings (L-LANG-CATALOG-1, recovered C55, already in-tree at `lib/i18n/recovered/c55-*.ts`); a test asserts byte equality with the recovered source. Status `RECOVERED_L_APPROVED` (pending L re-confirmation — the namespace has no counterpart in today's English).
* en/pl: T2-authored minimal notice (`T2_AUTHORED_PENDING_L_QUALIFICATION`). English never shows it; Polish shows it on the surfaces whose module catalogue is English-only.
* H/L's `askShell … localeFallback` was considered first; it declares a PARTIAL fallback ("these labels display in English; the rest follows your language") — the opposite of a whole-surface fallback — so it is not reused.

## 2. Surface × locale result (after reconciliation)

`FULL` = renders the selected locale. `FB n` = DECLARED_FALLBACK (English + notice in the selected language), `n` = gap keys across the surface's namespaces. `†` = additionally not expressible (LanguageCode tree). Namespaces / English keys = how much the surface was measured over.

| Surface | Route | Namespaces / keys | en | pl | fr | de | es | pt | ar | Route protection |
|---|---|---|---|---|---|---|---|---|---|---|
| home (platform `/`) | `/` (GNA_PUBLIC_ROOT=platform) | 41 / 2640 | FULL | FULL | FB 2089 | FB 2089† | FB 2089 | FB 2089† | FB 2089 | HUMANITARIAN |
| askStandalone | `/`, `/ask` | 2 / 559 | FULL | FULL | FULL | FULL | FULL | FULL | FULL | |
| askRecent | `/ask/recent` | 2 / 559 | FULL | FULL | FULL | FULL | FULL | FULL | FULL | |
| saved | `/saved`, `/saved/briefing` | 2 / 559 | FULL | FULL | FULL | FULL | FULL | FULL | FULL | |
| accountSettings | `/account/*` | 11 / 723 | FULL | FULL | FB 163 | FB 163† | FB 163 | FB 163† | FB 163 | page H+R4 |
| search | `/search` | 21 / 1104 | FULL | FULL | FB 567 | FB 567† | FB 567 | FB 567† | FB 567 | |
| map | `/map` | 23 / 1791 | FULL | FULL | FB 1240 | FB 1240† | FB 1240 | FB 1240† | FB 1240 | |
| conflict | `/conflict` | 11 / 1382 | FULL | FULL | FB 832 | FB 832† | FB 832 | FB 832† | FB 832 | |
| energy | `/energy` | 2 / 166 | FULL | FULL | FB 166 | FB 166† | FB 166 | FB 166† | FB 166 | |
| market | `/market` (+compact) | 10 / 788 | FULL | FB 102 | FB 252 | FB 252† | FB 252 | FB 252† | FB 252 | |
| humanitarian | `/humanitarian` (+compact) | 10 / 806 | FULL | FB 120 | FB 270 | FB 270† | FB 270 | FB 270† | FB 270 | HUMANITARIAN |
| economy | `/economy-visual-preview` (+compact) | 4 / 129 | FULL | FB 12 | FB 17 | FB 17 | FB 17 | FB 17 | FB 17 | |
| politics | `/politics-visual-preview` (+compact) | 2 / 92 | FULL | FULL | FB 92 | FB 92 | FB 92 | FB 92 | FB 92 | |
| election | `/election-visual-preview` (+compact) | 2 / 49 | FULL | FULL | FB 49 | FB 49 | FB 49 | FB 49 | FB 49 | |
| security | `/security-visual-preview` (+compact) | 2 / 44 | FULL | FB 39 | FB 44 | FB 44 | FB 44 | FB 44 | FB 44 | |
| delivery | `/delivery-visual-preview` (+compact) | 2 / 32 | FULL | FULL | FB 32 | FB 32 | FB 32 | FB 32 | FB 32 | |
| imihigo | `/imihigo` | 2 / 32 | FULL | FULL | FB 32 | FB 32 | FB 32 | FB 32 | FB 32 | |
| myIntelligence | `/my-intelligence` | 23 / 1652 | FULL | FULL | FB 1091 | FB 1091† | FB 1091 | FB 1091† | FB 1091 | |
| support | `/support` | 11 / 812 | FULL | FULL | FB 252 | FB 252† | FB 252 | FB 252† | FB 252 | |
| history | `/history` | 10 / 690 | FULL | FB 4 | FB 154 | FB 154† | FB 154 | FB 154† | FB 154 | |
| privacy | `/privacy` | 11 / 713 | FULL | FULL | FB 177 | FB 177† | FB 177 | FB 177† | FB 177 | |
| terms | `/terms` | 10 / 691 | FULL | FULL | FB 155 | FB 155† | FB 155 | FB 155† | FB 155 | |
| cookies | `/cookies` | 10 / 708 | FULL | FULL | FB 172 | FB 172† | FB 172 | FB 172† | FB 172 | |
| sourcePolicy | `/source-policy` | 10 / 691 | FULL | FULL | FB 155 | FB 155† | FB 155 | FB 155† | FB 155 | |
| thirdPartyNotices | `/third-party-notices` | 10 / 696 | FULL | FULL | FB 160 | FB 160† | FB 160 | FB 160† | FB 160 | |
| workspace | `/workspace` | 21 / 1189 | FULL | FULL | FB 652 | FB 652† | FB 652 | FB 652† | FB 652 | |
| admin | `/admin/*` | 10 / 1264 | FULL | FULL | FB 712 | FB 712† | FB 712 | FB 712† | FB 712 | |
| failure (not-found / error) | — | 3 / 83 | FULL | FULL | FB 83 | FB 83† | FB 83 | FB 83† | FB 83 | |
| default (any other route) | — | 9 / 686 | FULL | FULL | FB 150 | FB 150† | FB 150 | FB 150† | FB 150 | |

**Plainly:** after reconciliation, **only the Ask surfaces (standalone `/` + `/ask`, `/ask/recent`, `/saved`) render FULL in fr/de/es/pt/ar** — they are H/L's complete Ask shell. Every other surface is a DECLARED English fallback for fr–ar until Claude L qualifies its namespaces. For Polish, five surfaces whose module catalogue was always English-only (Market, Humanitarian, Economy inline literals, Security, History) are now a declared English fallback instead of a silent mixed Polish-chrome/English-body page. The machine-readable table is `translation-manifest.json#surfaces` (asserted equal to the live rule by `catalogueCoverage.spec.ts`).

## 3. Catalogue reconciliation (requirement 5)

Script: `scripts/i18n/t2-reconcile-catalogues.cjs` (deterministic; re-run after any catalogue change — `catalogueCoverage.spec.ts` fails until the manifest matches the measured gaps exactly).

Rule applied: keep a recovered translation only if the key still exists **and** its English source is unchanged. The recovered C55 catalogues (`frontend/src/lib/i18n/recovered/c55-*.ts`, L-LANG-CATALOG-1) carry **no English source**, and the C55 snapshot `3db5a09` is unreachable (verified: not in this repository and not in any of origin's 262 refs, incl. `refs/pull/*`). Provenance is therefore unknown for every key ⇒ **nothing is kept for runtime**; surviving values are handed to Claude L as candidates. Stale keys are dropped. Nothing was machine-translated.

| Locale | Recovered leaves | Kept for runtime | Declared (QU / NTBD) | Candidates (provenance unknown) | …of which EN unchanged since line root c9473e32 (advisory) | Dropped stale | Missing (no candidate) |
|---|---|---|---|---|---|---|---|
| fr | 1789 | 0 | 32 | 1637 | 1622 | 120 | 1138 |
| de | 1789 | 0 | 32 | 1637 | 1622 | 120 | 1138 |
| es | 1789 | 0 | 32 | 1637 | 1622 | 120 | 1138 |
| pt | 1789 | 0 | 32 | 1637 | 1622 | 120 | 1138 |
| ar | 1789 | 0 | 32 | 1637 | 1622 | 120 | 1138 |

(English main dictionary: 2807 leaves.) The "EN unchanged since line root" column is a triage hint only, not provenance.

Outputs (reports — **not** runtime; nothing under `docs/` is imported):

* `docs/convergence/stage2/t2/reconciled/{fr,de,es,pt,ar}.json` — per-locale reconciled catalogue (`keptForRuntime: {}`, `droppedStale`, `candidates`).
* **Translation work manifest for Claude L:** `docs/convergence/stage2/t2/translation-manifest.json` — every gap key per namespace × locale with its English source text and state (`MISSING` / `CANDIDATE_PROVENANCE_UNKNOWN`), plus the surface table. Totals: pl 277 keys / 5 namespaces; fr, de, es, pt, ar 3525 keys / 60 namespaces each.
* `docs/convergence/stage2/t2/reconciliation-summary.json` — the numbers above.

Qualified wording lands at runtime in `frontend/src/lib/i18n/qualifiedDictionaryOverlays.ts` (main dictionary) or in each module catalogue; a namespace turns complete and every surface using only complete namespaces starts rendering that locale, with `<html lang>`/`dir` following, automatically.

Brand / proper-noun rules kept: "Ask GlobalNewsAI" and "GlobalNews AI" are `NOT_TRANSLATED_BY_DESIGN`; source titles/names/URLs remain source-authored (no catalogue contains them).

## 4. Truthful copy (requirement 7)

* Support `support.conversation.locale.outOfScope` — EN: "Automatic answers in Support are written in English and Polish; your display language does not change this. Write here in either, or a person from Support can take this." PL: "Odpowiedzi automatyczne w Pomocy są pisane po angielsku i po polsku; wybrany język wyświetlania tego nie zmienia. Napisz tutaj w jednym z tych języków albo niech zajmie się tym osoba z zespołu wsparcia." (Still true: the backend Support DTO is `@IsIn(['en','pl'])`; `catalogueLocales.spec.ts` pins the copy to that DTO.) Status: T2-authored EN/PL, pending L review.
* Admin Settings "Admin languages" — derived from the registry (`endonymList(dictionaryNamespaceLocales('admin'))`, today byte-identical "English, Polski"); the dead literal `adminLanguagesValue` was removed from `adminEn`/`adminPl`.
* Backend `product-knowledge.ts` K-35 ("Automatic Support answers are available in English and Polish only") is scoped to Support answers and remains true; not changed.

## 5. Backend (requirement 8)

* `RecordEventDto.language` accepts `TELEMETRY_LANGUAGE_VALUES` = `SUPPORTED_LANGUAGE_CODES ∪ DISPLAY_LOCALES` (de/pt were a 400). Plain string column — no schema change.
* `AnalyzeNewsDto` gains optional `displayLocale` (`@IsIn(DISPLAY_LOCALES)`), separate from `requestedLanguage` (`LanguageCode`, **not widened** — de/pt still rejected there). Presentation context only; no reader yet.
* Test: `backend/src/modules/telemetry/dto/displayLocaleDtos.t2.spec.ts`. Neither file is protected.

## 6. H files consumed (read-only) and protected-file specs

Consumed, not edited: `lib/ask/shell/askShellCatalogue.ts` (`askShellCoverage`, `askShellKeyPaths`), `lib/ask/askSevenStrings.ts`, `lib/ask/askLocale.ts` (`askLanguageDisposition`, `resolveAskLocale`), `lib/ask/shell/locales/*`, `components/ask-nav/*` (AskNavShell, AskShellFrame, AskContinuityHeader, AskThemedPage/Surface, AskClearedBoundary), `components/ask/SavedClient.tsx`, `components/search/SearchPageClient.tsx` (its `resolveInitialLanguage()` call now returns the effective document language), `components/my-intelligence/MyIntelligenceClient.tsx`.

No POLITICS / HUMANITARIAN / H+R4 file is modified (checked against `protected-files.tsv`). Specs to apply after final R4 by the owners:

* **SPEC-T2-HUM-1** (`frontend/src/app/page.tsx`, HUMANITARIAN): replace both `languageCookie && isActiveLanguageCode(languageCookie) ? languageCookie : 'en'` with `surfaceLocale('home').language` (import from `@/lib/i18n/displayLocale.server`); keep `resolveAskLocale(languageCookie)` for the standalone branch (or use `surfaceLocale('askStandalone').effective`). Behaviour today already agrees with the rule (pl FULL; fr–ar → en).
* **SPEC-T2-HUM-2** (`frontend/src/app/humanitarian/page.tsx`, `…/compact/page.tsx`, HUMANITARIAN): `humLanguage()` → `surfaceLocale('humanitarian').language`; `humLocale()` → `surfaceLocale('humanitarian').effective`. **Known inconsistency until applied:** a Polish reader gets Polish chrome + English Humanitarian body from the page while the layout declares `lang="en"` + Polish notice (fr–ar are consistent). After this patch, drop the three paths from `PROTECTED_GATE_READERS` in `displayLocaleAuthority.spec.ts` and delete `isActiveLanguageCode`.
* **SPEC-T2-H-1** (`frontend/src/app/account/settings/page.tsx`, H+R4): `resolveAskLocale(cookies().get(LANGUAGE_COOKIE_NAME)?.value)` → `surfaceLocale('accountSettings').effective` so the page body matches `<html lang>` (today fr–ar give Ask-shell chrome in the reader's locale inside an English-declared document).
* **SPEC-T2-H-2** (`SearchPageClient.tsx`, H+R4, optional): call `documentRenderLanguage()` instead of the `resolveInitialLanguage()` alias.
* **SPEC-T2-H-3** (`frontend/src/lib/ask/askSevenLanguage.spec.ts:320`, H+R4) — **the one expected new test failure.** H's assertion `expect(code(src('app', 'layout.tsx'))).not.toMatch(/dir=/)` encodes H's lane boundary ("this lane does not set dir there"). T2 is mandated (CTO R2 T2 §2) to set root `<html dir>` from the effective locale, so the two contracts conflict by design. Patch: replace line 320 with `expect(code(src('app', 'layout.tsx'))).toMatch(/dir=\{surface\.document\.dir\}/);` and update the comment on line 319 to "<html> lang/dir come from T2's effective surface locale; the Ask scope still declares its own." T2 did not edit the file (protected).

## 7. Tests (requirement 6)

New: `lib/i18n/displayLocale.spec.ts` (validation, reconciliation/no-overwrite incl. Polish browser + stored fr/ar, persistence, effective-language reader), `lib/i18n/surfaceLocale.spec.ts` (every surface × every locale decision, `<html lang>/<dir>` incl. ar→rtl, path→surface, generated table == live measurement), `qualification/i18n/catalogueCoverage.spec.ts` (namespace × locale gaps EQUAL the manifest, surface table, declared keys identifier-only, notice provenance, reconciliation output), `lib/i18n/displayLocaleAuthority.spec.ts` (no route imports `isActiveLanguageCode` except the protected three; no direct cookie readers; selectors show requested locale; every migrated route calls its `surfaceLocale(...)`), `lib/i18n/catalogueLocales.spec.ts` (truthful language copy), backend `displayLocaleDtos.t2.spec.ts`.

Existing tests that deliberately asserted the old clamp/guard text and were updated (each to assert the T2 form):

1. `components/home/Hero.spec.ts` — sync effect regex (`readLanguageCookie() ?? 'en'` → `reconcileStoredDisplayLocale()`).
2. `components/home/m65LanguageIntegrity.spec.ts` — `<html lang={language}>` + `isActiveLanguageCode` → `<html lang={surface.document.lang} dir={surface.document.dir}>` + `documentSurfaceLocale()`; Hero sync assertions.
3. `components/home/homepageLocalization.spec.ts` — root metadata reads `cookies().get(LANGUAGE_COOKIE_NAME)` → `getDictionary(documentSurfaceLocale().language)`.
4. `components/navigation/nativeControlScheme.spec.ts` — `<html …>` literal (dir added); NavBar guard `next === language` → `next === selectedLocale`.
5. `components/search/languageSelector.spec.ts` — NavBar guard as above.
6. `components/map/checkpointFGlobalUx.spec.ts` — MapLanguageControl guard `code === value` → `code === selected`.
7. `components/support/supportAiSurface.spec.ts` — `currentLanguage() === 'pl' ? 'pl' : 'en'` → `effectiveWithin(surfaceLocale('support'), ['en', 'pl'])`.
8. `components/admin/adminShellBoundary.spec.ts` — layout `cookies()` → `surfaceLocale('admin')`.
9. `lib/i18n/dictionaries/adminLocalization.spec.ts` — removed key `adminLanguagesValue` from the identical-by-design list.
10. `app/failureSurfaces.spec.ts` — not-found/error/global-error language assertions (`readLanguageCookie`, `isActiveLanguageCode`, `cookies` import) → the authority (`surfaceLocale('failure')`, `documentRenderLanguage`, `readStoredDisplayLocale`); global-error import allow-list adds `i18n/displayLocale`.
11. `app/legalPages.spec.ts` — privacy/terms resolve via `surfaceLocale(...)`, not `isActiveLanguageCode`.
12. `app/pwaContract.spec.ts` — metadata dictionary source, `<html lang dir>` literal, body children now include `<DisplayLocaleNotice locale={surface} />`.
13. `components/layout/footerGeometry.spec.ts` — /history's Footer now lives in `components/history/HistoryClient.tsx` with `language={language}` (resolves M66.7-DEFERRED-004 for /history).
14. `components/map/checkpointILanguageAuth.spec.ts` — LanguageSync/Hero reconciliation assertions → `reconcileStoredDisplayLocale()`; map route uses `surfaceLocale('map')`.
15. `components/search/searchWorkspace.spec.ts` — search route uses `surfaceLocale('search')`.
16. `lib/politics/politicsVisualFrame.spec.ts` §12 ledger — `lib/i18n/languages.ts` replaced by the five pure locale-authority modules (named exactly; still pinned).
17. `lib/specialist/alphaVisualFrames.spec.ts` — effect enumeration adds `lib/i18n/useRequestedDisplayLocale.ts` (one mount effect reading the stored choice; no network).

## 8. Qualification

All runs on this worktree, sequential (frontend build → full frontend jest → backend build → full backend jest). Baselines: full suites at the exact base `266007c` (`scratchpad/t2-base-fe.json`, `t2-base-be.json`). Comparison by failure SET (suite path + test fullName, plus suites that failed to run).

| Step | Result |
|---|---|
| `npm run build:shared` | pass |
| `npm run build:backend` (nest build + geo packaging verify) | pass |
| `npm run build:frontend` (spatial token/structure verify + `next build`) | pass (2 pre-existing `react-hooks/exhaustive-deps` warnings in map files, unchanged) |
| Frontend jest (391 suites) | 9130 tests: 9094 passed, 23 failed, 13 pending · base 8418 tests, 22 failed |
| Backend jest (441 suites) | 11924 tests: 11441 passed, 33 failed, 450 pending · base 11899 tests, 33 failed |

Failure-set comparison:

* **Backend:** new failures **0**, fixed 0, suites failing to run 0 (= base).
* **Frontend:** new failures **1** — `lib/ask/askSevenLanguage.spec.ts` › "H-4 · Arabic RTL the Ask content scope declares lang and dir, and the product chrome is untouched". This is H+R4-protected and asserts the root layout sets **no** `dir=`, which directly contradicts T2 §2 (root `<html dir>`); patch specified as SPEC-T2-H-3 (§6). Fixed 0. Suites failing to run: the same 3 as base — `lib/market/marketSyntheticHarness.spec.ts` and `lib/market/mktRetained.spec.ts` (pre-existing TS errors), and `components/ask/askDockGeography.spec.ts`, re-run in isolation (`--runInBand`): it crashes the worker with `TypeError: Cannot read properties of undefined (reading 'status')` at `lib/api/askV2Api.ts:39` (H+R4 code, un-mocked fetch) — not OOM, identical at base.
* Every other pre-existing frontend failure (22) is unchanged and unrelated (byte-identity guards on Politics/Market files, admin provenance, map wiring, etc.).

## 9. Changed-file manifest

105 files (vs `266007c`). Line endings: every file whose base blob carries CRLF (`components/home/Hero.tsx`, `Hero.spec.ts`, `homepageLocalization.spec.ts`) is staged unfiltered with CRLF kept, so `git diff --stat` shows only the real lines (Hero.tsx: 7+/6−). No file modes changed.

**frontend** (71)

- `frontend/src/app/account/layout.tsx`
- `frontend/src/app/admin/layout.tsx`
- `frontend/src/app/ask/page.tsx`
- `frontend/src/app/ask/recent/page.tsx`
- `frontend/src/app/conflict/page.tsx`
- `frontend/src/app/cookies/page.tsx`
- `frontend/src/app/delivery-visual-preview/compact/page.tsx`
- `frontend/src/app/delivery-visual-preview/page.tsx`
- `frontend/src/app/economy-visual-preview/compact/page.tsx`
- `frontend/src/app/economy-visual-preview/page.tsx`
- `frontend/src/app/election-visual-preview/compact/page.tsx`
- `frontend/src/app/election-visual-preview/page.tsx`
- `frontend/src/app/energy/page.tsx`
- `frontend/src/app/error.tsx`
- `frontend/src/app/global-error.tsx`
- `frontend/src/app/history/layout.tsx`
- `frontend/src/app/history/page.tsx`
- `frontend/src/app/imihigo/page.tsx`
- `frontend/src/app/layout.tsx`
- `frontend/src/app/map/page.tsx`
- `frontend/src/app/market/compact/page.tsx`
- `frontend/src/app/market/page.tsx`
- `frontend/src/app/my-intelligence/layout.tsx`
- `frontend/src/app/my-intelligence/page.tsx`
- `frontend/src/app/not-found.tsx`
- `frontend/src/app/politics-visual-preview/compact/page.tsx`
- `frontend/src/app/politics-visual-preview/page.tsx`
- `frontend/src/app/privacy/page.tsx`
- `frontend/src/app/saved/briefing/page.tsx`
- `frontend/src/app/saved/page.tsx`
- `frontend/src/app/search/page.tsx`
- `frontend/src/app/security-visual-preview/compact/page.tsx`
- `frontend/src/app/security-visual-preview/page.tsx`
- `frontend/src/app/source-policy/page.tsx`
- `frontend/src/app/support/page.tsx`
- `frontend/src/app/terms/page.tsx`
- `frontend/src/app/third-party-notices/page.tsx`
- `frontend/src/app/workspace/page.tsx`
- `frontend/src/components/admin/screens/SettingsScreen.tsx`
- `frontend/src/components/history/HistoryClient.tsx`
- `frontend/src/components/home/Hero.tsx`
- `frontend/src/components/home/HomeLanguageControl.tsx`
- `frontend/src/components/i18n/DisplayLocaleNotice.tsx`
- `frontend/src/components/i18n/LanguageSync.tsx`
- `frontend/src/components/map/MapPageClient.tsx`
- `frontend/src/components/map/shell/MapLanguageControl.tsx`
- `frontend/src/components/my-intelligence/workspace/WorkspaceNav.tsx`
- `frontend/src/components/navigation/NavBar.tsx`
- `frontend/src/lib/economy/economyInlineInventory.ts`
- `frontend/src/lib/history/historyStrings.ts`
- `frontend/src/lib/i18n/catalogueLocales.ts`
- `frontend/src/lib/i18n/declaredKeyStates.ts`
- `frontend/src/lib/i18n/dictionaries/adminEn.ts`
- `frontend/src/lib/i18n/dictionaries/adminPl.ts`
- `frontend/src/lib/i18n/dictionaries/index.ts`
- `frontend/src/lib/i18n/dictionaries/supportEn.ts`
- `frontend/src/lib/i18n/dictionaries/supportPl.ts`
- `frontend/src/lib/i18n/displayLocale.server.ts`
- `frontend/src/lib/i18n/displayLocale.ts`
- `frontend/src/lib/i18n/documentLocale.server.ts`
- `frontend/src/lib/i18n/failureCopy.ts`
- `frontend/src/lib/i18n/fallbackNotice.ts`
- `frontend/src/lib/i18n/languages.ts`
- `frontend/src/lib/i18n/qualifiedDictionaryOverlays.ts`
- `frontend/src/lib/i18n/surfaceLocale.ts`
- `frontend/src/lib/i18n/surfaceRenderable.generated.ts`
- `frontend/src/lib/i18n/surfaceRoutes.ts`
- `frontend/src/lib/i18n/useRequestedDisplayLocale.ts`
- `frontend/src/middleware.ts`
- `frontend/src/qualification/i18n/catalogueCoverage.ts`
- `frontend/src/qualification/i18n/surfaceCoverage.ts`

**frontend (tests)** (22)

- `frontend/src/app/failureSurfaces.spec.ts`
- `frontend/src/app/legalPages.spec.ts`
- `frontend/src/app/pwaContract.spec.ts`
- `frontend/src/components/admin/adminShellBoundary.spec.ts`
- `frontend/src/components/home/Hero.spec.ts`
- `frontend/src/components/home/homepageLocalization.spec.ts`
- `frontend/src/components/home/m65LanguageIntegrity.spec.ts`
- `frontend/src/components/layout/footerGeometry.spec.ts`
- `frontend/src/components/map/checkpointFGlobalUx.spec.ts`
- `frontend/src/components/map/checkpointILanguageAuth.spec.ts`
- `frontend/src/components/navigation/nativeControlScheme.spec.ts`
- `frontend/src/components/search/languageSelector.spec.ts`
- `frontend/src/components/search/searchWorkspace.spec.ts`
- `frontend/src/components/support/supportAiSurface.spec.ts`
- `frontend/src/lib/i18n/catalogueLocales.spec.ts`
- `frontend/src/lib/i18n/dictionaries/adminLocalization.spec.ts`
- `frontend/src/lib/i18n/displayLocale.spec.ts`
- `frontend/src/lib/i18n/displayLocaleAuthority.spec.ts`
- `frontend/src/lib/i18n/surfaceLocale.spec.ts`
- `frontend/src/lib/politics/politicsVisualFrame.spec.ts`
- `frontend/src/lib/specialist/alphaVisualFrames.spec.ts`
- `frontend/src/qualification/i18n/catalogueCoverage.spec.ts`

**backend** (3)

- `backend/src/modules/analysis/dto/analyze-news.dto.ts`
- `backend/src/modules/telemetry/dto/displayLocaleDtos.t2.spec.ts`
- `backend/src/modules/telemetry/dto/record-event.dto.ts`

**scripts** (1)

- `scripts/i18n/t2-reconcile-catalogues.cjs`

**docs** (8)

- `docs/convergence/stage2/T2-GLOBAL-LANGUAGE-FOUNDATION.md`
- `docs/convergence/stage2/t2/reconciled/ar.json`
- `docs/convergence/stage2/t2/reconciled/de.json`
- `docs/convergence/stage2/t2/reconciled/es.json`
- `docs/convergence/stage2/t2/reconciled/fr.json`
- `docs/convergence/stage2/t2/reconciled/pt.json`
- `docs/convergence/stage2/t2/reconciliation-summary.json`
- `docs/convergence/stage2/t2/translation-manifest.json`


## 10. Known limitations

* fr/de/es/pt/ar render FULL only on Ask surfaces; everything else is a declared English fallback until Claude L qualifies the manifest. Five Polish surfaces (Market, Humanitarian, Economy, Security, History) moved from silent mixed-language to declared English fallback.
* Protected routes (`/` platform Home, `/humanitarian`, `/account/settings`) still read the cookie themselves — see §6; Humanitarian-PL and Account-Settings-fr–ar have a page/document mismatch until the specs land.
* `x-gna-pathname` is set only on requests the middleware matches (all page routes); a request without it resolves to the `default` surface.
* The en/pl fallback-notice strings and the Support out-of-scope copy are T2-authored and pending Claude L qualification; the fr–ar notice strings are L-approved recovered strings pending re-confirmation.
* Economy's frame keeps `dir="ltr"` (pinned by `econContract.spec.ts` for LTR isolation of machine-readable values); when Economy becomes renderable in `ar`, the frame must take `directionFor(locale)` with per-value LTR isolation.
* `WorkspaceNav` (My Intelligence) still offers only EN/PL buttons (its surface is en/pl-only today); it now reflects the requested locale.
* `AnalyzeNewsDto.displayLocale` is accepted but not yet read by any consumer.
