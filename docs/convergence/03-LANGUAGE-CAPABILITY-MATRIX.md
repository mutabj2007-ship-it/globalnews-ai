# 03 — Language Capability Matrix

Authority `5513275f`. Raw measurement: `stage0/language.json`. Key coverage was computed by loading every catalogue and comparing its leaves against English.

## Verdict

**Seven-locale integration is not met.** Contract Part I §3 requires the whole reachable UI to change coherently with one locale switch. Today:

- Only **en** and **pl** do that.
- **fr / de / es / pt / ar** are *selectable*, but outside the Ask answer frame they render **English**, with `<html lang="en">` and no `dir`. After a refresh the selector itself shows English again.
- This is an **undeclared** English fallback, which the language acceptance rule (Part I §5) forbids.

## The single root cause (P0-LANG-01)

| What | Where |
|---|---|
| Selector offers all seven locales | `SELECTABLE_LOCALES = DISPLAY_LOCALES` — `frontend/src/lib/i18n/languages.ts:91` |
| Every non-Ask route, plus the root layout, accepts only en/pl | `ACTIVE_LANGUAGES = ['en','pl']`, `isActiveLanguageCode` — `languages.ts:21,159`; 36 route files; `app/layout.tsx:193,259,273` |
| Stored fr–ar choice overwritten with `pl` on Polish browsers | `LanguageSync.tsx:52-58`, `Hero.tsx:264-269` (P0-LANG-02) |
| No `<html dir>`; RTL scoped to the Ask frame only | `AskFrameScreen.tsx:431-432`; Economy forces `dir="ltr"` (`EconomyScreen.tsx:222`) (P0-LANG-03) |

## Locale systems (Stage 2 must converge these)

| System | Count |
|---|---|
| Module-level catalogues | 23 (including the dormant recovered C55 set) |
| Files with private per-locale tables | 12 |
| Files branching on `=== 'pl'` | 41 |
| Backend copy tables | 2 |
| Catalogues holding all seven locales | **3** — `askSevenStrings` (24 keys), `askQuestionExamples` (42; FR–AR `DRAFT_PENDING_CLAUDE_L`), `economyStrings` (83 + 29) |

## Key coverage

"Identical" counts values that are the same as English, excluding symbols and numbers.

| Catalogue | EN keys | PL | FR | DE | ES | PT | AR |
|---|---|---|---|---|---|---|---|
| Main dictionary (`getDictionary`) | 2813 | 2813 (59 identical) | — | — | — | — | — |
| Recovered C55 (dormant, not imported) | 2813 | n/a | 1655 (95 id.) | 1655 (52) | 1655 (38) | 1655 (37) | 1655 (30) |
| askR2Strings | 184 | 184 | — | — | — | — | — |
| askSevenStrings | 24 | 24 | 24 | 24 | 24 | 24 | 24 |
| economyStrings | 83 | 83 | 83 | 83 | 83 | 83 | 83 |
| energyStrings | 161 | 160 (1 empty) | — | — | — | — | — |
| humStrings / mktStrings / secStrings | 120 / 102 / 39 | — | — | — | — | — | — |
| askStrings 57 · askNav 14 · askContinuity 36 · briefing 38 · conflict 63 · delivery 27 · election 44 · politics 87 · failureCopy 15 · cookiesPage 22 | — | full | — | — | — | — | — |

Notes:

- "—" means no catalogue: the surface falls back to English.
- The recovered C55 set has **0** keys for My Intelligence (260), Home R1 (231), Home Reva (90), Ask AI (41), Beta Home (73), Event Anchor (32) and Account Settings (13).
- H's checkpoint (`checkpoint/r4-h-answer-reading-ea724fa-pre-l`) still declares 469 keys per locale as English, pending Claude L.

## Surface × locale grid

**F** full · **P** partial · **E** English fallback (undeclared) · **A** absent

| Surface | en | pl | fr | de | es | pt | ar |
|---|---|---|---|---|---|---|---|
| Root `/` in Standalone (Ask) | F | F | P | P | P | P | P |
| Ask standalone `/ask`, Ask answer view, empty/loading/error, language selector | F | F | P | P | P | P | P |
| Platform Home, Search, Map, Conflict, Energy, My Intelligence, Saved, Briefings, Support, Privacy, Cookies, Terms, Alerts, Discussions, Mobile menu, Theme menu | F | F | E | E | E | E | E |
| Politics / Economy / Election (preview routes only) | F | F | E | E | E | E | E |
| Market, Humanitarian | F | E (disclosed) | E | E | E | E | E |
| History/Recent, Account, Settings | F | P | E | E | E | E | E |
| Consent / cookie notice | A | A | A | A | A | A | A |

## Backend language path

| Layer | en | pl | fr | de | es | pt | ar | sw / rw (source only) |
|---|---|---|---|---|---|---|---|---|
| `LanguageCode` type (`shared/src/analysis.ts:30`) | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✓ | ✓ (conflated with display) |
| Analysis DTO / telemetry DTO accept | ✓ | ✓ | ✓ | **reject** | ✓ | **reject** | ✓ | ✓ |
| Top headlines (Home feed) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Ask V2 accepts (`ask-compute.contract.ts:21`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Retrieval strategy (`resolveSearchEndpointLanguage`) | native | headlines → en | native | **none** → en | native | **none** → en | native | en search |
| Deterministic routers / conversation readers | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | — |
| Response-language instruction (prompt) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Backend error copy | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | — |

Preference persistence: localStorage plus a one-year cookie, then `router.refresh()`. **Not saved to the account. No Accept-Language handling.**

## Stale "English and Polish only" disclosures

| File | Text | Reach |
|---|---|---|
| `supportEn.ts:304`, `supportPl.ts:216` | "Automatic answers are available in English and Polish only" | **live** (P1-LANG-06) |
| `askR2Strings.ts:473,766` | "Ask answers in English and Polish" | dormant code path |
| `adminEn.ts:839`, `adminPl.ts:826` | `'English, Polski'` | admin settings |
| `homeClickContract.ts:241` | "Language (EN/PL)" | test data, visibility UNKNOWN |

## What converged looks like (Stage 2 target, not implemented)

1. **One locale authority.** A `DisplayLocale` cookie/account preference read by **one** server helper. Every route and the root layout use it. `isActiveLanguageCode` is retired for display, so the clamp disappears.
2. **Separate source-language type.** `LanguageCode` (retrieval) and `DisplayLocale` (UI) become separate types. sw/rw leave the UI tables. de/pt are added to the backend DTOs and retrieval strategy.
3. **Document attributes.** `<html lang>` follows `DisplayLocale`; `<html dir>` comes from `LANGUAGE_DIRECTION`. LTR isolation for URLs, sources and IDs is reused from the Ask components.
4. **Declared fallback only.** Any catalogue missing a locale renders a *declared* fallback (the existing `askSevenStrings` disclosure pattern), never a silent one. Catalogues are filled surface by surface, with the Claude L key manifest as authority.
5. **Tests.** A coverage test is added to CI (a generalised `coverage.cjs`) so a new key cannot ship without all seven locales or an explicit declared-fallback entry.
