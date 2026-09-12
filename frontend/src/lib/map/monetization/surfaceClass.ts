/**
 * PART IV v1.2 R2 §16.4 — SURFACE CLASSIFICATION, AND THE EXCLUSIVITY RULE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SENTENCE THIS MODULE EXISTS TO ENFORCE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * "'Layer over layer' is a functional architecture, NOT PERMISSION TO STACK
 * COMPONENTS ON SCREEN. Two surfaces of the same kind are never open at once."
 *
 * The eight-layer architecture describes how capability is organised. It says
 * nothing about how many things may cover the map, and reading it as permission
 * is exactly how a calm map becomes a stack of panels — which is the failure
 * §16.3 lists as "a sheet opened on top of another sheet".
 *
 * So the classification is not documentation. `openSurface` REFUSES a second
 * surface of the same class and returns the one that stays, which means the
 * rule is enforced by the type system and the reducer rather than by everyone
 * remembering it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FOUR KINDS, AND WHAT DECIDES WHICH
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The container is chosen by the DURATION AND DEPTH of the user's task, never by
 * the layer the capability belongs to (§2.2). That is why the composer and the
 * watchboard share a class despite belonging to different layers, and why the
 * action deck and the upgrade panel share one despite being minutes apart in the
 * flow.
 *
 *   PERSISTENT   always on screen, inside the 82px compact budget.
 *                Top bar · change strip.
 *   TEMPORARY    dismisses to the previous state, LOSING NOTHING.
 *                PEEK · HALF · watch block · analysis cost prompt · upgrade panel.
 *   REPLACEMENT  takes over the sheet or the rail and RESTORES WHAT IT REPLACED
 *                on close. Watch composer/activation · watchboard · timeline.
 *   WORKSPACE    full transition; the map becomes a return path.
 *                Analysis results · comparisons · portfolios · exports.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PERSISTENT IS EXEMPT, AND R2 IS WHAT EXEMPTS IT — NOT A LOCAL READING
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The exemption is not an interpretation of the rule; it is written into the
 * rule. Three passages, all §16:
 *
 *   §16.4  "PERSISTENT   ALWAYS ON SCREEN, inside the 82px budget.
 *                        Top bar · change strip."
 *
 *          The class is DEFINED as always on screen, and it is defined with
 *          exactly TWO members, named. A class R2 populates with two surfaces
 *          cannot also forbid two of them.
 *
 *   §16.4  "Two surfaces of the same kind are never OPEN at once."
 *
 *          The verb is the distinction. A PERSISTENT surface is never opened or
 *          closed — it is not a thing that opens — so the sentence does not
 *          reach it. TEMPORARY, REPLACEMENT and WORKSPACE all open, and all
 *          three are held to one at a time.
 *
 *   §16.2  "TOP BAR 52px · CHANGE STRIP 30px · TOTAL 82px HARD CAP"
 *
 *          A budget that SUMS two surfaces requires both to be present at the
 *          same moment. If they alternated, the cap would be 52.
 *
 * So the two PERSISTENT surfaces are THE TOP BAR and THE CHANGE STRIP, and both
 * are on screen in every one of the nine compact states by R2's own design.
 *
 * THE TYPE ENFORCES THIS RATHER THAN A COMMENT. `OpenSurfaces` is keyed by
 * `Exclude<SurfaceClass, 'PERSISTENT'>`, so a PERSISTENT surface is not
 * REPRESENTABLE as open — it cannot be counted toward exclusivity even by
 * mistake, and `openSurface` returns the state untouched if one is passed.
 *
 * A live count of DOM nodes carrying `data-gn-surface-class` will therefore
 * report `{PERSISTENT: 2}` in every state. That is the budget being satisfied,
 * not exclusivity being broken; the two are different measurements.
 */

export type SurfaceClass = 'PERSISTENT' | 'TEMPORARY' | 'REPLACEMENT' | 'WORKSPACE';

/**
 * Every monetization surface, and the class R2 assigns it.
 *
 * GOVERNANCE, CORRECTED. An earlier cut of this file cited a "§14 implementation
 * matrix". There is no such section: §14 is COLLISIONS WITH APPROVED MAP
 * INTELLIGENCE BEHAVIOUR, and the matrix lives at §16A with the classification
 * itself at §16.4. Binding authority is §14, §18, §19 and then R2 prose, and the
 * values below are read from §16.4 and §16A accordingly.
 *
 * The substance is unchanged by that correction — two entries still correct an
 * earlier reading of mine: the activation surface is TEMPORARY rather than
 * sustained, and the action deck is TEMPORARY rather than a fixture.
 */
export const SURFACE_CLASS = {
  /* PERSISTENT — inside the compact budget, never dismissed. */
  topBar: 'PERSISTENT',
  changeStrip: 'PERSISTENT',

  /* TEMPORARY — dismisses to the previous state, losing nothing. */
  actionDeck: 'TEMPORARY',
  analysisCostPrompt: 'TEMPORARY',
  activation: 'TEMPORARY',

  /* REPLACEMENT — takes over, and restores what it replaced. */
  watchComposer: 'REPLACEMENT',
  watchboard: 'REPLACEMENT',
  assessmentTimeline: 'REPLACEMENT',

  /* WORKSPACE — full transition; the map becomes a return path. */
  analysisWorkspace: 'WORKSPACE',
} as const satisfies Readonly<Record<string, SurfaceClass>>;

export type SurfaceId = keyof typeof SURFACE_CLASS;

/**
 * What is open right now, at most one per exclusive class.
 *
 * PERSISTENT surfaces are absent from this map entirely — they are not "open",
 * they simply are, and modelling them as openable would invite something to
 * close the change strip.
 */
export type OpenSurfaces = Readonly<Partial<Record<Exclude<SurfaceClass, 'PERSISTENT'>, SurfaceId>>>;

export const NO_SURFACES: OpenSurfaces = {};

export function classOf(surface: SurfaceId): SurfaceClass {
  return SURFACE_CLASS[surface];
}

/**
 * Open a surface, closing whatever else of its class was open.
 *
 * THE REPLACEMENT IS SILENT AND DELIBERATE. Opening the watchboard while the
 * composer is open closes the composer, because both are REPLACEMENT and the
 * alternative is a sheet on a sheet. It does not stack, and it does not refuse
 * the user's action either — refusing would leave them pressing a control that
 * appears to do nothing.
 *
 * A PERSISTENT surface can never be passed here: the type of `SurfaceId` allows
 * it, so the guard is explicit and returns the state untouched rather than
 * silently recording a top bar as "open".
 */
export function openSurface(open: OpenSurfaces, surface: SurfaceId): OpenSurfaces {
  const kind = classOf(surface);

  if (kind === 'PERSISTENT') return open;

  return { ...open, [kind]: surface };
}

/** Close one surface by id. A no-op if it was not the one open in its class. */
export function closeSurface(open: OpenSurfaces, surface: SurfaceId): OpenSurfaces {
  const kind = classOf(surface);

  if (kind === 'PERSISTENT' || open[kind] !== surface) return open;

  const next = { ...open };

  delete next[kind];

  return next;
}

/** Close every surface of one class — how a WORKSPACE returns to the map. */
export function closeClass(open: OpenSurfaces, kind: Exclude<SurfaceClass, 'PERSISTENT'>): OpenSurfaces {
  const next = { ...open };

  delete next[kind];

  return next;
}

export function isOpen(open: OpenSurfaces, surface: SurfaceId): boolean {
  const kind = classOf(surface);

  return kind !== 'PERSISTENT' && open[kind] === surface;
}

/**
 * THE INVARIANT, CHECKABLE AT RUNTIME AND IN TESTS.
 *
 * `OpenSurfaces` is keyed BY CLASS, so two surfaces of one class are
 * unrepresentable rather than merely forbidden — this function can only fail if
 * a value was built by hand rather than through `openSurface`, which is exactly
 * the case worth catching.
 */
export function exclusivityHolds(open: OpenSurfaces): boolean {
  return Object.entries(open).every(([kind, surface]) => classOf(surface as SurfaceId) === kind);
}

/**
 * The two surfaces R2 §16.4 names as PERSISTENT, in budget order.
 *
 * Exported so the guard can assert the class has exactly these members rather
 * than trusting the comment above, and so a third permanent surface cannot be
 * introduced without a test failing and a citation being required for it.
 */
export const PERSISTENT_SURFACES: readonly SurfaceId[] = ['topBar', 'changeStrip'];
