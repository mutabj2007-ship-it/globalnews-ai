/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK CONVERSATIONAL TOPIC CONTINUITY R1 — THE CONVERSATION SUBJECT ANCHOR
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A SEPARATE AUTHORITY FROM `EventAnchor`. The event anchor governs discrete
 * events (a crash, an earthquake) and carries PR #42's cause / consequence /
 * cross-border rules. This governs NON-event subjects a reader keeps talking
 * about — "the EU AI regulation", "inflation in Poland", "sanctions on Russia" —
 * when a bounded follow-up refers back to them ("How will this affect …?",
 * "What about businesses?").
 *
 * WHAT CAN CARRY. Only what is derived deterministically from the reader's own
 * earlier question: the subject is a span of that question (or the question
 * itself). No AI answer, claim, source interpretation or conclusion ever crosses
 * a turn. Retrieval re-derives the subject from the user's words; the model
 * still receives the reader's actual follow-up.
 */

/**
 * Codes, never prose: the frontend owns the EN/PL wording.
 *
 *   PRODUCT_APPLICABILITY_NOT_ESTABLISHED  the follow-up asks how the subject
 *     applies to GlobalNewsAI itself. The evidence is external reporting about
 *     the subject; no governed source of facts about the product exists, so
 *     exact applicability cannot be established from it.
 */
export type ConversationSubjectDisclosure = 'PRODUCT_APPLICABILITY_NOT_ESTABLISHED';

export interface ConversationSubjectAnchor {
  /** The continued subject, for display ("Continuing: EU AI regulation"). A span of the prior user question. */
  readonly subject: string;
  /** Always the prior user question: a subject is never taken from anything else. */
  readonly source: 'prior-question';
  readonly disclosures: readonly ConversationSubjectDisclosure[];
}
