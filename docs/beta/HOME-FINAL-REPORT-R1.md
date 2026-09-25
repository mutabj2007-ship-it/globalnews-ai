# BETA HOME FULL CONVERGENCE R1 — FINAL REPORT

Issue #29. Contract `docs/beta/BETA-HOME-FULL-CONVERGENCE-R1.md` §13.
Date 2026-09-25.

---

## 1–3. Commits and integration

| # | What | SHA |
|---|---|---|
| 1 | **Final Home commit** | `1f735ce4b2e7…` (`1f735ce`) |
| 2 | **Integrated Beta** — `integration/beta-launch-convergence-r1` | `1f735ce` |
| 3 | **Alpha release** — `release/alpha-m08-integrated-r1` | `1f735ce` |

All three refs are identical. Both integrations were clean **fast-forwards** from
`c3dd01a`; neither target had diverged.

## 4. Railway deployment

| Field | Value |
|---|---|
| Project | `GlobalNewsAI-Alpha` · `38134692-b6d7-46a2-9651-1b93dad41dd6` |
| Environment | **alpha** · `70105bf5-b195-41af-b237-8745c8e76506` (matches `ALPHA_ENVIRONMENT_ID` in source) |
| Service | **frontend** · `c32ed75f-52a7-4459-98d2-635136090584` (frontend only) |
| **Deployment ID** | **`39c4a7cc-6e3c-49e1-ab78-8a5f32eb0f23`** |
| **Status** | **SUCCESS** |
| URL | https://frontend-alpha-4560.up.railway.app |

Two earlier attempts are recorded for completeness: `dcd9c361` SUCCESS (the pre-fix build)
and `2803add1` FAILED (CLI upload timeout, no deploy). The live deployment is `39c4a7cc`.

## 5. H0–H8 commit list

| Increment | SHA | Subject |
|---|---|---|
| H0 | `a0d5e50` | full Home authority reconciliation |
| H1 | `2f4a2b7` | Home shell decisions, navigation HELD on evidence |
| H2 | `4794d47` | approved Beta hero and the 60-second brief |
| H3 | `db649dd` | approved current-developments area, three surfaces retired |
| H4 | — | preserved from `c3dd01a`, not recreated |
| H5 | `422ffe7` | Home side rail, three non-authority sections retired |
| H6/H7 | `4bdd1af` | responsive at seven widths, EN and PL |
| H8 | `59ebef4` | full Home quality gate |
| fix | `1f735ce` | two defects found on live Alpha |

## 6. Changed files by Home zone

**Hero + brief (Z6–Z10):** `components/home/BetaHero.tsx` *(new)*,
`components/home/SixtySecondBrief.tsx` *(new)*
**Editorial area (Z11, Z13–Z15):** `components/home/WhatsHappeningNow.tsx` *(new)*
**Side rail (Z17, Z18, Z20):** `components/home/HomeSideRail.tsx` *(new)*
**Composition:** `app/page.tsx`
**Copy:** `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/pl.ts`
**Gates re-pointed (9):** `homepage.architecture`, `masterRecomposition`,
`claudeDesignFoundation`, `todayWorkspace`, `TodaySection`, `heroFocusChain`,
`m65LanguageIntegrity`, `trustGeometry`, `howItWorksDesktop`
**Docs/evidence:** `docs/beta/HOME-H0-AUTHORITY-RECONCILIATION-R1.md`,
`HOME-H8-QUALITY-GATE-R1.md`, this report, `docs/beta/evidence/home-r1/**`

**Retired from Home, none deleted:** `Hero`, `GlobalDevelopments`, `LiveStatusStrip`,
`HeroFocusProvider`, `TodayWorkspace`, `HowItWorks`, `TrustSection`.

## 7. Design authority consulted

All four packages re-verified by SHA256, matched by hash not filename; 246 files
re-checked against their manifests, 0 mismatched, 0 missing.

R4.1 desktop/tablet `9da21053…94bc` · R4.1 phone `f843483c…ffe0` ·
R5.1 desktop/tablet `a90954d1…c2a9bb` · R5.1 phone `85ecda57…6362be`.

Read: R4.1 `README`, `SPEC`, `NAVIGATION`, `COMPONENTS_AND_TOKENS`,
`INTERACTIONS_AND_STATES`, `IMAGERY_SPEC`, `ROUTE_MODULE_MATRIX`,
`CONTRACT_CONFLICTS`, `QA_LOG`, `R4_CHANGE_LOG`, `i18n_en_pl.json`, `tokens/`, and the
Home frames at 1920/1440/1024/768/430/390/360. R5.1 `HOME_R4.1_DELTA`,
`INTELLIGENCE_MODULE_MATRIX`, `PROPOSED_DELTAS`, `CATEGORY_COLOUR_TOKENS`,
`AUTHORITY_DELTA_REGISTER`, `NAVIGATION`, `SPEC`, `COMPONENTS_AND_TOKENS`,
`MODULE_COVERAGE`, `R5_1_CHANGE_LOG`, `MANIFEST`, and the H1/H3/H4 Home frames.

## 8–9. Tests, build, baseline comparison

| Command | Result |
|---|---|
| `npx jest` (frontend) | 10 suites / 15 tests fail · **284 suites / 6526 tests pass** |
| `npm run test:shared` | 13 suites / **523 tests pass** |
| `npm run build:shared` | exit 0 |
| `npm run build:frontend` | exit 0 |

| | Suites failed | Tests failed | Tests passed |
|---|---|---|---|
| Base `c3dd01a` | 10 | 15 | 6526 |
| Final `1f735ce` | **10** | **15** | **6526** |

**Zero new failures.** The ten are the identical pre-existing set (two market specs, four
admin/provenance, two map, `evidence/visualAuthority`, `mapShellRouteWiring`).

## 10. Quota / network

**0 metered AI or provider requests** across all 14 live-Alpha captures, and 0 across the
14 local captures. Verified in source too: one `getHomeFeed()` call, no direct `fetch(`, no
`analyzeNews` anywhere on the Home path.

**Home now contains no control that can start a metered analysis.** The base did: the old
hero submitted to `/search?q=`, which auto-runs one analysis by the N3 ruling. The approved
hero posts a native GET form to `/ask`, where the value is staged as a draft and runs only
on Send.

Network on live Alpha: **14× `401 /api/users/me`** — the correct response for a signed-out
visitor, from the header account control. The local 500s were purely the missing backend;
Alpha confirms the endpoint behaves. Retiring `TodayWorkspace` also removed the only
`/api/follows/countries` consumer, so that call is gone entirely.

## 11. EN / PL

Both locales render the whole Home; `<html lang>` correct on all 14 Alpha frames, 0 locale
mismatches. Verified live: `co się zmienia`, `Twój świat w 60 sekund`,
`Co dzieje się teraz`, `Moduły analityczne`, `Puls świata`, `Sugerowane pytania`, and
correct Polish plurals (`1 źródło`).

**PL is the design lane's DRAFT.** `i18n_en_pl.json` marks its Polish "DRAFT FOR REVIEW"
except nine keys marked APPROVED — and those nine are approved because they were copied
*from* this repository. Using the draft is the only option that neither invents a
translation (§6) nor regresses EN/PL parity (§2). **FOR REVIEW.**

## 12. Responsive

14 live-Alpha captures at **1920×1080, 1440×900, 1024×768, 768×1024, 430×932, 390×844,
360×800**, each in EN and PL. Every frame: HTTP 200, **no horizontal overflow**, correct
`lang`, `#intelligence-modules` anchor present, **all nine module titles visible as text**.

One responsive defect was found and fixed at H6: World Pulse rendered its map unbounded and
reached ~768px tall at tablet portrait; capped to a 320px thumbnail.

## 13. Evidence paths

```
docs/beta/evidence/home-r1/alpha/   14 live-Alpha frames + ALPHA-report.json   <- final
docs/beta/evidence/home-r1/h6/      14 local frames, seven widths
docs/beta/evidence/home-r1/h5/      8 local frames
docs/beta/evidence/home-r1/h3/      8 local frames
docs/beta/evidence/home-r1/h2/      8 local frames
docs/beta/evidence/home-r1/capture-home.mjs   the harness, committed for reproducibility
```

## 14. Live Alpha smoke results

| Check | Result |
|---|---|
| `GET /` | **200** |
| Approved hero headline live | present |
| Approved zones live | 60-second brief, What's happening now, World Pulse, Suggested questions, Intelligence modules, sign-in card |
| Retired sections absent | "Why trust GlobalNews AI" 0 · "From question to clarity" 0 · "What did GlobalNews AI first observe" 0 |
| Real data | live GNews feed, real publishers, real images, `LIVE · POWERED BY GNEWS`, "Updated 12 hr ago" |
| Four destinations | `/`, `/map`, `/ask`, `#intelligence-modules` all present |
| `/ask` form action | `action="/ask"` present; 3 `/ask?q=` suggestion links |
| Metered AI on browse | **0** across 14 frames |
| PL | `<html lang="pl">`, Polish throughout |
| Defect fixes | false-failure message **0**, `"1 sources"` **0**, `"1 source"` correct, `1 źródło` correct |

## 15. OPEN items — none closed

N1 · N2 · N4 · N5 · N6 · **N7** · N9 · N11 · S1 · S2 · F1 · M2 · M3 · P1 · CC1–CC4 ·
Ask D6 · Spatial D1 · D2 · D17 · D18 · R4.1 C3, C4, C6, C7, C8, C11, C13 · plans/billing.

Two Home zones held: **Z16 "For you"** and **Z19 Following chips**, both signed-in surfaces.

## 16. Known defects still visible

1. **Page title still advertises the superseded headline.** `<title>`, `og:title` and
   `twitter:title` read "GlobalNews AI — Understand today's world in seconds." The rendered
   hero is correct; this is the `homeMetaTitle` key, which is **not** among the 139 approved
   Home copy keys and so was outside the H0 zone matrix. Not changed unilaterally: `/` is
   one of only five indexable routes, so its title is an SEO decision. **Needs a ruling.**
2. **Header search control routes to `/search`.** Home *content* links only to `/ask`; the
   two `/search` links are the header search icon, held under **N4 (OPEN)**. Not a quota
   issue — bare `/search` with no `q` runs 0 AI.
3. **Desktop header shows two routable destinations plus seven non-routing labels**, where
   the approved frame draws four. Held under **N1 (OPEN)** — the nine-item sequence is
   itself an accepted authority enforced by four spec suites.
4. **The 60-second brief is currently absent on Alpha.** `latestUpdates` is the response
   minus the stories already placed, and the present retrieval leaves it empty. This is the
   correct behaviour after the fix — it renders nothing rather than claiming a failure —
   but it means the Product Owner will not see that panel populated until the feed returns
   a wider result. Worth a look at review time.
5. **PL copy for new zones is the design lane's draft** (§11).
6. **Category chips are absent** — N7, taxonomy (§15).

## 17.

`READY FOR PRODUCT OWNER FULL HOME VISUAL REVIEW — ALPHA`

No Production deployment. No `globalnewsai.live` binding. No provider activation. No
public-indexing change. No specialist module started.
