# H8 — FULL HOME QUALITY GATE

Issue #29, `BETA-HOME-FULL-CONVERGENCE-R1.md` §4 H8 and §5.
Branch `feature/beta-home-full-convergence-r1`. Base `c3dd01a`. Date 2026-09-25.

---

## 1. Tests and build

| Command | Result |
|---|---|
| `npx jest` (frontend) | **10 suites / 15 tests fail · 284 suites / 6526 tests pass · 13 skipped** |
| `npm run test:shared` | **13 suites / 523 tests pass** |
| `npm run build:shared` | **exit 0** |
| `npm run build:frontend` | **exit 0, compiled successfully** |

### Baseline comparison — zero new failures

The ten failing suites are the **identical set already failing on base `c3dd01a`**:
`adminOperationalSurface`, `adminSupportSurface`, `c911RequestEconomy`, `m51PhaseB`,
`adminProvenance`, `evidence/visualAuthority`, `mapShellRouteWiring`,
`marketSyntheticHarness`, `mktRetained`, `market/visualAuthorityCorrection`.

| | Suites failed | Tests failed | Tests passed |
|---|---|---|---|
| Base `c3dd01a` | 10 | 15 | 6526 |
| Final `4bdd1af` | **10** | **15** | **6526** |

Shared was not touched by this assignment; it is run and recorded to prove that.

---

## 2. Quota — ordinary Home browsing starts no metered AI

**0 metered AI or provider requests across all 14 final captures** (seven widths × two
locales), measured by recording every request the page issues and matching
`/analysis`, `/ask-v2`, `/ai`, `openai`, `anthropic`.

Verified in source as well, on comment-stripped code across the whole live Home path
(`page.tsx`, `BetaHero`, `SixtySecondBrief`, `WhatsHappeningNow`, `HomeSideRail`,
`IntelligenceModulesSection`):

| Check | Result |
|---|---|
| `getHomeFeed(` executable calls | **1** |
| Direct `fetch(` in `page.tsx` | **0** |
| `analyzeNews` anywhere on the Home path | **0** |

The Ask entry is a native GET form to `/ask`, and the suggestion prompts are links to
`/ask?q=`. Both stage a draft; `AskFrameScreen` runs only on Send. **The Home page now
contains no control that can start a metered analysis** — which is a strict improvement on
the base, where the hero submitted to `/search?q=` and spent one analysis immediately.

---

## 3. Truth — no prototype, fixture or sample content on the live path

Comment-stripped scan of every live Home component for
`fixture`, `SAMPLE_`, `DEMO_`, `mockData`, `ILLUSTRATIVE`, `Illustration`,
`not a news photograph`:

```
page.tsx 0 · BetaHero 0 · SixtySecondBrief 0 · WhatsHappeningNow 0
HomeSideRail 0 · IntelligenceModulesSection 0
```

Deliberately not reproduced from the review frames: the
"ILLUSTRATIVE SAMPLE · NOT LIVE COVERAGE" ribbon, the per-image "Illustration" badge, the
"licensed publisher image required in production" credit, the sample headlines, the sample
map incident marks, and the frames' sample Ask prompts. Suggested questions use the
existing governed `hero.exampleQuestions` catalogue instead.

Where data is missing the Home states it: the brief and the editorial area each render
their approved "Couldn't load the latest updates." message, and the governed
`DataModeLabel` reports live / cached / unknown. The captures were taken **without a
backend**, so every frame shows those truthful gaps rather than invented content — which
is the §6 behaviour, demonstrated rather than asserted.

---

## 4. Routes and destinations

| Check | Result |
|---|---|
| `/search` referenced in live Home **code** | **0** in all five components (only doc comments explain the history) |
| Home Ask targets | `/ask` and `/ask?q=…` only |
| Four navigation destinations | `/`, `/map`, `/ask`, `#intelligence-modules` — unchanged |
| `#intelligence-modules` anchor | present in all 14 frames |
| Module card destinations | unchanged from the registry; all nine verified by route line in every frame |
| Watch | `WATCH_RUNTIME_ACTIVE = false`, untouched; no Watch control on Home |
| Follow vs Watch | distinct; no Watch surface was added, and Follow remains the FollowsModule capability |

`/ask` is the draft/conversational entry, `/search` the explicit analysis workspace. They
are not merged, and Home no longer links to `/search` at all.

---

## 5. Console and network

One failing response per frame, named and classified:

| Count | Status | Path | Owner | Classification |
|---|---|---|---|---|
| 14× | 500 | `/api/users/me` | `components/navigation/AccountControl.tsx` via `useAccount.ts` | environmental |

No backend runs in the evidence environment (`127.0.0.1:3001/health` unreachable, no
`DATABASE_URL`) — the same condition `BETA-PREFLIGHT-AUDIT-R1.md` §G-3 records. It
reproduces with `curl`, outside any browser.

**It improved during this work.** The base carried two such failures per frame; retiring
`TodayWorkspace` removed the only consumer of `/api/follows/countries`, so that one is
gone. The remaining call belongs to the header account control, which this assignment did
not touch.

Per H8, account and follow behaviour is to be verified "against a real backend environment
where possible". Alpha is that environment, and the two held zones — "For you" and
Following chips — are scheduled behind the Product Owner's Alpha review for the same
reason.

---

## 6. Responsive — one composition, seven widths, two locales

14 captures. Every one: HTTP 200, **no horizontal overflow**, correct `<html lang>`,
anchor present, all nine module titles visible as rendered text.

`1920×1080 · 1440×900 · 1024×768 · 768×1024 · 430×932 · 390×844 · 360×800`, each in EN
and PL.

One defect found and fixed at this gate: World Pulse rendered its map unbounded, which is
a 340px rail on desktop but the full content width once the layout collapses — roughly
768px tall at tablet portrait. Capped to a 320px thumbnail and re-verified at every width.

`main` keeps `pb-16 lg:pb-0`, so the fixed bottom bar cannot cover content. (In full-page
screenshots a `position: fixed` bar is composited once at its viewport offset, which is why
it appears mid-page in the tall captures; it is bottom-fixed in the real viewport.)

---

## 7. EN / PL

Both locales render the entire Home: hero headline and subheadline, Ask placeholder,
button and metered note, both CTA titles and subtitles, the 60-second brief, the
"What's happening now" heading, its no-AI note and degraded message, the data-status
label, the sign-in card, World Pulse and its note, suggested questions and the
"nothing runs until Send" note, all nine module titles, states and route notes, and the
footer. No English application chrome leaks into the Polish frames, and no provider
content was translated.

**PL provenance:** every new Polish string is quoted verbatim from the R4.1 package's
`i18n_en_pl.json`. That catalogue marks its PL **"DRAFT FOR REVIEW"** except nine keys it
marks APPROVED — and those nine are approved because they were copied *from* this
repository. Shipping the design lane's own draft is the only option that neither invents a
translation (§6) nor regresses EN/PL parity (§2). **Flagged FOR REVIEW.**

---

## 8. Scope discipline

`git diff c3dd01a..HEAD` over specialist source — `components/{conflict,economy,energy,
market,security,humanitarian,politics,map,ask-frame}` and
`app/{conflict,energy,market,map,ask,search}` — returns **0 files**. No specialist
dashboard was redesigned.

16 source files changed in total: 4 new Home components, `page.tsx`, the two dictionaries,
and 9 spec files whose pins were re-pointed.

**H4 preserved.** `IntelligenceModulesSection.tsx` is byte-unchanged from `c3dd01a`, and
`intelligenceModulesR51.spec.ts` passes throughout. All nine module titles, their approved
category colours, states and routes are verified present in every one of the 14 frames.

---

## 9. Retired from Home, none deleted

`Hero`, `GlobalDevelopments`, `LiveStatusStrip`, `HeroFocusProvider`, `TodayWorkspace`,
`HowItWorks`, `TrustSection` — all seven remain on disk, unimported by any route,
following the convention this repository already applies to `TodaySection`,
`LatestNowRail`, `HomepageSituationMap`, `IntelligenceModulesDesktop/Mobile` and
`IntelligenceEngineSection`. Their own specs read those files and keep passing.

No visual test was deleted. Nine spec files had pins re-pointed to protect the approved
R4.1/R5.1 result instead of the superseded M66 composition, per
`BETA-DESIGN-AUTHORITY-R5.1.md` §3.

---

## 10. OPEN items — none closed

N1 (desktop destination count) · N2 · N4 · N5 · N6 (`/story/:id`) · **N7 (category chips —
the drawn labels are domain categories the governed vocabulary does not contain, so
rendering them would invent the taxonomy N7 reserves)** · N9 · N11 · S1 · S2 · F1 ·
M2 · M3 · P1 · CC1–CC4 · Ask D6 · Spatial D1 · D2 · D17 · D18 · R4.1 C3, C4, C6, C7, C8,
C11, C13 · plans/billing.

Two Home zones held for the same kind of reason: **Z16 "For you"** and **Z19 Following
chips** need account state this environment cannot exercise.

---

## 11. Known defects still visible

1. With an empty feed the editorial column is shorter than the side rail, leaving vertical
   space beside the modules. With real Alpha data the column fills; to be confirmed at the
   Product Owner review.
2. `/api/users/me` returns 500 in the local evidence environment (§5). Expected to resolve
   on Alpha, where a backend runs.
3. PL copy for the new Home zones is the design lane's **draft** (§7).
4. The approved desktop header draws four destinations; the branch ships two routable plus
   seven non-routing labels. Held under N1 (§10).

No Production. No `globalnewsai.live`. No provider activation. No specialist module.
