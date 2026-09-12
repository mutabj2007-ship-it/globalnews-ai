/**
 * PART IV §7 — CHANGE INTELLIGENCE. SEVEN STATES, CLOSED TO EXTENSION.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE SET IS CLOSED, AND WHY THAT MATTERS MORE THAN IT LOOKS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * §17: "A user's watches across all surfaces appear in ONE list... This is the
 * strongest institutional argument the product has, and IT WORKS ONLY IF the
 * change-state vocabulary is genuinely shared — which is why the seven states
 * are fixed here and closed to extension."
 *
 * An eighth state added on the map would be an eighth state the Economy, Market
 * and Conflict surfaces do not have, and the single watchboard stops being
 * single. The union below is therefore exhaustive by design, and a guard asserts
 * it has exactly seven members.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO HUES, AND ONE STATE THAT DELIBERATELY HAS NONE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Magnitude is carried by WEIGHT AND MOTION, not by more hues — cyan for what
 * is new, amber for what warrants a look, and the neutral ladder for the rest.
 *
 * DISPUTED IS HUELESS ON PURPOSE. Given red it would read as severity; given
 * amber it would read as change magnitude; given the provenance dashed stroke it
 * would be confused with CONTESTED-SOURCE, which is a statement about how a
 * LOCATION was reached, not about whether an assessment is agreed. A hatch field
 * belongs to neither vocabulary and cannot be misread as either.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NO MATERIAL CHANGE IS A RESULT, NOT AN ABSENCE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * §6.4.4 is blunt about it: "It must NEVER be styled as an empty state. This
 * line is what the user is paying for." A watch that ran and found nothing did
 * the work; rendering it as emptiness would say the opposite.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DERIVATION STATE IS NOT DISPLAY STATE — G'S AUDIT, AND THE LINE IT DRAWS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * G's backend audit established a distinction this module must hold: the states
 * a derivation PASSES THROUGH are not the states a reader SEES.
 *
 * A derivation can honestly conclude `NO_BASELINE` — there is nothing to compare
 * against yet — or `EVIDENCE_UNAVAILABLE` — the provider did not answer. Those
 * are true, useful, and they are facts about the PIPELINE. None of them is one
 * of the seven, and rendering one as a chip or a ring would tell a reader
 * something about the WORLD that the product never concluded.
 *
 * "NO_BASELINE" drawn as a mark reads as a change state. It is not one. It means
 * the question has not been asked yet, which is exactly the thing a monitoring
 * product must not blur.
 *
 * SO: the seven below are the DISPLAY vocabulary and are closed. A derivation
 * result that is not one of them yields NO MARK AT ALL — `displayableChangeState`
 * returns `null`, and every renderer treats `null` as "draw nothing" rather than
 * as a state to substitute for. There is no default and no fallback chip.
 */

export type ChangeState =
  | 'NEW'
  | 'NEW_EVIDENCE'
  | 'SIGNIFICANT_CHANGE'
  | 'DEVELOPING'
  | 'DISPUTED'
  | 'STABLE'
  | 'NO_MATERIAL_CHANGE';

/** Exhaustive, ordered by the specification's own table. */
export const CHANGE_STATES: readonly ChangeState[] = [
  'NEW',
  'NEW_EVIDENCE',
  'SIGNIFICANT_CHANGE',
  'DEVELOPING',
  'DISPUTED',
  'STABLE',
  'NO_MATERIAL_CHANGE',
];

/** The rail / story-card / watchboard chip forms, from §7. */
export const CHANGE_CHIP: Readonly<Record<ChangeState, string>> = {
  NEW: 'NEW',
  NEW_EVIDENCE: '+EV',
  SIGNIFICANT_CHANGE: 'SIG',
  DEVELOPING: 'DEV',
  DISPUTED: 'DISP',
  STABLE: 'STBL',
  NO_MATERIAL_CHANGE: 'NMC',
};

/**
 * The hue family each state may use — and `NONE` is a real value, not a gap.
 *
 * Kept as a token name rather than a class string so a surface cannot quietly
 * paint DISPUTED by reaching for a colour: there is no colour here to reach for.
 */
export type ChangeHue = 'CYAN' | 'AMBER' | 'NEUTRAL' | 'NONE';

export const CHANGE_HUE: Readonly<Record<ChangeState, ChangeHue>> = {
  NEW: 'CYAN',
  NEW_EVIDENCE: 'CYAN',
  SIGNIFICANT_CHANGE: 'AMBER',
  DEVELOPING: 'AMBER',
  /* Hueless, deliberately — see this file's own note. */
  DISPUTED: 'NONE',
  STABLE: 'NEUTRAL',
  NO_MATERIAL_CHANGE: 'NEUTRAL',
};

/** Which states fire a material alert at the default sensitivity (§8.1). */
export const FIRES_MATERIAL_ALERT: Readonly<Record<ChangeState, boolean>> = {
  NEW: false,
  NEW_EVIDENCE: false,
  SIGNIFICANT_CHANGE: true,
  /* §7: held; alerts on resolve or escalation, never on entry. */
  DEVELOPING: false,
  /* §7: no alert unless sensitivity is ALL. */
  DISPUTED: false,
  STABLE: false,
  /* §7: never alerts; appears as a watchboard line. */
  NO_MATERIAL_CHANGE: false,
};

/**
 * The chip's Tailwind classes.
 *
 * MINT IS ABSENT FROM EVERY ENTRY, and that is the point of §14.2: mint means a
 * standing assignment is RUNNING — a fact about the user's account — while these
 * are facts about the world. A change state must never borrow the hue that says
 * "you are watching this", or the two become unreadable in the one place they
 * appear together, which is the watchboard.
 */
export const CHANGE_CHIP_CLASS: Readonly<Record<ChangeState, string>> = {
  NEW: 'border-sp-cyan/45 text-sp-cyan',
  NEW_EVIDENCE: 'border-sp-cyan/30 text-sp-cyan/85 border-dotted',
  SIGNIFICANT_CHANGE: 'border-sp-amber/55 text-sp-amber',
  DEVELOPING: 'border-sp-amber/35 text-sp-amber/85',
  /* A hatch, carried by a repeating-linear-gradient rather than a fill. */
  DISPUTED:
    'border-sp-line-2 text-sp-ink-2 [background-image:repeating-linear-gradient(45deg,rgba(126,166,186,.14)_0_2px,transparent_2px_5px)]',
  STABLE: 'border-sp-line-2 text-[#64798A]',
  /* Reduced presence, NOT an empty state — it proves the work ran. */
  NO_MATERIAL_CHANGE: 'border-sp-line-3 text-[#4A5B67]',
};

/**
 * ── THE GATE BETWEEN THE BACKEND AND THE MARK ─────────────────────────────
 *
 * Anything a derivation produces passes through here before it can be drawn.
 * Only the seven display states survive; everything else — a backend honesty
 * state, an unrecognised value from a newer producer, `undefined` — becomes
 * `null`, and `null` means DRAW NOTHING.
 *
 * It deliberately does not "fall back" to STABLE or to NO MATERIAL CHANGE. Both
 * of those are RESULTS: they say a check ran and reached a conclusion. Using
 * either to stand in for "we could not tell" would manufacture exactly the
 * reassurance a monitoring product has no right to give.
 */
export function displayableChangeState(value: unknown): ChangeState | null {
  return typeof value === 'string' && (CHANGE_STATES as readonly string[]).includes(value)
    ? (value as ChangeState)
    : null;
}

/**
 * Whether a mark may be drawn for this derivation result at all.
 *
 * Two independent conditions, and both must hold: the state must be displayable,
 * and the camera must be at or above the ring threshold. A caller that checks
 * only one of them draws a ring for a pipeline state, or draws rings at world
 * scale — the two failures this function exists to make impossible to write
 * separately.
 */
export function changeMarkFor(value: unknown, zoom: number): ChangeState | null {
  const state = displayableChangeState(value);

  return state !== null && changeRingsVisible(zoom) ? state : null;
}

/**
 * The aggregate the change strip states, from the marks currently in view.
 *
 * §7: "Aggregates the current viewport: '3 SIGNIFICANT · 5 NEW EVIDENCE'."
 * Ordered by the canonical state order so the strip never reorders itself as
 * counts change, which would make a calm line flicker.
 */
export function summariseChange(
  states: readonly unknown[],
): readonly { readonly state: ChangeState; readonly count: number }[] {
  const counts = new Map<ChangeState, number>();

  for (const raw of states) {
    /*
      THE STRIP COUNTS WHAT CAN BE SHOWN, NOT WHAT WAS COMPUTED. A viewport
      holding six subjects with no baseline reads "nothing new", which is
      honest; reading "6 STABLE" would be a claim nobody made.
    */
    const state = displayableChangeState(raw);

    if (state === null) continue;

    counts.set(state, (counts.get(state) ?? 0) + 1);
  }

  return CHANGE_STATES.filter((state) => (counts.get(state) ?? 0) > 0).map((state) => ({
    state,
    count: counts.get(state) ?? 0,
  }));
}

/**
 * §7: "Below zoom 4 the strip carries counts and per-mark change rings are
 * SUPPRESSED ENTIRELY."
 *
 * At world scale a ring per mark is noise on a map whose whole argument is
 * calm, and the marks are smaller than the ring would be. The threshold is
 * named once, here, so the strip and the renderer cannot disagree about it.
 */
export const CHANGE_RING_MIN_ZOOM = 4;

export function changeRingsVisible(zoom: number): boolean {
  return zoom >= CHANGE_RING_MIN_ZOOM;
}
