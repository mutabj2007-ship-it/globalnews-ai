# HOME CLICK CONTRACT R1

**Base:** `release/alpha-m08-integrated-r1` @ `7e87ec1f59350ba513d00a8cd824a584ad34a8fb`. Work branch: `engineering/ask-search-home-click-r1` (local; not pushed).
**Revision:** R1 closure. The CTO rulings are recorded in §0, and the dock transition row is updated.
**Scope:** every visible interactive control on Home, on phone and on tablet/desktop. Home was **not redesigned**.

- **Machine-checkable form:** `frontend/src/components/home/homeClickContract.ts`, which is audit data and imported by no product code. It is enforced by `homeClickContract.spec.ts`: 113 assertions, all passing.
- **Destination registry:** `INTELLIGENCE_MODULES` (`frontend/src/lib/intelligenceModules.ts:170`). Registry-backed rows name a module id, and the spec resolves the route through the registry and `isModuleNavigable`, so there is still exactly one route table. The rest have no registry entry by design: anchors, `/ask`, `/search`, account endpoints and publisher URLs.

## Breakpoints

- Phone is below 1024 px. It shows `NavBar` (phone row), `MobileBottomNav` and `HomePremiumTeaser`.
- Tablet/desktop is 1024 px and up. It shows `BetaHomeHeader`, the Hero side panel, and the rail brief.
- Tablet in this document means the compact header row at 1024–1279 px (`hdr.compact.*`). An 820 px tablet uses the phone layout.

The Ask dock is mounted from the root layout at every width.

## Legend

| Column | Values |
|---|---|
| **Back** | `push`: Next soft navigation.<br>`doc`: full document navigation.<br>`hash`: same-document anchor.<br>`tab`: new tab; Home history is unchanged. |
| **AI** | Model-quota cost of the click itself. |
| **Net** | Provider or backend network cost of the click. |

## 0. CTO-RULINGS-CLOSURE

| # | Ruling | Home impact | Status |
|---|---|---|---|
| 1 | A language switch after a completed run must not auto-execute; the question is staged and needs an explicit Run analysis. | `hdr.language` / `nav.m.language` stay 0 AI cost everywhere, **including on `/search` after a run**. | **Done.** Consent is bound to (question, language). Browser: switching after a run adds **0**; Run then adds exactly **1**, in the new language. |
| 2 | Replace "Open full analysis" with the explicit compute label "Run full analysis", with the supporting copy "Starts a new source-backed analysis." | `dock.open-full` renamed (EN "Run full analysis" / PL "Uruchom pełną analizę"), with the note "Starts a new source-backed analysis." / "Rozpoczyna nową analizę opartą na źródłach." | **Done.** The old label is asserted absent in EN and PL. |
| 3 | Map Analysis must not directly start compute; it opens the workspace with the governed context staged, and Run analysis is explicit. The Map control label is unchanged. | Home → Map (`hero.open-map`, `acct.manage`, `bnav`) costs 0. The Map Analysis control lands on `/search` staged. | **Done.** Pinned: no Map surface can import the consent grant or the transport. The Map label is untouched. |

## 1. Matrix

| id | Control (EN / PL) | Where | Destination | Behaviour | Signed in | Signed out | Back | Unavailable state | Int/Ext | AI | Net | Automated test |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hero.explore-world | Explore World / Poznaj świat | T/D | `#whats-happening-now` | scroll | = | scrolls to story rail | hash | the rail shows "Couldn't load the latest updates." when the feed is empty | int | 0 | none | homeClickContract.spec (**new**) |
| hero.ask | Ask GlobalNewsAI / Zapytaj GlobalNewsAI | all | in-place Ask dock (`openGlobalAsk`) | dock | = | opens dock, keeps draft | — | — | int | 0 | none | askAiDock.spec; askDockRequestCount.spec (**new**) |
| hero.open-map | Open Map / Otwórz mapę | all | registry `country-intelligence` → `/map` | navigate | = | = | doc | — | int | 0 | /map load (retained corpus, no provider) | homepage.architecture.spec; homeClickContract.spec |
| hero.composer | Ask anything… / Zapytaj o cokolwiek… (form + textarea, max 1,000 chars) | all | stages the exact draft in the dock; **no route action** | dock | = | = | — | an empty draft is a silent no-op | int | 0 | none | askAiDock.spec; askDockRequestCount.spec; browser script |
| hero.premium.cta | Plans coming soon / Plany wkrótce | T/D | — | disabled | = | = | — | `disabled`, `aria-disabled`, and "Nothing on this page charges you." | int | 0 | none | homeClickContract.spec (**new**) |
| premium.teaser.cta | Plans coming soon / Plany wkrótce | P | — | disabled | = | = | — | `disabled`, `aria-disabled` | int | 0 | none | homeClickContract.spec (**new**) |
| rail.ask.suggestion ×3 | Suggested questions (`hero.exampleQuestions`) | all | in-place dock with the suggestion staged | dock | = | = | — | — | int | 0 | none | askAiDock.spec; askDockRequestCount.spec |
| rail.ask.launch | Ask GlobalNewsAI | all | in-place dock | dock | = | = | — | — | int | 0 | none | askAiDock.spec |
| brief.* (60-second stories) | story titles; "Your world in 60 seconds / Twój świat w 60 sekund" | lead+2 on P, lead+3 on T/D | publisher URL | new tab | = | = | tab | the panel renders nothing when there are no items | ext | 0 | none | homeClickContract.spec (**new**) |
| now.card ×≤12 | story titles | all | publisher URL (`rel=noopener noreferrer`) | new tab | = | = | tab | `role=status`: "Couldn't load the latest updates. / Nie udało się wczytać najnowszych informacji." | ext | 0 | none | homeClickContract.spec (**new**) |
| now.chip | All / World / Politics … (Wszystkie / Świat / Polityka …) | all | CSS radio filter | filter | = | = | — | not drawn with fewer than 2 categories | int | 0 | none | homeClickContract.spec (**new**) |
| now.view-all | View all / Pokaż wszystko | all | the All radio | filter | = | = | — | **R1: rendered only when the All radio exists** | int | 0 | none | homeClickContract.spec (**new**) |
| now.rail.prev/next | Previous / Next story | all | in-place scroll | toggle | = | = | — | never disabled; does nothing when there is no overflow | int | 0 | none | homeClickContract.spec (**new**) |
| topics.economy / energy / security / humanitarian / market | Economy, Energy, Security, Humanitarian, Markets | all | registry destination | navigate | = | = | doc | would render inert if the registry withdrew the destination | int | 0 | module route load | intelligenceModules.spec; homeClickContract.spec |
| topics.world | World / Świat | all | registry `world-intelligence` (comingSoon) | disabled | = | = | — | **R1: `aria-disabled="true"`**; muted, no pointer | int | 0 | none | homeClickContract.spec (**new**) |
| topics.view-all | View all topics · page coming | all | — | disabled | = | = | — | `disabled`, `aria-disabled`, "page coming" | int | 0 | none | homeClickContract.spec (**new**) |
| acct.signin-to-follow | Sign in to follow / Zaloguj się, aby obserwować | all | **R1: `/api/auth/google?returnTo=%2F`** | OAuth | not rendered | Google OAuth, then back to Home | doc | the panel renders nothing while the account loads | int→Google | 0 | click → OAuth 302 | homeClickContract.spec (**new**) |
| acct.foryou.card ×≤3 | For you / Dla Ciebie: story titles | all | publisher URL | new tab | stories from followed countries | not rendered | tab | "Nothing from the countries you follow in today's coverage yet." | ext | 0 | none (reuses the feed) | homeClickContract.spec (**new**) |
| acct.manage | Manage / Zarządzaj | all | registry `country-intelligence` → `/map` | navigate | follow/unfollow lives on the map | not rendered | doc | hidden while follows load | int | 0 | /map load | homeClickContract.spec (**new**) |
| follow/unfollow | — | — | **Not present on Home.** Follow/Unfollow is a map control (`CountryFollowControl`). | — | — | — | — | — | — | — | — | — |
| hdr.account.signin | Sign In / Zaloguj się | all | `/api/auth/google?returnTo=<path>` | OAuth | replaced by the Account menu | OAuth | doc | empty placeholder while loading | int→Google | 0 | `GET /api/users/me` on mount | headerAccountPrivacy.spec |
| hdr.account.menu | Account: History, Support, Settings, Sign out | all | `/history`, `/support`, `/account/settings`, `POST /api/auth/signout` | toggle | menu | not rendered | push | — | int | 0 (**R1: History entries now land staged**) | sign-out is 1 POST | headerAccountPrivacy.spec |
| hdr.search | Search / Szukaj | T/D | `/search` (`prefetch={false}`) | navigate | = | research workspace | push | — | int | 0 | RSC on click only | navQuotaSafety.spec; homeClickContract.spec |
| hdr.modules | Economy / Energy / Security / Humanitarian, plus More (Country, Politics, Conflict, Market) | D | registry | navigate | = | = | push | World Intel shows `aria-disabled` "Not yet / Wkrótce" | int | 0 | prefetch | homeClickContract.spec (**new**) |
| hdr.world | World / Świat | D | `#whats-happening-now` | scroll | = | = | hash | — | int | 0 | none | homeClickContract.spec (**new**) |
| hdr.compact (Home / World Map / Ask AI / Intelligence) | Home / World Map / Ask AI / Intelligence | T (1024–1279) | `/`, `/map`, `/ask`, `#intelligence-modules` | navigate | = | = | push / hash | — | int | 0 (`/ask?q=` only stages) | prefetch | homeClickContract.spec (**new**) |
| hdr.language | Language / Język (EN, PL) | all | persist cookie, then `router.refresh()` | toggle | = | = | — | — | int | 0 | one server Home-feed read (provider cache 300 s) | languageSelector.spec |
| nav.m.search | Search (phone header) | P | `/search` | navigate | = | = | push | — | int | 0 | **R1: no idle prefetch** | navQuotaSafety.spec; homeClickContract.spec |
| nav.m.menu | Menu: Home, World Map, Help, account; 7 editorial items | P | `/`, `/map`, `/support` | toggle | = | = | push | the 7 editorial items are `aria-disabled` "not yet available / jeszcze niedostępne" | int | 0 | `GET /api/users/me` on open | mobileNavViewport.spec; navQuotaSafety.spec |
| bnav.tabs | Home / World Map / Ask AI / Intelligence | P | `/`, `/map`, `/ask`, `#intelligence-modules` | navigate | = | = | doc / hash | — | int | 0 | route loads | intelligenceModulesR51.spec |
| dock.launcher | Ask AI / Zapytaj AI | all | toggles the dock | dock | = | = | — | hidden while a dialog covers it | int | 0 | none | askAiDock.spec |
| dock.submit | Ask / Zapytaj | all | `POST /api/analysis/news` | send | signed-in ceiling | anonymous ceiling | — | disabled when empty or in flight; **R1 guards Enter/requestSubmit too** | int | **1 per Send** | 1 POST | askDockRequestCount.spec (**new**) |
| dock.open-full | **Run full analysis / Uruchom pełną analizę** with the note "Starts a new source-backed analysis." / "Rozpoczyna nową analizę opartą na źródłach." (CTO ruling 2) | all | `/search?q=…[&storyTitle&articleId&countryCode]` | navigate | = | = | doc | only when the turn has analysis or articles | int | **1, the explicit deeper-compute action** (same tab only; a new tab, copied link or reload lands staged at 0) | 1 POST | searchComputeRequestCount.spec, evidenceDisclosureR1.spec (**new**) |
| dock.dashboard-entry | Ask GlobalNews AI ↗ | all | `/ask?q=<draft>` | navigate | = | = | doc | — | int | 0 (stages only) | /ask load | dashboardContext.spec |
| footer.links | Help & Support, Privacy, Terms, Source Policy, Third-Party Notices | all | `/support`, `/privacy`, `/terms`, `/source-policy`, `/third-party-notices` | navigate | = | = | doc | — | int | 0 | route loads | footerNavHud.spec |
| auth-error.dismiss | Dismiss / Zamknij | all, when present | hides the banner | toggle | = | = | — | only with an admissible auth-error parameter | int | 0 | none | authErrorBanner.spec |

`=` means the same as signed out.

## 2. Route truth: CTO-stated vs verified

| CTO statement | Verified at `7e87ec1` | Verified on live Alpha (`946a47ed`) |
|---|---|---|
| Hero Explore World → `#whats-happening-now` | ✅ | ✅ |
| Open Map → `/map` | ✅ | ✅ |
| Home Ask launch → in-place Ask dock | ✅ | ❌ **Alpha serves `<a href="/ask">`.** The dock series is not deployed (see ASK-SEARCH §0). |
| Premium plans control → truthfully disabled | ✅ | ✅ |
| Story cards → publisher URLs | ✅ | ✅ |
| Signed-out personalization → `/auth/google` | ❌ **`/auth/google` returns 404 on Alpha.** The served entry is `/api/auth/google` (302 to Google). **Fixed in R1.** | ❌ (404, verified by HTTP) |
| Manage Following → `/map` | ✅ | ✅ |
| Header Search → `/search` without compute on opening | ✅ (no `q`, so idle) | ✅ |

## 3. Corrections made in R1 (governed behaviour only, no visual redesign)

| # | Defect | Fix | Evidence |
|---|---|---|---|
| F1 | "Sign in to follow" pointed at `/auth/google`, which this origin does not serve (Alpha 404). | `accountSignInUrl('/')`, which produces `/api/auth/google?returnTo=%2F`. This is the same helper every other sign-in uses, and `/` is on the backend `returnTo` allowlist. | `HomeAccountPanel.tsx`; homeClickContract.spec |
| F2 | "Open full analysis" auto-ran on arrival, including on reload, copy-link and new tab, and its label did not say that it computes. | It is now the explicit deeper-compute action for **same-tab activation only**, through the governed consent grant, relabelled **Run full analysis** (CTO ruling 2). Every other arrival is staged. | ASK-SEARCH-ENGINEERING-R1 |
| F3 | "View all" rendered as a label for a radio that does not exist when there are fewer than 2 categories, so it was a dead control. | Rendered only with the filter. | `WhatsHappeningNow.tsx` |
| F8 | The World topic card was inert but not exposed as disabled. | `aria-disabled="true"` added; the visual is unchanged. | `ExploreByTopic.tsx` |
| F10 | The phone header Search link idly prefetched `/search` (network only, no compute). | `prefetch={false}` on both NavBar search links, matching BetaHomeHeader. | `NavBar.tsx` |
| — | Dock double submit: the button is disabled while in flight, but Enter or `requestSubmit` could still submit. | `if (phase.kind === 'loading') return;` | `AskAiDock.tsx`; askDockRequestCount.spec |

## 4. Recorded, not changed (outside a click-contract correction, or needs a CTO decision)

- **F4:** after signing out from the header, `HomeAccountPanel` keeps showing signed-in state until reload. It has its own `useAccount` instance.
- **F5:** between 861 and 1023 px, the Ask launcher may overlap the fixed `MobileBottomNav`. Needs a visual check on a device.
- **F6:** five Home `/map` links are literals rather than registry lookups. The spec pins them equal to the registry value.
- **F7:** the header "World" is a live anchor while the World module is "coming soon". The label is defensible, but the product should decide.
- **F9:** the compact-header and bottom-nav "Ask AI" open the `/ask` page, while every Hero and rail Ask opens the dock. Both cost 0; they are inconsistent, not wrong.
- **F11:** Home issues 3 `GET /api/users/me` calls on load, and `GET /api/follows/countries` even when signed out (401).
- **F12:** the empty Hero submit is enabled and does nothing.
- **F13:** rail prev/next are never disabled.
- **F14:** language switching and doc-nav back to Home each cost one server Home-feed read. That read is provider-cached for 300 s.
- **F15:** new-tab story links carry no "opens in new tab" cue.
- **F16:** stale comments. `BetaHero.tsx:55-63` and `HomeSideRail.tsx:40` still describe `/ask` links. `homepage.architecture.spec` "five ways" reads the retired `Hero.tsx`.

## 5. Browser evidence

See ASK-SEARCH-ENGINEERING-R1 §5. The same run exercises Home opening, the Hero composer, dock staging, Send, the second turn and Open full analysis at 360, 390 (EN and PL), 430, 820 and 1440 px.
