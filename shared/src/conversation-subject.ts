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
 *   FOCUS_NOT_IN_EVIDENCE  (D.1) the follow-up narrows the subject to a focus
 *     ("consumers", "Poland") and no retrieved report addresses that focus;
 *     the answer rests on reporting about the subject alone.
 */
export type ConversationSubjectDisclosure =
  | 'PRODUCT_APPLICABILITY_NOT_ESTABLISHED'
  | 'FOCUS_NOT_IN_EVIDENCE';

export interface ConversationSubjectAnchor {
  /** The continued subject, for display ("Continuing: EU AI regulation"). A span of the prior user question. */
  readonly subject: string;
  /**
   * D.1 — the current turn's evidence-bearing modifier: its targets and aspects
   * ("consumers", "Poland", "businesses"), each a word of the follow-up itself,
   * with conversational framing ("this", "what about", "should I be scared"),
   * the product's own name and the inherited subject removed. Empty when the
   * follow-up adds nothing that can bear on evidence.
   */
  readonly focus: readonly string[];
  /**
   * ASK R3 RETRIEVAL POLICY CLOSEOUT R2 — DISPLAY ONLY: the focus as the reader wrote it, adjacent
   * words kept together ("ordinary households"). Absent on older payloads; show `focus` then.
   */
  readonly focusDisplay?: readonly string[];
  /**
   * D.1 — the retrieval meaning, stated: inherited subject + current focus
   * ("inflation high Poland consumers"). The reader's own question is kept
   * unchanged for the model and the page; this is what evidence is chosen for.
   */
  readonly retrievalMeaning: string;
  /** Always the prior user question: a subject is never taken from anything else. */
  readonly source: 'prior-question';
  readonly disclosures: readonly ConversationSubjectDisclosure[];
}
