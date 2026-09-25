# BETA DESIGN AUTHORITY R5.1

Status: PRODUCT OWNER APPROVED
Applies to: GlobalNewsAI Beta Launch convergence
Target: public Beta launch
Engineering base at time of registration: 00f974dcc60186121110561b07da20f65e777950
Production: HOLD until explicit Product Owner authorization.

## 1. Approved design packages

The Product Owner has approved the following R5.1 design ZIPs located on the local development machine at:

`D:\Desktop\GlobalNewsAI\Claude_Output`

### Desktop / tablet
Filename:
`R1 review ZIPs and navigation conflicts THIS.zip`

SHA256:
`a90954d1871293a202e9767cd12b3429b7dfda34099b7b354db22c6c3aa2c9bb`

### Phone
Filename:
`R1 review ZIPs and navigation conflicts THAT.zip`

SHA256:
`85ecda572b1f64bb7e60beb1bf7451883578c1f8ca2b44b5989f090c6c6362be`

Claude Code MUST verify these exact SHA256 values before reading or implementing from the packages. A mismatch is STOP and report.

## 2. Required package reading before code changes

Read the approved R5.1 package material before editing implementation source, including:

- README
- NAVIGATION
- SPEC
- HOME_R4.1_DELTA
- INTELLIGENCE_MODULE_MATRIX
- COMPONENTS_AND_TOKENS
- authority register

Use the R5.1 Home copy as the approved appearance authority for:
- Home / Beta Launch appearance;
- corrected module cards;
- category title colours.

Keep the bundled byte-identical R4.1 Home as the comparison baseline. R4.1 is not the implementation target where R5.1 explicitly changes it; it exists to make the R5.1 delta measurable.

## 3. Scope of visual authority

The R5.1 packages now supersede stale source-text / byte / SHA presentation freezes wherever those freezes conflict with the Product Owner-approved R5.1 Beta visual authority.

This visual supersession does NOT waive:
- evidence/provenance correctness;
- source rights;
- data semantics;
- security;
- quota controls;
- EN/PL integrity;
- route truthfulness;
- no-fabrication rules;
- Product Owner visual acceptance.

Obsolete byte/source pins must be replaced, when touched, with behavioural and rendered visual gates that protect the approved R5.1 result instead of preserving stale source text.

## 4. Implementation rules

Implement approved visuals against the actual Beta branch and actual governed data.

Do not:
- redesign beyond the R5.1 authority;
- invent answers for OPEN decisions;
- ship illustrative headlines as live content;
- ship illustrative/sample map marks as live evidence;
- ship sample credit amounts;
- ship prototype geography as production geography;
- ship prototype renderer code as live product;
- introduce provider-on-open or AI-on-browse behaviour;
- collapse Follow and Watch into one control;
- activate Watch;
- deploy Production;
- bind globalnewsai.live during implementation.

Ordinary browsing, category selection, navigation, filters and reading stored observations MUST NOT start metered AI.

## 5. Navigation and Ask boundaries

Preserve the four current navigation destinations unless and until the Product Owner explicitly approves a navigation change from an OPEN decision in the design package.

Preserve:
- `/ask` as the Ask draft / conversational entry;
- `/search` as the explicit analysis / research workspace.

Do not silently merge or redirect one into the other merely to simplify the shell.

## 6. OPEN decisions remain OPEN

Anything marked OPEN in the R5.1 package is not engineering discretion.

Especially keep open until an explicit ruling:
- navigation changes;
- Ask PEEK and alert-aware states;
- D1 map golden-frame parity.

A screenshot is not authority for an OPEN decision.

If implementation cannot proceed without resolving an OPEN item:
STOP that item, identify the exact authority conflict, and continue only with independent approved work.

## 7. First implementation gate

The first R5.1 implementation task is Gate A only:

1. Home / Beta Launch desktop/tablet.
2. Home / Beta Launch phone.
3. Shared header/navigation.
4. Footer.
5. Mobile navigation.
6. Module cards and their approved states/destinations.
7. Search / Ask entry presentation on Home.
8. Responsive behaviour at:
   - desktop >=1440;
   - 430x932;
   - 390x844;
   - 360x800.
9. EN and PL.
10. Real live/governed Home data path only.

Do NOT start specialist dashboard visual rewrites in the same task.

## 8. Gate A evidence required

Before CTO review, return:

- exact ZIP SHA verification output;
- exact R5.1 documents read;
- explicit R4.1 -> R5.1 implementation delta list;
- exact files/components changed;
- any stale visual pins removed/replaced and why;
- frontend tests relevant to changed code;
- build result;
- quota/network checks proving ordinary Home browsing starts no metered AI;
- route checks preserving `/ask` vs `/search`;
- EN checks;
- PL checks;
- desktop before/after capture;
- 430 phone capture;
- 390 phone before/after capture;
- 360 phone capture;
- interaction checks for Home cards/navigation;
- list of all OPEN items encountered, unchanged;
- any authority conflict.

No deploy.

## 9. Review sequence after Gate A

Gate A implementation -> CTO Git review -> local/browser visual evidence review -> Product Owner visual review -> only then Alpha deployment may be separately authorized.

After Gate A Product Owner PASS, Conflict is the next specialist convergence module.

## 10. Definition of Gate A done

A first-time user opening the Beta Home must immediately see a polished, readable, modern GlobalNewsAI product on both desktop and phone, understand the major actions and module choices, and be able to navigate only to intentional destinations without triggering hidden AI compute.

Passing source tests alone is not visual acceptance.
