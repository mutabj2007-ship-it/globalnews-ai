import {
  isAtLeastAsExpensive,
  requiresConfirmationFor,
  type ComputeClass,
  type ComputeOperationKind,
} from '@globalnews-ai/shared';

/**
 * BETA-SIMPLE-ASK-SAND-1 §5 — the authoritative compute classifier.
 *
 * §5: "The authoritative compute class is determined server-side, never
 * merely by which frontend button was clicked."
 * §20: "A clever prompt must not bypass compute classification. The
 * backend determines that a request qualifies as Deep Analysis even if
 * entered through ordinary Ask."
 *
 * Those two sentences are the entire design brief for this file, and
 * they rule out two tempting shortcuts:
 *
 *   - Trusting a `computeClass` field sent by the client. There is no
 *     such field in ComputeClassificationInput, deliberately. The
 *     closest thing, `explicitDeepAnalysisRequest`, can only ever RAISE
 *     the class (a user asking for Deep Analysis gets Deep Analysis);
 *     it can never lower it.
 *   - Asking a model to classify the request. That would spend AI
 *     quota to decide whether to spend AI quota, which defeats the
 *     cost-control purpose §31 states ("Ask works WITHOUT burning AI
 *     quota unnecessarily"). This classifier is deterministic and free.
 *
 * It is a pure function over a plain input struct — no injected
 * services, no I/O, no clock — so every rule below is directly
 * testable and the same input always yields the same class.
 */

/**
 * Distinct geographies at or above which a request is genuinely
 * multi-country work rather than an ordinary bounded question.
 *
 * Two countries is a comparison ("Rwanda vs Uganda") and remains
 * FRESH_BOUNDED — the existing retrieval path already handles a
 * relational two-country question, and charging for it would violate
 * §7's "Sand is not a charge for reading". Three or more means
 * retrieval fans out per country and the cost genuinely scales.
 */
export const DEEP_ANALYSIS_COUNTRY_THRESHOLD = 3;

/**
 * Distinct analytical domains (economy / energy / security /
 * humanitarian / politics …) at or above which a request is
 * cross-domain synthesis.
 */
export const DEEP_ANALYSIS_DOMAIN_THRESHOLD = 3;

/**
 * Requested history, in days, at or above which a request is
 * historical rather than current-developments work.
 *
 * 180 days, not 30: the product's ordinary "what's happening" window is
 * measured in days-to-weeks, and Professional's longer history (§19) is
 * explicitly NOT a Sand product. Only genuine long-range historical
 * synthesis should cross into DEEP_ANALYSIS.
 */
export const DEEP_ANALYSIS_TIME_WINDOW_DAYS = 180;

/** Combined-signal rule: this many independent expansion signals also means Deep Analysis. */
export const DEEP_ANALYSIS_COMBINED_SIGNAL_THRESHOLD = 2;

/**
 * The deterministic signals classification runs on.
 *
 * Every field is computed by the caller from the REQUEST and from
 * RETRIEVAL PLANNING — never from a client-supplied class. See
 * ComputeClassificationService, which is the only production caller.
 */
export interface ComputeClassificationInput {
  kind: ComputeOperationKind;

  /**
   * §6 — an adequate stored result already exists for this exact
   * StoredResultIdentity. Dominates every other signal.
   */
  storedResultAvailable: boolean;

  /**
   * True when the request can be satisfied entirely from stored
   * structured intelligence, with no fresh retrieval and no model call
   * (§5 CONTEXTUAL: "explanation mainly from stored structured
   * intelligence").
   */
  contextualOnly: boolean;

  /** Distinct geographies the request resolves to. */
  countryCount: number;

  /** Distinct analytical domains the request spans. */
  domainCount: number;

  /** Requested history in days, when the request bounds one. */
  requestedTimeWindowDays?: number;

  /**
   * The user explicitly asked for deep analysis (e.g. pressed the Deep
   * Analysis action). RAISES the class; never lowers it — see §20.
   */
  explicitDeepAnalysisRequest?: boolean;

  /** The user explicitly asked for a full report/export-scale synthesis. */
  explicitReportRequest?: boolean;
}

export interface ComputeClassification {
  computeClass: ComputeClass;
  requiresConfirmation: boolean;
  /**
   * Why. Ordered most-decisive first. Surfaced in Admin telemetry and
   * available to a UI tooltip. Never contains prompt text, user
   * content or provider output — only rule names and the numbers that
   * tripped them, so it is always safe to log.
   */
  rationale: readonly string[];
}

/**
 * The floor a request can never be classified below.
 *
 * §16 is the reason this exists: "A click on Economy or Energy or
 * Security must not automatically trigger expensive new synthesis."
 * A category-view operation is therefore capped, not merely expected,
 * to stay at CONTEXTUAL — see classifyCompute's own cap below.
 */
function baselineClassFor(kind: ComputeOperationKind): ComputeClass {
  switch (kind) {
    case 'category-view':
      return 'CONTEXTUAL';
    case 'research-report':
      return 'RESEARCH_REPORT';
    case 'deep-analysis':
      return 'DEEP_ANALYSIS';
    case 'ask-turn':
      return 'FRESH_BOUNDED';
  }
}

/**
 * §16 — the hard ceiling for a category view.
 *
 * Returning a ceiling rather than just a baseline matters: without it,
 * a `category-view` for a request that happens to span five countries
 * would classify DEEP_ANALYSIS and start charging for what §16 says
 * must be a plain stored-intelligence render. The cap makes the
 * "category click never auto-runs AI" rule structural rather than
 * merely likely.
 */
function ceilingFor(kind: ComputeOperationKind): ComputeClass | undefined {
  return kind === 'category-view' ? 'CONTEXTUAL' : undefined;
}

/**
 * Classifies one operation. Pure, deterministic, free.
 *
 * Precedence, highest first:
 *   1. Stored result exists            → STORED (§6)
 *   2. Kind ceiling                    → capped (§16)
 *   3. Explicit report request         → RESEARCH_REPORT
 *   4. Contextual-only                 → CONTEXTUAL (§5)
 *   5. Expansion signals / explicit    → DEEP_ANALYSIS (§20)
 *   6. Otherwise                       → the kind's baseline
 */
export function classifyCompute(input: ComputeClassificationInput): ComputeClassification {
  const rationale: string[] = [];

  // 1. §6 — stored-result-first dominates everything. Replaying a
  //    stored answer costs no new AI, whatever the question looked
  //    like, so no later rule may raise it.
  if (input.storedResultAvailable) {
    return {
      computeClass: 'STORED',
      requiresConfirmation: false,
      rationale: ['stored-result-available'],
    };
  }

  const ceiling = ceilingFor(input.kind);

  // 2. §16 — a category view is capped before any expansion signal is
  //    even considered, so a broad category can never auto-escalate
  //    into paid synthesis.
  if (ceiling) {
    rationale.push(`kind-ceiling:${input.kind}:${ceiling}`);
    return {
      computeClass: ceiling,
      requiresConfirmation: requiresConfirmationFor(ceiling),
      rationale,
    };
  }

  // 3. A report is the largest workload in the model and outranks the
  //    per-signal rules below.
  if (input.explicitReportRequest || input.kind === 'research-report') {
    rationale.push(
      input.explicitReportRequest ? 'explicit-report-request' : 'kind:research-report',
    );
    return {
      computeClass: 'RESEARCH_REPORT',
      requiresConfirmation: requiresConfirmationFor('RESEARCH_REPORT'),
      rationale,
    };
  }

  // 4. §5 CONTEXTUAL — answerable from stored structured intelligence.
  //    Checked before the expansion rules because a contextual answer
  //    performs no retrieval at all, so a high country count describes
  //    what is ALREADY STORED, not work about to be done.
  if (input.contextualOnly) {
    return {
      computeClass: 'CONTEXTUAL',
      requiresConfirmation: false,
      rationale: ['contextual-only:no-fresh-retrieval'],
    };
  }

  // 5. §20 — expansion signals. Each is independent and any one of the
  //    first three is sufficient on its own.
  const multiCountry = input.countryCount >= DEEP_ANALYSIS_COUNTRY_THRESHOLD;
  const crossDomain = input.domainCount >= DEEP_ANALYSIS_DOMAIN_THRESHOLD;
  const historical =
    (input.requestedTimeWindowDays ?? 0) >= DEEP_ANALYSIS_TIME_WINDOW_DAYS;

  if (multiCountry) rationale.push(`multi-country:${input.countryCount}`);
  if (crossDomain) rationale.push(`cross-domain:${input.domainCount}`);
  if (historical) rationale.push(`historical-window-days:${input.requestedTimeWindowDays}`);

  /**
   * The combined-signal rule catches the case §20 is really worried
   * about: a request that trips no single threshold but is plainly
   * expansive — e.g. two countries AND two domains AND a 90-day
   * window. Each of those is individually ordinary; together they are
   * not. Signals are counted at a lower "soft" bar (one below each
   * hard threshold) precisely so this rule has something to combine.
   */
  const softSignals = [
    input.countryCount >= DEEP_ANALYSIS_COUNTRY_THRESHOLD - 1,
    input.domainCount >= DEEP_ANALYSIS_DOMAIN_THRESHOLD - 1,
    (input.requestedTimeWindowDays ?? 0) >= DEEP_ANALYSIS_TIME_WINDOW_DAYS / 2,
  ].filter(Boolean).length;

  const combined = softSignals >= DEEP_ANALYSIS_COMBINED_SIGNAL_THRESHOLD;
  if (combined && !multiCountry && !crossDomain && !historical) {
    rationale.push(`combined-expansion-signals:${softSignals}`);
  }

  if (input.explicitDeepAnalysisRequest) {
    rationale.push('explicit-deep-analysis-request');
  }

  const isDeep =
    multiCountry ||
    crossDomain ||
    historical ||
    combined ||
    input.explicitDeepAnalysisRequest === true ||
    input.kind === 'deep-analysis';

  if (isDeep) {
    if (input.kind === 'deep-analysis' && rationale.length === 0) {
      rationale.push('kind:deep-analysis');
    }
    return {
      computeClass: 'DEEP_ANALYSIS',
      requiresConfirmation: requiresConfirmationFor('DEEP_ANALYSIS'),
      rationale,
    };
  }

  // 6. Ordinary bounded work.
  const baseline = baselineClassFor(input.kind);
  rationale.push(`baseline:${input.kind}`);
  return {
    computeClass: baseline,
    requiresConfirmation: requiresConfirmationFor(baseline),
    rationale,
  };
}

/**
 * §5 — "never downgrade below what retrieval actually required."
 *
 * Classification happens BEFORE execution, from planning signals. If
 * execution then turns out to have been more expensive than planned
 * (retrieval fanned out further than expected), the recorded class
 * must reflect what really happened, or §14's cost baseline is built
 * on a lie. This only ever raises.
 *
 * It is NOT used to re-price the user: the quote they confirmed stands
 * (§9). It corrects the telemetry and the ledger's recorded class.
 */
export function reconcileClassAfterExecution(
  quoted: ComputeClass,
  observed: ComputeClass,
): ComputeClass {
  return isAtLeastAsExpensive(observed, quoted) ? observed : quoted;
}
