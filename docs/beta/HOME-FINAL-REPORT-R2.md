# BETA HOME CLOSURE R2 — FINAL REPORT

Branch `feature/beta-home-closure-r2`. Base `91a3b3105b6012e7cec3f429ac5ae90b67132ce2`.
Date 2026-09-25.

---

## 1. Refs

| Ref | SHA |
|---|---|
| `feature/beta-home-closure-r2` | `b534cff` |
| `integration/beta-launch-convergence-r1` | `b534cff` |
| `release/alpha-m08-integrated-r1` | `b534cff` |

All three identical. Both integrations were clean **fast-forwards** — each target sat
exactly at the base `91a3b31`, so neither had diverged.

## 2. Alpha deployment

| Field | Value |
|---|---|
| Project | `GlobalNewsAI-Alpha` · `38134692-b6d7-46a2-9651-1b93dad41dd6` |
| Environment | **alpha** · `70105bf5-b195-41af-b237-8745c8e76506` |
| Service | **frontend** only |
| **Deployment ID** | **`7c7637c6-847b-4fa3-8646-15071b93bf66`** |
| **Status** | **SUCCESS** |
| URL | https://frontend-alpha-4560.up.railway.app |

## 3. Increments

`30158d0` C0 · `f9e276f` C1 · `29a645e` C2 · `0dbc803` C3 · `a8392f1` C4 · `d4b2b6d` C5 ·
`37b5e67` C6 · `6dcb12f` C7 · `00c80f9` C8 · `bdb3b4a` C9 · `b534cff` quality gate.

## 4. The Home now reads in the contract's order

Header → hero with the world visual and the tier boundary → What's happening now beside
the Global Situation Map and the Ask rail → Explore by topic → the Engine → How it works →
Built on trust → Footer.

## 5. Live Alpha smoke results

| Check | Result |
|---|---|
| `GET /` | **200** |
| Hero headline live | "Understand / what's changing." |
| Three hero actions | Explore World · Ask AI about today · Open World Map |
| Tier boundary | present, and **no price, credit balance or checkout** |
| 60-second brief | **populated with real stories and a real publisher image** |
| Category chips | **6 rendered**, all from the governed vocabulary |
| Story rail | **20 story elements**, scroll-snapping |
| Global Situation Map | present, with the four-module legend |
| Legend destinations | **4 real module routes** |
| Explore by topic | present; "View all topics" → `#intelligence-modules` |
| How it works · Built on trust | both present |
| Ask form | `action="/ask"` |
| `/search?q=` anywhere on Home | **0** |
| Superseded headline | **0** |
| PL | `<html lang="pl">`, Polish hero and topic zone |

**The brief was the R1 defect and it is fixed in production.** R1 shipped it absent on
Alpha because `latestUpdates` is only what the rail leaves behind; it now renders real
stories from its own chronological allocation.

## 6. Quota on live Alpha

**0 metered AI or provider requests across all 14 live captures** (seven widths × EN/PL),
measured by recording every request and matching `/analysis`, `/ask-v2`, `/ai`, `openai`,
`anthropic`.

Home still contains no control that can start a metered analysis. The C2 filter has no
client bundle at all; the C3 map performs zero provider-capable reads on mount and on
selection.

Failing responses, named: **28× `401 /api/users/me`** and **14× `401 /api/follows/countries`**
— the correct answers for a signed-out visitor, and the proof both endpoints are real. The
doubled `users/me` count is the known duplicate call recorded in §8.

## 7. Responsive and locales on live Alpha

14 frames at 1920×1080, 1440×900, 1024×768, 768×1024, 430×932, 390×844, 360×800 in EN and
PL. Every frame: HTTP 200, **no horizontal overflow**, correct `<html lang>`, all nine
module titles visible, 0 locale mismatches.

## 8. Known defects and open questions

1. **The R2 prototype was never supplied.** "Explore World", "Go further", "Explore by
   topic", "View all topics" and "metered compute" appear in none of the three R4.1/R5.1
   prototypes, no branch, and not in the C2.1 working tree. Those zones were built from the
   contract's prose plus this repository's retired components. **Needs confirmation that no
   newer prototype exists.**
2. **"View all" clears the category filter rather than linking**, because no all-stories
   route exists. **Flagged in case a route was intended.**
3. **The tier boundary has no CTA**, because no plans, pricing, billing or checkout route
   exists and `/account` has a layout but no page.
4. **`/api/users/me` is requested twice per page** — the header control and the account
   panel each call `useAccount`, with no shared session context.
5. **Three tap targets remain under 44px**: the header logo (NavBar, held under N1/N4),
   MapLibre's own +/- controls (inside the shared `WorldMap`), and the `sr-only` category
   radios (by design — their labels are the real targets).
6. **Polish for the 21 new keys is new copy**, written for this repository rather than
   quoted from the R4.1 catalogue, which does not contain these zones. Marked FOR REVIEW.
7. **The account panel renders nothing while it resolves**, because session state is in an
   httpOnly cookie and the alternative was flashing "Sign in" at signed-in readers.
8. **The desktop header still shows two routable destinations plus non-routing labels**
   where the approved frame draws four — unchanged from R1, held under **N1**.

## 9. Hard holds — all observed

No Production deploy · no `globalnewsai.live` bind · no Conflict, Economy, Energy, Market,
Security, Humanitarian or Politics module started · no specialist Map redesign · Watch
still `false` · no payments · no new providers · **indexing policy unchanged** (`/` still
emits `index, follow`).

`git diff 91a3b31..HEAD` over all specialist components, their routes and `backend/`
returns **0 files**. `IntelligenceModulesSection.tsx` is byte-identical to `c3dd01a`.

## 10. OPEN items — none closed

N1 · N2 · N4 · N5 · N6 · **N7** · N9 · N11 · S1 · S2 · F1 · M2 · M3 · P1 · CC1–CC4 ·
Ask D6 · Spatial D1 · D2 · D17 · D18 · R4.1 C3, C4, C6, C7, C8, C11, C13 · plans/billing.

## 11.

`READY FOR PRODUCT OWNER BETA HOME CLOSURE VISUAL REVIEW — ALPHA`
