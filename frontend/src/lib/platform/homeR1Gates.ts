/**
 * ════════════════════════════════════════════════════════════════════════════
 * HOME, DISCUSSIONS, ALERTS & PAID R1 · STAGE A — THE FRONTEND RELEASE GATES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * GATE-MAPPING PRECHECK (CTO contract §3). Every logical gate of the FINAL Design was mapped
 * onto the runtime before anything was created; the full table is in the Stage A report.
 * The rule applied: a PURE VISUAL / PRESENTATION gate is a server-read release gate (exactly
 * the mechanism `GNA_PUBLIC_ROOT` already uses), never a two-key spend kill switch. Spend
 * stays behind the existing switches, which are untouched:
 *
 *   ASK_V2_ENABLED · ASK_R2_ENABLED · ASK_PUBLIC_COMPUTE_ENABLED · ASK_GUEST_TRIAL_ENABLED
 *
 * Server-only (never NEXT_PUBLIC_): read per request by the root page and the root layout,
 * like `standaloneAskRoot`. ON is the exact literal 'true' (the switches' KS-6 rule — 'TRUE',
 * '1', ' true' are OFF). Unset ⇒ OFF ⇒ the Rev A Home and the legacy dock transport, byte for
 * byte. Gate OFF never deletes anything: nothing these gates show writes durable data.
 *
 *   GNA_HOME_R1             home.lightPrimary — the light-primary platform Home (only ever
 *                           reachable at `/` when GNA_PUBLIC_ROOT=platform; that default is
 *                           NOT changed here and is never changed by engineering)
 *   GNA_HOME_CARD_ACTIONS   home.cardActions — the story action row; requires GNA_HOME_R1.
 *                           Turning it on also ends story auto-advance (Design R1-P5).
 *   GNA_COMPARE_TRAY        compare.tray — hold stories (0 AI); requires card actions
 *   GNA_COMPARE_VIEW        compare.view — the zero-AI Compare view; requires the tray, and
 *                           its read model is the backend's COMPARE_READ_ENABLED route
 *   GNA_ASK_EMBEDDED        ask.embedded — the dock's ONE transport becomes Ask R2/V2. OFF
 *                           returns the dock to its legacy transport (the rollback, H §3)
 *   GNA_ASK_CONTEXT_REFS    ask.contextEnvelope — the dock / Compare / My Intelligence send
 *                           governed references; requires GNA_ASK_EMBEDDED. The backend
 *                           applies them only under ASK_CONTEXT_REFS_ENABLED.
 *
 * NOT CREATED IN STAGE A, and stated so the absence stays visible: discussion.read,
 * discussion.write, alerts.inApp (schema-dependent — Stage B), alerts.delivery (no delivery
 * capability exists; declared off), deep.entitlement (reads NEXT_PUBLIC_GN_ENTITLEMENT — no
 * new switch), billing.checkout (not authorised; declared off).
 */

export interface HomeR1Gates {
  readonly homeR1: boolean;
  readonly cardActions: boolean;
  readonly compareTray: boolean;
  readonly compareView: boolean;
  readonly askEmbedded: boolean;
  readonly askContextRefs: boolean;
}

/** The gates that exist only as declared-OFF facts in Stage A. Never read from the environment. */
export const STAGE_A_UNAVAILABLE = {
  discussionRead: false,
  discussionWrite: false,
  alertsInApp: false,
  alertsDelivery: false,
  billingCheckout: false,
} as const;

export const HOME_R1_GATES_OFF: HomeR1Gates = Object.freeze({
  homeR1: false,
  cardActions: false,
  compareTray: false,
  compareView: false,
  askEmbedded: false,
  askContextRefs: false,
});

/**
 * The one way the gates reach client islands: a `<meta>` the root layout emits through its
 * metadata ONLY when some gate is on (so the gate-OFF document is byte-identical). Its
 * content is the comma-separated names of the gates that are ON — names, never values.
 */
export const RELEASE_GATES_META_NAME = 'gna-release-gates';
const GATE_NAMES: readonly (keyof HomeR1Gates)[] = [
  'homeR1',
  'cardActions',
  'compareTray',
  'compareView',
  'askEmbedded',
  'askContextRefs',
];

export function releaseGatesMeta(gates: HomeR1Gates): Record<string, string> | null {
  const on = GATE_NAMES.filter((name) => gates[name]);
  return on.length === 0 ? null : { [RELEASE_GATES_META_NAME]: on.join(',') };
}

export function parseReleaseGatesMeta(content: string | null): HomeR1Gates {
  if (content === null || content.length === 0) return HOME_R1_GATES_OFF;
  const on = new Set(content.split(','));
  const flag = (name: keyof HomeR1Gates): boolean => on.has(name);
  /* The dependency order is re-applied, so a hand-edited document cannot skip a precondition. */
  const homeR1 = flag('homeR1');
  const cardActions = homeR1 && flag('cardActions');
  const compareTray = cardActions && flag('compareTray');
  const askEmbedded = flag('askEmbedded');
  return {
    homeR1,
    cardActions,
    compareTray,
    compareView: compareTray && flag('compareView'),
    askEmbedded,
    askContextRefs: askEmbedded && flag('askContextRefs'),
  };
}

export function homeR1Gates(
  env: Readonly<Record<string, string | undefined>> = process.env,
): HomeR1Gates {
  const on = (name: string): boolean => env[name] === 'true';
  const homeR1 = on('GNA_HOME_R1');
  const cardActions = homeR1 && on('GNA_HOME_CARD_ACTIONS');
  const compareTray = cardActions && on('GNA_COMPARE_TRAY');
  const compareView = compareTray && on('GNA_COMPARE_VIEW');
  const askEmbedded = on('GNA_ASK_EMBEDDED');
  const askContextRefs = askEmbedded && on('GNA_ASK_CONTEXT_REFS');
  return { homeR1, cardActions, compareTray, compareView, askEmbedded, askContextRefs };
}
