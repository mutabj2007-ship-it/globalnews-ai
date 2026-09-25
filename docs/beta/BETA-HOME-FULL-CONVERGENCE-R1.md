# BETA HOME FULL CONVERGENCE R1

Status: PRODUCT OWNER AUTHORIZED
Date: 2026-09-25
Branch: `feature/beta-home-full-convergence-r1`
Base: `c3dd01acae6beb954750baa074bc8ac10f50fe93`

## 0. Product Owner ruling

The public Beta Home is the immediate product target.

The already-integrated Intelligence modules / “Engine Intelligence” section is **one accepted Home section only**. It MUST NOT be interpreted as completion of the whole Home page.

Do not start specialist/deeper module convergence until the entire approved Beta Home has been implemented, integrated to Alpha, visually inspected by the Product Owner on desktop and phone, and accepted.

The long design effort for the Beta launch Home is authoritative and must be implemented as a coherent whole, not as isolated fragments.

## 1. Design authority

Use the verified authority chain already established in Issue #28:

### R4.1 complete Home baseline
Desktop/tablet SHA256:
`9da210532e77968d1ac8cff3501f317dfc43fafc4a9dcf08a37e09dccf2494bc`

Internal root:
`GNAI_BETA_LAUNCH_DESKTOP_TABLET_DESIGN_R4`

Phone SHA256:
`f843483c910ddc10a0540de3b71dab54ed7214d68622529d76aac2870878ffe0`

Internal root:
`GNAI_BETA_LAUNCH_PHONE_DESIGN_R4`

### R5.1 approved Home delta
Desktop/tablet SHA256:
`a90954d1871293a202e9767cd12b3429b7dfda34099b7b354db22c6c3aa2c9bb`

Phone SHA256:
`85ecda572b1f64bb7e60beb1bf7451883578c1f8ca2b44b5989f090c6c6362be`

Match artifacts by SHA256, not outer filename.

Authority precedence:
1. current Product Owner / CTO rulings;
2. explicit non-OPEN R5.1 Home delta;
3. complete R4.1 Home authority for everything R5.1 says is unchanged;
4. current implementation only as code to modify, never as missing design authority.

Anything marked OPEN remains OPEN unless a later Product Owner/CTO ruling explicitly closes it.

## 2. Major assignment objective

Deliver the **entire approved Beta launch Home screen** as one professional convergence assignment, implemented incrementally but completed end-to-end before moving into specialist intelligence modules.

The final Home must:
- match approved desktop/tablet and phone design authority;
- retain real/governed data paths;
- be readable and useful on first view;
- have coherent hierarchy, typography, spacing, shapes, colour and interaction;
- work in EN and PL;
- work at desktop and phone widths;
- preserve quota safety;
- preserve routing truth;
- contain no illustrative/prototype content presented as live data;
- be ready for Product Owner visual inspection on Alpha.

## 3. Existing accepted section

The Intelligence modules / Engine Intelligence section at `c3dd01a` is accepted as **Home increment H4** only.

Preserve:
- all nine modules;
- approved title colours;
- current route/state truth;
- EN/PL;
- no-metered-AI browsing;
- responsive behaviour;
- World Intelligence coming-soon treatment;
- current navigation destinations.

Do not redesign this section again unless required to make the complete Home composition match the approved design authority.

## 4. Required incremental implementation sequence

Work through these increments continuously on the same branch. Do not ask for Product Owner approval between normal increments. Commit each increment separately so CTO review can trace the work.

### H0 — Full Home authority reconciliation

Before visible code changes:
- re-read complete R4.1 desktop/tablet + phone Home authority;
- re-read R5.1 Home delta;
- inspect every current component mounted by `frontend/src/app/page.tsx`;
- build an exact Design Zone -> current component -> action matrix;
- classify each Home element as:
  - KEEP EXACT;
  - RESTYLE TO AUTHORITY;
  - RECOMPOSE;
  - REPLACE;
  - RETIRE FROM HOME;
  - OPEN / HOLD;
- explicitly identify where current Alpha diverges from approved Home;
- do not use current implementation to fill missing design decisions.

Commit the reconciliation report before implementing H1.

### H1 — Global Home shell and first-screen framing

Converge the Home shell that frames the first viewport:
- page canvas/background;
- header;
- top navigation;
- language/account controls already approved for Home;
- live/data-status strip where authority requires it;
- first-fold vertical rhythm and maximum widths;
- desktop/tablet and phone shell;
- mobile bottom navigation;
- footer relationship to the Home composition.

Preserve the existing four navigation destinations and current route behaviour unless explicitly ruled otherwise.

### H2 — Hero / primary Home action

Implement the approved Hero as a complete responsive feature, not a partial styling pass.

Include only what the approved authority actually specifies, such as:
- approved headline/subheadline;
- primary Ask/search entry presentation;
- world/context visual where approved;
- live/current information panel where approved;
- CTA hierarchy;
- responsive geometry;
- keyboard/focus/accessibility behaviour;
- phone layout and scrolling.

Preserve:
- `/ask` = Ask draft/conversational entry;
- `/search` = explicit analysis/research workspace.

Do not cause automatic metered AI calls from browsing, focus, category selection or page load.

### H3 — Current developments / “what is happening now” editorial area

Converge the approved current-developments/news area as a reader-facing Beta surface:
- real Home feed only;
- clear story hierarchy;
- category labels localized;
- source/time/provenance cues where authority requires;
- no duplicated story surfaces;
- no illustrative headlines;
- no fixture content;
- no raw internal IDs.

If the authority calls for cards, panels, rails or a situation/current-events block, implement them exactly from the approved Home authority rather than preserving an obsolete current composition.

### H4 — Intelligence modules

Already implemented and Alpha-proven at `c3dd01a`.

Retain and regression-test it while integrating the rest of Home.

### H5 — Remaining approved Home information / trust / explainer zones

Reconcile and implement every remaining approved Home section from the R4.1/R5.1 authority, including any:
- Today / live intelligence summary;
- map/situation gateway;
- “How it works” explanation;
- trust/source methodology;
- plans/access boundary;
- supporting CTA;
- footer content;
- other Home-only zone shown by the authority.

IMPORTANT: the exact authority decides which of these exist. This list is a completeness checklist, not permission to invent a section that is not in the approved design.

Current components such as `TodayWorkspace`, `HowItWorks`, `TrustSection`, or any retired Home component are implementation candidates only. Keep, restyle, replace or retire them based on the approved Home authority.

### H6 — Whole-page responsive convergence

Verify the Home as one composition, not component-by-component.

Required widths:
- 1920x1080 where the authority supplies it;
- 1440x900;
- 1024x768 / tablet authority size where supplied;
- 768x1024 where supplied;
- 430x932;
- 390x844;
- 360x800.

Check:
- no horizontal overflow;
- no clipped text;
- no overlay collisions;
- keyboard does not make the primary Home interaction unusable on phone;
- bottom navigation does not cover actionable content;
- scroll order makes sense;
- module cards, hero, current developments and footer read as one product;
- touch targets are usable.

### H7 — EN / PL full-Home convergence

Validate the entire Home in EN and PL:
- no English application chrome leaking into PL;
- provider/article content remains in the supplied language unless the product explicitly provides translated content;
- no invented translations of provider facts;
- responsive layout works with longer Polish copy;
- metadata/lang state remains correct.

### H8 — Full Home quality gate

Before Alpha integration:
- run relevant frontend tests;
- run shared tests if touched;
- run frontend production build;
- preserve known baseline failures only; introduce zero new failures;
- capture full-page browser evidence;
- inspect console and network failures;
- verify account/follow requests against a real backend environment where possible;
- verify 0 metered AI requests on ordinary Home browsing;
- verify no prototype/fixture/sample content is in the live Home path;
- verify all intentional destinations;
- verify `/ask` vs `/search`;
- verify Watch remains inactive;
- verify Follow and Watch remain distinct;
- verify no specialist dashboard source was redesigned.

## 5. Visual evidence required

Create before/after and final full-page evidence under a dedicated Home evidence folder.

At minimum:
- desktop 1440 EN + PL;
- phone 430 EN + PL;
- phone 390 EN + PL;
- phone 360 EN + PL.

Also capture authority-supported tablet/large-desktop sizes when available in R4.1.

Evidence must show the **whole Home**, not only the Intelligence modules section.

For each viewport record:
- HTTP status;
- console errors;
- failed responses with URLs/status;
- horizontal overflow;
- document language;
- major Home sections present and visible;
- navigation destinations;
- metered AI/provider requests;
- key interactive controls.

## 6. Real-data / truth rules

The Home may display only:
- governed real feed data;
- approved product/application copy;
- truthful availability/degraded/preview/coming-soon states.

Do not ship:
- illustrative headlines as live stories;
- sample map incidents;
- prototype geography;
- prototype renderer code;
- sample credit balances;
- fictional counts;
- fixture data through the public Home route;
- placeholder claims presented as current intelligence.

A missing data source must render as a truthful gap/degraded state, not be disguised with prototype content.

## 7. Quota rules

Ordinary Home reading must not consume metered AI.

No metered AI on:
- page load;
- scrolling;
- opening a normal navigation menu;
- language switch;
- module-card browse;
- category selection;
- reading a story;
- expanding a non-AI disclosure.

AI runs only after a clearly explicit user action in the approved Ask/analysis flows.

## 8. Git discipline

Use:
`feature/beta-home-full-convergence-r1`

Base:
`c3dd01acae6beb954750baa074bc8ac10f50fe93`

Commit each increment separately:
- H0 authority reconciliation
- H1 shell
- H2 Hero
- H3 current developments
- H5 remaining Home zones
- H6 responsive
- H7 EN/PL
- H8 final verification

H4 is already present and should not be recreated as a new feature commit.

Do not squash history merely for neatness.

Do not merge stale feature branches wholesale.

If useful code exists on an old branch, port only the exact needed change after comparing it with the current Beta base.

## 9. STOP conditions

Stop only for a true authority or safety conflict, for example:
- two approved authorities require incompatible outputs and precedence cannot resolve them;
- a required Home design artifact is genuinely missing;
- implementation would require activating a new provider without authority;
- implementation would require Production changes;
- implementation would fabricate data.

Do NOT stop merely because one component is difficult. Continue through independent Home work.

## 10. Final Alpha integration — already authorized

The Product Owner has explicitly authorized the **final completed Home** to be integrated to Alpha after H0-H8 pass.

Therefore Claude Code may, after all final gates pass:

1. ensure the Home branch is clean and pushed;
2. verify `integration/beta-launch-convergence-r1` has not diverged unexpectedly;
3. integrate the final Home branch into `integration/beta-launch-convergence-r1` using a safe fast-forward or reviewed merge;
4. integrate the same accepted result into `release/alpha-m08-integrated-r1`;
5. trigger the **Alpha frontend only** deployment;
6. wait for Railway SUCCESS;
7. perform Alpha smoke checks on the live URL;
8. post exact integrated SHA + Railway deployment ID + smoke results;
9. STOP for Product Owner visual inspection.

If the integration branch has unexpected new commits/conflicts, do not force. Report the conflict and stop before merge.

## 11. No deeper work before Home visual PASS

After final Alpha deployment:
- do NOT start Conflict;
- do NOT start Economy;
- do NOT start Energy;
- do NOT start Market;
- do NOT start Security/Humanitarian/Politics/Map/Ask convergence.

Wait for Product Owner Home visual review.

The Product Owner will open Alpha, inspect desktop and phone, record defects, and issue one correction pass if needed.

Only after Product Owner says the Home is visually accepted may the next specialist module begin.

## 12. Production HOLD

Not authorized:
- Production deployment;
- `globalnewsai.live` binding;
- public indexing changes;
- provider activation;
- monetization activation.

## 13. Required final report

After final Alpha deployment return:

1. final Home commit SHA;
2. integrated Beta SHA;
3. Alpha release SHA;
4. Railway frontend deployment ID/status;
5. H0-H8 commit list;
6. exact changed files grouped by Home zone;
7. design authority files consulted;
8. full test/build results;
9. baseline-vs-final failure comparison;
10. quota/network result;
11. EN/PL result;
12. responsive result;
13. full-page evidence paths;
14. live Alpha smoke results;
15. unresolved OPEN items untouched;
16. any known defects still visible;
17. explicit marker:

`READY FOR PRODUCT OWNER FULL HOME VISUAL REVIEW — ALPHA`

## 14. Definition of done

This assignment is NOT done because one section looks correct.

It is done only when a first-time user can open the Alpha Home on desktop or phone and experience the approved Beta launch Home as one coherent product from top to bottom, with real/truthful content, usable navigation, correct responsive behaviour and no hidden metered AI execution.

Only then is Home ready for Product Owner visual acceptance.
