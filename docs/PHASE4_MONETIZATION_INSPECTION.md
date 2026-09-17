# Phase 4 — Monetization Inspection

**No pricing, paywall, tier or commercial policy is implemented, proposed or
changed by this phase.** It is an inspection. Any commercial decision belongs to
the Product Owner, and nothing here anticipates one.

---

## 1 · What exists

| layer | files | what it is |
| ----- | ----- | ---------- |
| `lib/map/monetization/` | `entitlement.ts`, `watchRuntimeGate.ts`, `watchModel.ts`, `watchCtaLadder.ts`, `changeStates.ts`, `surfaceClass.ts` | the model and the gates |
| `components/map/shell/monetization/` | `ActivationPanel`, `AnalysisCostPrompt`, `WatchComposer`, `Watchboard`, `WatchCta`, `ActionDeck`, `RailDrawer`, `ChangeStrip`, `AssessmentTimeline`, `AnalysisWorkspace` | the surfaces |
| admin | `PaymentsScreen`, Subscriptions analytics tab | operator-facing views |

**There is no backend payments module**, no billing integration and no payment
provider anywhere in the product.

---

## 2 · The two gates, and why each is shaped as it is

### `entitlementConfig()` — returns `null` until someone configures it

```ts
export function entitlementConfig(): EntitlementConfig | null
```

Read from `NEXT_PUBLIC_GN_ENTITLEMENT` as JSON. **There is no default, no
fallback figure and no "assume free tier"** — the module says so directly, and
names why: those are *"the same invention wearing a different name."*

Two properties make this safe rather than merely empty:

- **`null` is a first-class answer**, deliberately not an object of zeros. Zero
  watches and *no watches configured* are different claims, and a surface has to
  be able to tell them apart to say something true.
- **Every field or none.** A half-configured entitlement would let one surface
  state a cadence while another could not state a limit, and a reader would have
  no way to tell which numbers were real. A malformed value yields `null`, never
  a partially-invented state.

So the product **cannot state a commercial figure it was not given**. That is a
structural property, not a discipline.

### `WATCH_RUNTIME_ACTIVE = false` — a constant, not an environment variable

Watch surfaces exist over a runtime that does not: `backend/src/modules/watch`
has no module registration, and `app.module.ts` states *"nothing here reaches
Watch: no WatchModule, no scheduler, no route."*

The gate **hides and deletes nothing** — the composer, watchboard, CTA ladder and
rail block all still compile and are still tested; only their mount sites consult
the flag.

It is a constant on purpose, and the reason is worth preserving: *"An environment
variable would imply an operator may turn Watch on, and turning this on without a
backend would produce precisely the fake activation the ruling forbids."*

**Follow is explicitly not folded into this.** Follow is real, persistent and
authenticated; `FollowsModule` is registered and serves routes. Follow state is
never relabelled as Watch.

---

## 3 · What the surfaces are allowed to say

| surface | states | does NOT state |
| ------- | ------ | -------------- |
| `AnalysisCostPrompt` | the action's cost **in actions**, and the allowance when one is configured | any currency amount; any price |
| `ActivationPanel` | capability state, and a sign-in affordance when signed out | any purchase path |
| mode chips (`TIER_RESTRICTED`) | *"Not included in your access"* | what the access costs, or how to change it |

`TIER_RESTRICTED` is the sharpest case: Checkpoint E-1 introduced it as one of
five honest unavailability reasons, and its own test asserts that it **names no
price**. That test is the guard against the most likely drift — a reason label
quietly becoming an upsell.

---

## 4 · Measured absences

Confirmed absent from the entire product (frontend and backend source):

- any currency symbol or amount in a monetization surface
- `stripe`, `checkout`, `billing`, `paywall` as implementation
- a subscribe or upgrade call to action
- a backend payments module or route
- a hard-coded tier, plan or quota

The admin Payments and Subscriptions screens are **operator views over a
requirement**, not a commercial implementation.

---

## 5 · Findings

**No defect found, and nothing to correct.** The monetization layer is in the
state the standing ruling requires: capability gates that fail to an honest
state, no invented figures, and no commercial policy encoded anywhere.

Two properties are worth keeping deliberately, because they would be easy to
erode by accident:

1. **`entitlementConfig()` must keep returning `null` rather than a default.**
   The first "sensible default" added here is the moment the product starts
   asserting commercial facts nobody approved.
2. **`WATCH_RUNTIME_ACTIVE` must stay a source constant.** Making it an
   environment variable would hand an operator the ability to produce fake
   activation, which is the specific thing the PO ruling forbids.

Both are now asserted by `phase4-monetization.spec.ts`, so erosion fails a test
rather than shipping.

---

## 6 · For the Product Owner, when economics are decided

The shape is already there and needs no redesign:

- one function, `entitlementConfig()`, supplies every figure;
- every surface already reads from it and already renders an honest state when
  it returns `null`;
- `EntitlementConfig` declares the fields a policy would need to fill —
  `watches`, `chainLinks`, `historyDays`, `cadenceLabel`, `actionsUsed`,
  `actionsTotal`, `resetsLabel`.

**This document proposes none of those values.** Listing the fields is not
proposing what goes in them.
