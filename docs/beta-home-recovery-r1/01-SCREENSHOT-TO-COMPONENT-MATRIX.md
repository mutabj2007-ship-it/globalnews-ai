# BETA HOME FINAL RECOVERY R1 · SCREENSHOT-TO-COMPONENT MATRIX

**Claude H · owner of the Beta Home visual implementation as of the Product Owner takeover ruling.**
Built **before** implementation, as the activation requires. Nothing in the product tree has been
changed yet; this document is the map the implementation is built from.

```
branch   claude-h/beta-home-final-recovery-r1
base     8bd06acd49d7b8133cd4bf8d05dca610f79c5bc0
         "docs(home): R2 final report and live Alpha evidence"
         integration/beta-launch-convergence-r1 == feature/beta-home-closure-r2 (identical SHA)
```

---

## 0 · WHICH AUTHORITY GOVERNS — MEASURED, NOT ASSUMED

The activation names "the latest Product Owner screenshots and explicit rulings" as controlling and
says that where **older R4.1/R5.1 material conflicts**, the latest ruling wins. Two things had to be
established before a single line could be written, and both were measured rather than assumed.

### 0.1 · The R5.1 package on disk is NOT the composition the activation describes

`desktop or tablet R5.1.zip` and `phone R5.1.zip` (both 2026-09-25 06:18, the newest prototype
packages in `Claude_Output`) carry `prototype/GNAI_Beta_Home_R5.1.html`. That file was searched for
the zone names the activation requires:

```
zone label in the activation          occurrences in GNAI_Beta_Home_R5.1.html
Go further                            0
Global Situation Map                  0
Explore by topic                      0
How it works                          0
Built on trust                        0
Explore World                         0
Ask GlobalNewsAI                      0
happening now                         1
Intelligence modules                  1
```

The same search over `GNAI_Beta_Prototype.html`, `GNAI_Beta_R5_Shell_Ask_Map_Conflict.html` and
`i18n/i18n_en_pl_r5.json` returns the same near-total absence. **R5.1's Home prototype is a
different composition from the one the Product Owner supplied.** Under the activation's own
precedence rule the supplied screenshots win, and R5.1 is demoted to inherited token/i18n material.

### 0.2 · The controlling artifacts

```
PO-DESKTOP-HOME-BETA-LAUNCH.jpg   1280 × 853
  sha256 5ad52b4665a5a75685d74283ac5c45e13bed3387c46a77785a507fc0034b89a6

PO-PHONE-HOME-BETA-CONCEPT.png    1536 × 1024  (three frames: HOME 390×844 ·
                                   EXPLORE·SCROLLED · ASK AI·OPEN)
  sha256 0b3975d6794a86d72ea18fd293074ac3ff43a1147c83906ef02d74331361cac1
```

Both are held in `authority/po-screenshots/` in this package. Every row below cites one of them.

### 0.3 · ONE CONFLICT, REPORTED AND NOT SILENTLY RESOLVED

**The desktop screenshot ends `Explore by topic → Footer`. The written activation requires
`Explore by topic → Intelligence modules → How it works → Built on trust → Footer`.**

The screenshot shows no Intelligence-modules band, no How-it-works band and no Built-on-trust band;
the footer follows the topic cards directly. The written ruling is explicit and unambiguous in the
other direction — *"Product Owner ruling: both stay on Home"*, and *"Preserve the nine visible
module cards"*.

**How this matrix treats it, pending confirmation:** the written ruling governs **presence** (all
three zones stay), and the screenshot governs **composition** of the zones it actually draws. That is
the only reading under which neither instruction is discarded. It is recorded here as a conflict
rather than absorbed, because the alternative reading — that the screenshot is the whole page and
the three zones are cut — is also internally consistent, and choosing between them is a Product
Owner decision, not mine.

> **If the intended page really does end at Explore by topic, say so and I will cut the three
> zones.** Nothing below depends on the answer except rows Z8–Z10.

---

## 1 · WHAT THE BASE ALREADY GETS RIGHT

Measured at `frontend/src/app/page.tsx`, the mount order on the base commit is:

```
NavBar → BetaHero → [ WhatsHappeningNow + HomepageSituationMap | HomeSideRail ]
       → ExploreByTopic → EngineEnergyField + IntelligenceModulesSection
       → HowItWorks → TrustSection → Footer → MobileBottomNav
```

**That is the activation's required order, already.** The recovery is therefore not a
re-architecture: the skeleton is correct and the gap is presentation density, hero identity and one
genuinely missing zone. This matters for how the work is scoped — it is a visual convergence inside
a correct structure, not a rebuild, and no section needs to move.

Two stale artefacts were found in the same file and are noted so a later reader is not misled:

- A long comment block states *"THREE SECTIONS RETIRED FROM HOME — TodayWorkspace, HowItWorks and
  TrustSection"*. `HowItWorks` and `TrustSection` are in fact imported and rendered at lines 380–381.
  The comment is stale; the code already matches the Product Owner's new ruling.
- The same block argues those sections were absent from approved R4.1/R5.1 frames. Under §0.1 that
  reasoning is now moot: R5.1 is not the controlling Home authority.

---

## 2 · THE MATRIX — DESKTOP

Columns: **zone** · what the Product Owner screenshot actually shows · the component that owns it
today · the delta to close · the truth constraint that may not be traded for appearance.

### Z1 · HEADER

| | |
|---|---|
| **Prototype** | Globe glyph + `GlobalNewsAI` wordmark + `BETA` pill; a micro tagline under the wordmark; nav `Home` (active pill) · `World` · `Economy` · `Energy` · `Security` · `Humanitarian` · `More ▾`; right cluster: search glyph, `☰ EN ▾`, `Sign In` (outline), `Get Started` (violet filled) |
| **Owns it** | `components/navigation/NavBar.tsx` |
| **Delta** | Active-state pill on the current section; the two-button right cluster; the tagline micro-line. In the prototype capture the tagline visibly **collides with the wordmark** — that is a defect in the prototype, not a target to reproduce. |
| **Truth** | `Sign In` / `Get Started` must not appear to a signed-in reader (activation: signed-in experience). EN/PL preserved. |

### Z2 · HERO — WORLD IDENTITY

| | |
|---|---|
| **Prototype** | Full-bleed dark-blue illuminated Earth, night-lit Europe/Africa, atmospheric limb glow, faint orbital arcs, scattered small amber and cyan points. Left column: `Understand` (white) / `what's changing.` (cyan) as one two-line H1; sub `Global events. Deeper context. Evidence you can trust.`; a full-width search field `Search countries, topics, companies, assets…` with a round blue submit; then three CTA tiles in a row — `Explore World / See key developments` (blue), `Ask GlobalNewsAI / Get a source-backed answer` (violet), `Open Map / Explore events on a live map` (green). A small floating dark label over the globe reads `A more connected perspective.` |
| **Owns it** | `BetaHero.tsx`, with `HeroWorldVisual.tsx` / `HeroIntelligenceField.tsx` / `WorldMapAnimatedVisual.tsx` available and already in the repository |
| **Delta** | The activation rejects the current technical map treatment as the final hero. Restore large globe presence, stronger illuminated dark blue, and the headline↔globe relationship. Reuse the strongest existing world/globe technology rather than introducing new. |
| **Truth** | **The scattered points on the prototype globe may not be reproduced as event marks.** No fake event dots, no prototype geography presented as live intelligence. Any light on the globe is decorative illumination and must be visibly not-an-event — or absent. |

### Z3 · PREMIUM BOUNDARY — **THE ONE MISSING ZONE**

| | |
|---|---|
| **Prototype** | Inside the hero band, upper right, overlapping the globe: a dark panel with a gold border and crown glyph, `Go further with GlobalNewsAI`, four gold check rows — `Watch what matters` · `Track changes over time` · `Access deeper analysis` · `Professional tools & exports` — a gold filled `View Plans →`, and the footnote `Free to explore. Upgrade anytime.` |
| **Owns it** | **Nothing.** `HomeSideRail.tsx` carries the account panel and the Ask card; there is no premium component anywhere in `components/home/`. |
| **Delta** | New component, mounted in the hero band's upper right — **not** in the side rail below the map, which is where the current tree's only rail lives. |
| **Truth** | No active pricing, no checkout, no credits, no Watch functionality. Established tier language only. Watch remains inactive, so `Watch what matters` must read as a capability of the paid layer, never as an offer to enrol now. `View Plans` may only route somewhere that truthfully exists. |

### Z4 · WHAT'S HAPPENING NOW

| | |
|---|---|
| **Prototype** | Section title + `Selected global developments · Updated 20 min ago`; `View all` at the right in cyan. A horizontal rail of four equal story cards — 16:9 image, category chip top-left (`ENERGY` green · `SECURITY` red · `ECONOMY` blue-violet · `HUMANITARIAN` amber), age top-right (`2h ago`), two-line headline, three-line dek, meta row `region glyph · region · N sources`. **No oversized lead story.** |
| **Owns it** | `WhatsHappeningNow.tsx` (+ `FeaturedStory.tsx`, `CategoryCards.tsx`, `LatestNowRail.tsx` retired-but-present) |
| **Delta** | The activation is explicit: *"Do not let the current oversized lead-story presentation dominate the page."* Four equal cards, clickable category chips including `All`, horizontal rail, desktop hover lift / subtle image zoom, `View all`. Touch-swipe on phone. |
| **Truth** | Real Home feed data only — `getHomeFeed()`, the single existing call. No fake headlines. Real publisher links. Auto-motion only if subtle, pausing on interaction and honouring `prefers-reduced-motion`. |

### Z5 · GLOBAL SITUATION MAP

| | |
|---|---|
| **Prototype** | A compact card beside the editorial column: title `Global situation map` + an external-link glyph; a dark world map carrying coloured dots; a legend row `● Energy` (green) `● Conflict` (red) `● Humanitarian` (amber) `● Economy` (violet). |
| **Owns it** | `HomepageSituationMap.tsx` — already restored, already reusing `/map`'s `WorldMap` through `next/dynamic({ ssr: false })`, already performing zero provider-capable reads on mount or selection |
| **Delta** | Density and placement: in the prototype it is a **compact card beside** the editorial area. On the base it sits *below* `WhatsHappeningNow` in the left column. Preserve the four-entry conceptual legend. |
| **Truth** | *"Use real available data/layer meaning. Do not invent dots merely to make the screenshot look populated."* The legend may be conceptual; the marks may not be fabricated. Selecting geography must continue to spend no quota. |

### Z6 · ASK GLOBALNEWSAI RAIL

| | |
|---|---|
| **Prototype** | Below the map card: sparkle glyph + `Ask GlobalNewsAI` + `Get clear, source-backed answers.`; three suggestion rows each with a trailing `→` — `What's driving oil prices this week?` · `Summarize the Suez situation` · `Latest economic data for Poland`. |
| **Owns it** | `HomeSideRail.tsx` — already built, already linking `/ask?q=…` as a draft, already carrying the "nothing runs until you press Send" note |
| **Delta** | Visual density only. The mechanism is already correct and must not be re-engineered. |
| **Truth** | Suggestions prefill/open `/ask`; they must not execute analysis. `/ask` draft and `/search` analysis remain separate. The shipped prompts stay the governed `hero.exampleQuestions` catalogue (EN+PL), not the screenshot's illustrative samples. |

### Z7 · EXPLORE BY TOPIC

| | |
|---|---|
| **Prototype** | Title + `Different perspectives. One connected world.`; `View all topics →` at the right. Six cards: `World` (blue, globe) · `Economy` (violet, bars) · `Energy` (green, bolt) · `Security` (red, shield) · `Humanitarian` (amber, people) · `Markets` (slate, trend). Each: icon tile, name, two-line description, a round accent-coloured arrow at the card's lower right. |
| **Owns it** | `ExploreByTopic.tsx`, reading the six out of `INTELLIGENCE_MODULES` |
| **Delta** | Card treatment — the per-card accent, the icon tile, the corner arrow. Reading names from the registry rather than a second list is already correct and stays. |
| **Truth** | `View all topics` must anchor into the Intelligence modules section (`#intelligence-modules`), which is also `MobileBottomNav`'s Intelligence destination. |

### Z8 · INTELLIGENCE MODULES — *subject to the §0.3 conflict*

| | |
|---|---|
| **Prototype** | **Not drawn in the supplied desktop screenshot.** Governed by the written ruling only. |
| **Owns it** | `IntelligenceModulesSection.tsx` (nine cards, Gate A, byte-preserved) + `EngineEnergyField.tsx`, with `IntelligenceEngineRing.tsx` / `intelligenceEngineGeometry.ts` retired-but-present |
| **Delta** | Restore the glowing ring / energy-field identity **behind** the nine cards. The activation is explicit that *"the ring supports the card grid; it must not hide the cards again"* — which is exactly the regression that caused the ring's retirement: module titles were in the DOM but absent from rendered innerText because the radial ring kept them in hover/focus panels. |
| **Truth** | Nine cards, truthful states, titles readable as text without hover. `intelligenceModulesR51.spec.ts` must keep passing. |

### Z9 · HOW IT WORKS — *subject to the §0.3 conflict*

| | |
|---|---|
| **Prototype** | Not drawn. Written ruling: stays on Home, below the high-engagement zones. |
| **Owns it** | `HowItWorks.tsx` — already mounted at page.tsx:380 |
| **Delta** | Visually integrate with the final Home rather than mounting the old block unchanged. |

### Z10 · BUILT ON TRUST — *subject to the §0.3 conflict*

| | |
|---|---|
| **Prototype** | Not drawn. Written ruling: stays on Home. |
| **Owns it** | `TrustSection.tsx` — already mounted at page.tsx:381 |
| **Delta** | Same integration requirement as Z9. |

### Z11 · FOOTER

| | |
|---|---|
| **Prototype** | Globe + `GlobalNewsAI` + `BETA`; `About · Privacy · Terms · Contact`; `● All systems operational` with a green dot; right-aligned `Real information. Real context. A clearer world.` |
| **Owns it** | `components/layout/Footer.tsx` |
| **Truth** | `All systems operational` is a live claim. It may only render from a real status signal, or it does not render. |

---

## 3 · THE MATRIX — PHONE

Three frames at 390×844, board-captioned `BETA MOBILE CONCEPT · ILLUSTRATIVE CONTENT`. **The phone
Home is not the desktop Home reflowed** — it carries zones the desktop does not, and renames two.

### FRAME 1 · HOME

| order | prototype | owns it / delta |
|---|---|---|
| 1 | Compact header: globe + `GlobalNewsAI` + `BETA`, right: search glyph, bell glyph | `NavBar` compact — bell is a new affordance; it must not imply a working alert inbox |
| 2 | Hero: same two-line headline, sub shortened to `Global events. Evidence you can trust.`, globe bleeding off the top-right | `BetaHero` / `HeroWorldVisualMobile.tsx` |
| 3 | Search field `Search places or topics` + round blue submit — **different placeholder from desktop** | `BetaHero` |
| 4 | **`Your world in 60 seconds`** with a trailing `›`, then three rows, each an icon + one line + `›`: `Oil prices ease as new supply routes open` · `Tensions rise in the Middle East` · `Aid access improves in parts of East Africa` | `SixtySecondBrief.tsx` — this is the activation's 60-second brief. **Must bind truthfully to the already-admitted Home corpus, with no second provider request and no page-load AI, and must not disappear merely because the remainder allocation is empty.** |
| 5 | Two stacked full-width CTAs: `Ask AI about today` (violet, sparkle, `→`) and `Open Map / Explore events on a live map` (green, `→`) | New phone-only CTA pair; desktop has three tiles, phone has two |
| 6 | `What's happening now` + `View all`, then **one** large lead card: `ENERGY` chip, 16:9 image, headline, three-line dek, meta `EU · 8 sources · 20 min ago`, `⋯` overflow | `WhatsHappeningNow` compact. Note the asymmetry: the oversized lead is **wrong on desktop and right on phone** |
| 7 | Bottom tab bar, five tabs: `Home` (active) · `Explore` · `Ask AI` · `Map` · `Saved` | `MobileBottomNav.tsx` — currently four approved destinations; `Saved` is a fifth and needs a truthful destination or it does not ship |

### FRAME 2 · EXPLORE · SCROLLED

| order | prototype | owns it / delta |
|---|---|---|
| 1 | `For you` + `View all ›`, two story cards side by side (`ECONOMY 2h ago`, `HUMANITARIAN 4h ago`) with image, headline, dek, meta `Poland · 6 sources` | Signed-in surface. `HomeAccountPanel.tsx` holds the held-back "For you". **Do not fabricate personalization** — build only where the real account/follow APIs support it |
| 2 | **`World Pulse`** + `Open full map →`, a dark world map with coloured dots, same four-entry legend | Same component as desktop Z5, **different title on phone**. Same no-invented-dots rule |
| 3 | `Following` + `Manage ›`, three chips each with a state dot: `Poland` (flag) · `East Africa` (globe) · `Energy` (leaf) | `useCountryFollows.ts` / `CountryFollowControl.tsx`. Follow and Watch remain distinct; Watch stays inactive |
| 4 | `Explore by topic`, six cards in a 2-column grid, same six names and accents as desktop | `ExploreByTopic` compact |

### FRAME 3 · ASK AI · OPEN

| | prototype | owns it / delta |
|---|---|---|
| | A bottom sheet over a dimmed Home, grab handle + `✕`: sparkle + `Ask AI about today` / `Explore today's news with sources.`; three icon rows — `What changed in Poland?` · `Explain today's energy news` · `What matters in East Africa?`; `Recent questions` with clock glyphs — `Summarize the Suez situation` · `What's driving oil prices this week?`; a composer `Ask a follow-up…` with mic and a round blue send; footnote `Answers include sources.` | Sheet, not a page. Suggestions prefill `/ask`. **Nothing executes on open.** `Recent questions` implies stored history — it ships only where real history exists, otherwise the block is absent, not stubbed |

**Required phone widths:** 430×932 · 390×844 · 360×800. Only 390×844 is drawn; 430 and 360 are
adaptations of it, and any composition decision unique to them is mine to derive from the 390 frame,
not to invent.

---

## 4 · WHAT IS NOT NEGOTIABLE FOR APPEARANCE

Carried verbatim from the activation and attached to every row above:

```
real governed Home data          no fake headlines           no fake event dots
no prototype geography as live intelligence                  no AI on normal browsing
/ask draft and /search analysis stay separate                real publisher links
EN/PL preserved                  Follow ≠ Watch              Watch inactive
Production HOLD
```

The single most likely way this recovery fails is by reproducing the prototype's **populated**
appearance — four dense story cards, a dotted world map, a lit globe — with content the product does
not actually hold. Every row above therefore carries its own truth constraint, and where the honest
render is emptier than the prototype, **the honest render ships and the gap is stated.**

---

## 5 · SEQUENCE

```
1  matrix            ← this document, delivered for Product Owner reading before code
2  desktop           Z3 premium card (new) · Z2 hero identity · Z4 card rail density ·
                     Z5 map card placement · Z7 topic cards · Z8 ring behind the grid
3  desktop captures  side-by-side against PO-DESKTOP-HOME-BETA-LAUNCH.jpg, iteratively
4  phone             430×932 · 390×844 · 360×800, from FRAME 1–3
5  EN/PL · quota · build/tests
6  Alpha only        production and globalnewsai.live remain HOLD
```

Step 2 does not begin until §0.3 is answered, because rows Z8–Z10 change with the answer.

---

**No deployment. Production HOLD.**
