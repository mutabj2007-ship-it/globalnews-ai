# 09 — Alpha Acceptance Matrix

> **Stage 2 runtime correction (2026-10-04, CTO contract R2).** Railway runtime authority replaces the Git-derived Production assumption below:
> - **Alpha:** backend and frontend at `5513275f` (SUCCESS); live root is platform Home (`GNA_PUBLIC_ROOT` configured); Ask V2 active for signed-in users; guest trial **OFF by design** during controlled acceptance (not a defect).
> - **Production:** backend `5b714833`, frontend `58f80fd4` (SUCCESS). Strict ancestors of Alpha, 85 and 84 commits behind. Not `release/production-c908`.
> - **Production flags are not inferred; Production stays HOLD.**
>
> Registries (02, 09, 10, `status.json`) are regenerated with these facts. See `stage2/STAGE2-REPORT.md`.

Authority `5513275f`. Generated from `02-GLOBAL-CAPABILITY-REGISTRY.json` by `tools/render.py`. Every cell is a measured value with evidence in the registry. Nothing reads "mostly works".

## Cell vocabulary

- **PASS / PARTIAL / FAIL / ABSENT** — measured in code at the authority SHA.
- **N/A** — the column does not apply to the capability.
- **UNVERIFIED** — the code path exists, but it depends on a deployment value (e.g. `ASK_V2_ENABLED`, `GNA_PUBLIC_ROOT`, `DISCUSSION_*`) that cannot be observed from the measuring container. **Never counted as green.**
- **Locale columns** map the language measurement: FULL → PASS, PARTIAL → PARTIAL, English fallback → FAIL.

## Row status rule (mechanical)

- **GREEN** — every applicable cell is PASS.
- **AMBER** — only PASS, PARTIAL or UNVERIFIED cells remain.
- **RED** — anything else.

The **finish line** (contract Definition of Done #9) is every row GREEN, except for explicitly approved Production-only blockers. Progress is tracked in `status.json`.

## Seven-locale whole-product journey (Part XII) — Stage 0 measurement

The journey is: Home → refresh → Ask → conceptual question → current question → follow-up → Map → one module → account/settings → Home.

| Step | EN | PL | FR | DE | ES | PT | AR |
|---|---|---|---|---|---|---|---|
| 1 Select locale on Home | PASS | PASS | FAIL¹ | FAIL¹ | FAIL¹ | FAIL¹ | FAIL¹ |
| 2 Refresh keeps locale (shell) | PASS | PASS | FAIL¹ | FAIL¹ | FAIL¹ | FAIL¹ | FAIL¹ |
| 3 Navigate to Ask (chrome) | PASS | PASS | PARTIAL² | PARTIAL² | PARTIAL² | PARTIAL² | PARTIAL² |
| 4–6 Conceptual / current / follow-up answer language | UNVERIFIED³ | UNVERIFIED³ | UNVERIFIED³ | UNVERIFIED³⁴ | UNVERIFIED³ | UNVERIFIED³⁴ | UNVERIFIED³ |
| 7 Open Map | PASS | PASS | FAIL¹ | FAIL¹ | FAIL¹ | FAIL¹ | FAIL¹ |
| 8 Open one module (Conflict) | PASS | PASS | FAIL¹ | FAIL¹ | FAIL¹ | FAIL¹ | FAIL¹ |
| 9 Account / settings | PARTIAL⁵ | PARTIAL⁵ | FAIL | FAIL | FAIL | FAIL | FAIL |
| 10 Return Home, locale intact | PASS | PASS | FAIL¹ | FAIL¹ | FAIL¹ | FAIL¹ | FAIL¹ |
| correct `lang` / `dir` | PASS | PASS | FAIL | FAIL | FAIL | FAIL | FAIL (no RTL) |

Notes:

1. `isActiveLanguageCode` clamps the locale to en/pl (`languages.ts:21,159`). The page renders English and `<html lang="en">`. A Polish browser overwrites the stored choice to `pl` (`LanguageSync.tsx:52-58`).
2. `askSevenStrings` (24 keys) is complete, but `askR2Strings` (184 keys) is en/pl only. FR–AR example questions are unqualified drafts.
3. Ask V2 is active on Alpha for signed-in users (CTO Railway authority). Answer language per locale has not yet been run end-to-end on Alpha from this container. The deterministic routers handle EN/PL only. H final `266007c` completes the Ask shell in all seven locales; it is not yet deployed.
4. de/pt retrieve with the English strategy. The legacy analysis DTO rejects de/pt.
5. Platform-mode settings hard-code `language="en"` (`account/settings/page.tsx:27`). Standalone settings are en/pl.

<!-- GENERATED:BEGIN -->
| Capability | Surface | Data | Search | Ask | Citation | Continuity | Briefing | Follow | Alert | EN | PL | FR | DE | ES | PT | AR | Mobile | Desktop | Rights | Security | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ASK-CORE | /; /ask | PASS | PASS | PASS | PASS | PARTIAL | PARTIAL | N/A | N/A | PASS | PASS | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PASS | PASS | FAIL | PASS | RED |
| ASK-SEARCH | /search | PASS | PASS | PASS | PASS | PARTIAL | PARTIAL | N/A | N/A | PASS | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | PARTIAL | PASS | FAIL | PASS | RED |
| ASK-LEGACY | (no live frontend caller at 5513275f) | PASS | PASS | FAIL | PASS | PARTIAL | ABSENT | N/A | N/A | PASS | PASS | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | N/A | N/A | FAIL | PASS | RED |
| CONVERSATION | /ask; dock | PASS | PASS | PARTIAL | FAIL | PARTIAL | N/A | N/A | N/A | PASS | PASS | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PASS | PASS | N/A | PASS | RED |
| LANG-SYSTEM | all routes | N/A | N/A | PARTIAL | N/A | N/A | N/A | N/A | N/A | PASS | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | FAIL | FAIL | N/A | N/A | RED |
| HOME | / (platform mode, GNA_PUBLIC_ROOT=platform) | PASS | PASS | PASS | N/A | N/A | ABSENT | PARTIAL | UNVERIFIED | PASS | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | PASS | PASS | FAIL | PASS | RED |
| MAP-COUNTRY | /map | PASS | PASS | PASS | PARTIAL | N/A | ABSENT | PARTIAL | ABSENT | PASS | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | PARTIAL | PASS | FAIL | PASS | RED |
| CONFLICT | /conflict; /map overlay | PASS | PASS | FAIL | PASS | PARTIAL | FAIL | ABSENT | ABSENT | PASS | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | UNVERIFIED | PASS | PASS | PARTIAL | RED |
| SECURITY | /security-visual-preview (preview) | ABSENT | ABSENT | ABSENT | ABSENT | N/A | ABSENT | ABSENT | ABSENT | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | FAIL | UNVERIFIED | UNVERIFIED | UNVERIFIED | PASS | RED |
| POLITICS | /politics-visual-preview (preview) | ABSENT | ABSENT | ABSENT | ABSENT | N/A | ABSENT | ABSENT | ABSENT | PASS | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | UNVERIFIED | UNVERIFIED | UNVERIFIED | PASS | RED |
| ECONOMY | /economy-visual-preview (preview) | PARTIAL | PARTIAL | PARTIAL | PASS | PARTIAL | FAIL | ABSENT | ABSENT | PASS | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | UNVERIFIED | UNVERIFIED | FAIL | PASS | RED |
| MARKET | /market; /market/compact (orphan) | PASS | PARTIAL | PARTIAL | PASS | PARTIAL | FAIL | ABSENT | ABSENT | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | FAIL | UNVERIFIED | PASS | PASS | PARTIAL | RED |
| ENERGY | /energy | PARTIAL | ABSENT | FAIL | ABSENT | N/A | ABSENT | ABSENT | ABSENT | PASS | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | UNVERIFIED | PASS | PASS | PARTIAL | RED |
| ELECTION | /election-visual-preview (preview) | PARTIAL | ABSENT | ABSENT | ABSENT | N/A | ABSENT | ABSENT | ABSENT | PASS | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | UNVERIFIED | UNVERIFIED | FAIL | PASS | RED |
| HUMANITARIAN | /humanitarian; /humanitarian/compact (orphan) | ABSENT | ABSENT | PASS | ABSENT | N/A | ABSENT | ABSENT | ABSENT | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | FAIL | UNVERIFIED | PASS | FAIL | PASS | RED |
| IMIHIGO | /imihigo; /imihigo/compact (orphan) | PASS | PASS | PASS | PASS | PARTIAL | FAIL | ABSENT | ABSENT | PASS | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | UNVERIFIED | PASS | FAIL | PASS | RED |
| SIGNALS | — | ABSENT | ABSENT | ABSENT | ABSENT | N/A | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | N/A | N/A | FAIL | PASS | RED |
| MY-INTELLIGENCE | /my-intelligence | PASS | PARTIAL | PASS | PASS | PARTIAL | PARTIAL | PARTIAL | ABSENT | PASS | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | PASS | PASS | N/A | PARTIAL | RED |
| SAVED | /saved | PASS | N/A | PASS | PASS | PASS | PARTIAL | N/A | N/A | PASS | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | PASS | PASS | N/A | PASS | RED |
| HISTORY-RECENT | /ask/recent; /history (legacy) | PARTIAL | N/A | N/A | N/A | PASS | N/A | N/A | N/A | PASS | PARTIAL | FAIL | FAIL | FAIL | FAIL | FAIL | PASS | PASS | N/A | PASS | RED |
| BRIEFINGS | /saved/briefing | PARTIAL | N/A | N/A | FAIL | PARTIAL | FAIL | N/A | N/A | PASS | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | UNVERIFIED | UNVERIFIED | N/A | PASS | RED |
| FOLLOW | platform Home; /my-intelligence | PARTIAL | N/A | N/A | N/A | N/A | ABSENT | PARTIAL | ABSENT | PASS | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | UNVERIFIED | UNVERIFIED | N/A | PASS | RED |
| ALERTS-WATCH | Home R1 alerts centre (flag) | PARTIAL | N/A | N/A | N/A | N/A | N/A | N/A | PARTIAL | PASS | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | ABSENT | UNVERIFIED | N/A | UNVERIFIED | RED |
| DISCUSSIONS | Home R1 DiscussionPanel (flag) | PARTIAL | N/A | N/A | N/A | N/A | N/A | N/A | N/A | PASS | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | UNVERIFIED | UNVERIFIED | N/A | UNVERIFIED | RED |
| ACCOUNT-AUTH | /account/settings | PASS | N/A | N/A | N/A | N/A | N/A | N/A | N/A | PASS | PARTIAL | FAIL | FAIL | FAIL | FAIL | FAIL | PASS | PASS | N/A | PASS | RED |
| SUPPORT | /support | PASS | N/A | N/A | N/A | N/A | N/A | N/A | N/A | PASS | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | PASS | PASS | N/A | PASS | RED |
| LEGAL | /privacy; /cookies | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | PASS | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | PASS | PASS | N/A | PASS | RED |
| CONSENT | — | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | N/A | FAIL | RED |
| THEME | all routes | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | PARTIAL | PARTIAL | N/A | N/A | AMBER |
| PREVIEW-ROUTES | /{delivery,economy,election,politics,security}-visual-preview (+compact); /workspace | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | PASS | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | N/A | N/A | N/A | FAIL | RED |
| NEWS-SOURCES | all evidence answers | PARTIAL | PASS | PASS | PASS | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | FAIL | PARTIAL | RED |
| TELEMETRY-ADMIN | /admin/** (22 pages) | PARTIAL | N/A | N/A | N/A | N/A | N/A | N/A | N/A | PASS | PASS | FAIL | FAIL | FAIL | FAIL | FAIL | N/A | PASS | N/A | PASS | RED |
| PAID | — | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | ABSENT | N/A | N/A | N/A | N/A | RED |

**Roll-up:** 33 capabilities — GREEN 0 · AMBER 1 · RED 32.  
**Cells:** PASS 144 · PARTIAL 63 · UNVERIFIED 25 · FAIL 153 · ABSENT 77 · N/A 165.
<!-- GENERATED:END -->
