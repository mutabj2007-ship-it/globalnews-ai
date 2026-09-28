/**
 * ASK R2 CORE ROUTER — THE TEN CLASSES AS A PROJECTION
 *
 * Main's ruling, restated because it is the easiest thing here to get wrong:
 *
 *   "the ten survive as `AskQuestionClass`, a TOTAL, ORDERED, PURE derivation from
 *    the Envelope. NOTHING ROUTES ON IT. Routing reads orthogonal fields; the class
 *    is what the system *says* it is doing, so a disagreement is a defect a probe can
 *    catch — impossible when the label IS the decision."
 *
 * So this file is a LABEL PRODUCER. `planner.ts` must not branch on its output, and a
 * probe asserts that the planner never reads the class to decide anything.
 *
 * TOTALITY. The derivation is a single ordered list of steps, ONE STEP PER LINE.
 * Main's probe C-2 failed once because a derivation step was written across two lines,
 * and the fix was stated as a requirement: "a rule that must be read across two lines
 * is a rule a later edit can silently break." The last step is unconditional, so the
 * derivation is total by construction.
 */

import type { AskQuestionClass, AskQuestionEnvelope } from './ports.js';
import { isRead } from './envelope.js';

/** Query intents that mean the reader is asking about now, not about a subject. */
const PRESENT_TENSE_INTENTS = new Set([
  'CURRENT_EVENT',
  'ARTICLE_ANCHORED',
  'GEOGRAPHIC_REGIONAL',
  'MULTI_ENTITY',
  'COMPARISON_RESEARCH',
]);

/** True when any axis was not read at all, as opposed to read and found empty. */
export function hasUnreadAxis(e: AskQuestionEnvelope): boolean {
  return !isRead(e.topic.derivation) || !isRead(e.domains.derivation) || !isRead(e.time.derivation);
}

/** True when the reader named a publisher and the source frame did not parse. */
export function hasUnparsedSourceFrame(e: AskQuestionEnvelope): boolean {
  return e.classifiers.sourceAttributed.namedPublisher !== null && !e.classifiers.sourceAttributed.parsed;
}

export function deriveQuestionClass(e: AskQuestionEnvelope): AskQuestionClass {
  if (e.language.classification !== 'CLASSIFIED') return 'CLARIFICATION_REQUIRED';
  if (hasUnreadAxis(e)) return 'CLARIFICATION_REQUIRED';
  if (e.classifiers.queryIntent === 'CLARIFICATION_REQUIRED') return 'CLARIFICATION_REQUIRED';
  if (hasUnparsedSourceFrame(e)) return 'CLARIFICATION_REQUIRED';
  if (e.attachments.count > 0) return 'UPLOADED_DOCUMENT';
  if (e.computation.requested) return 'COMPUTATION';
  if (e.personal.requested) return 'PERSONAL_INTELLIGENCE';
  if (e.official.requested) return 'OFFICIAL_DOCUMENT';
  if (e.domains.domains.length > 0) return 'SPECIALIST_DOMAIN';
  if (e.currentStatus.requested) return 'CURRENT_STATUS_VERIFICATION';
  if (e.time.requirement === 'RECENT') return 'CURRENT_REPORTING';
  if (e.time.requirement === 'EXPLICIT_WINDOW') return 'CURRENT_REPORTING';
  if (e.time.requirement === 'AS_OF_NOW') return 'CURRENT_REPORTING';
  if (PRESENT_TENSE_INTENTS.has(e.classifiers.queryIntent)) return 'CURRENT_REPORTING';
  if (e.time.requirement === 'HISTORICAL') return 'HISTORICAL';
  return 'REFERENCE';
}
