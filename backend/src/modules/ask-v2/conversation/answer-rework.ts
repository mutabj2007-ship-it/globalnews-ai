/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK RETRIEVAL / CONVERSATION R2 (contract §7) — A FOLLOW-UP THAT WORKS ON THE EARLIER ANSWER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Replay of the contract's TEST G / TEST D through the real executor: after a sourced answer to
 * "What were the three most significant developments affecting small businesses in Kenya over the
 * past seven days? …", the follow-ups
 *     "Put those developments in a table with dates, sources and uncertainty."
 *     "Which should a small shopkeeper watch most closely, and why?"
 *     "My shipment goes through Dar es Salaam, not Mombasa. Revise your answer …"
 * were each searched as fresh, subject-less news questions ("Put those developments in a table"
 * is not a news topic): Kenya, small businesses and the seven-day window were lost, the earlier
 * evidence was never reused, and after a FAILED earlier answer nothing said so.
 *
 * These forms operate on the findings of the earlier answer (a format, a priority among them, a
 * revision of it). This module only RECOGNISES the form (EN / PL — the deterministic reader's
 * languages); what is bound and how it is executed is the execution contract's job
 * (execution-contract.ts PRIOR_ANSWER_REWORK). The forms are deliberately narrow: each needs an
 * explicit pointer back at the answer or its findings, so a self-contained new question
 * ("Which countries raised rates this week?") is never captured.
 */
export type AnswerReworkForm = 'FORMAT' | 'PRIORITY' | 'REVISION';

/* "revise / update / rewrite … your (earlier) answer" — an explicit operation on the answer */
const EN_REVISION =
  /\b(?:revise|update|rewrite|redo|re-?do|adjust|amend|correct|refine|narrow|re-?run|rework)\s+(?:your|the|that|this)\s+(?:(?:earlier|previous|last|above)\s+)?(?:answer|response|reply|table|list|summary|analysis|findings)\b/i;
const PL_REVISION =
  /(?<![\p{L}\p{N}])(?:popraw|zmień|zaktualizuj|przeredaguj|uaktualnij|skoryguj|dostosuj)\p{L}*\s+(?:(?:swoj|twoj|t|poprzedni|wcześniejsz)\p{L}*\s+)?(?:odpowied\p{L}*|tabel\p{L}*|list\p{L}*|analiz\p{L}*)/iu;

/* a back-reference to the findings ("those developments", "them", "the above") … */
const EN_BACK_REFERENCE =
  /\b(?:those|these|them|the\s+above|(?:the\s+)?(?:same\s+)?(?:developments|findings|items|points)\s+(?:above|you\s+(?:found|listed|gave|mentioned)))\b/i;
const PL_BACK_REFERENCE =
  /(?<![\p{L}\p{N}])(?:te|tych|je|nich|powyższ\p{L}*|wymienion\p{L}*)(?![\p{L}\p{N}])/iu;
/* … asked to be presented in another form */
const EN_FORMAT_NOUN =
  /\b(?:table|tabular|list|bullet(?:s|\s+points)?|chart|timeline|ranking|matrix|columns?|summary)\b/i;
const PL_FORMAT_NOUN = /(?<![\p{L}\p{N}])(?:tabel\p{L}*|list\p{L}*|zestawieni\p{L}*|punkt\p{L}*|ranking\p{L}*|podsumowani\p{L}*)/iu;

/* "Which should …", "Which of these matters most …", "Which one is …" — a choice AMONG the findings */
const EN_PRIORITY_WHICH =
  /^(?:so\s+|and\s+|then\s+|ok(?:ay)?,?\s+)?which\s+(?:one\s+|ones\s+|of\s+(?:these|those|them|the\s+above)(?:\s+\w+)?\s+|(?:development|developments|item|items|issue|issues|risk|risks|factor|factors|change|changes)\s+)?(?:should|would|could|is|are|matters?|deserves?|do|does|will|might|poses?)\b/i;
const EN_AMONG = /\b(?:of|among|from)\s+(?:these|those|them|the\s+above)\b/i;
const PL_PRIORITY_WHICH =
  /^(?:a\s+|i\s+|więc\s+)?któr\p{L}*\s+(?:z\s+(?:nich|tych|powyższych)\s+)?(?:powin\p{L}*|należy|jest|są|ma|warto|najbardziej|najważniejsz\p{L}*)/iu;
const PL_AMONG = /(?<![\p{L}\p{N}])(?:spośród|z)\s+(?:nich|tych|powyższych)(?![\p{L}\p{N}])/iu;

/**
 * The form of a follow-up that operates on the earlier answer's findings, or null. EN / PL only:
 * the other display languages are interpreter-first and keep their existing path.
 */
export function readAnswerRework(question: string, language: string): AnswerReworkForm | null {
  if (language !== 'en' && language !== 'pl') return null;
  const text = question.trim();
  if (text.length === 0 || text.length > 600) return null;
  const pl = language === 'pl';
  if ((pl ? PL_REVISION : EN_REVISION).test(text)) return 'REVISION';
  const backReference = (pl ? PL_BACK_REFERENCE : EN_BACK_REFERENCE).test(text);
  if (backReference && (pl ? PL_FORMAT_NOUN : EN_FORMAT_NOUN).test(text)) return 'FORMAT';
  if ((pl ? PL_PRIORITY_WHICH : EN_PRIORITY_WHICH).test(text) || (pl ? PL_AMONG : EN_AMONG).test(text))
    return 'PRIORITY';
  return null;
}

const EN_EXCLUSION = String.raw`(?:not|instead\s+of|rather\s+than|except|excluding|avoiding|avoid|without)\s+(?:the\s+)?(?:port\s+of\s+|city\s+of\s+)?`;
const PL_EXCLUSION = String.raw`(?:nie|zamiast|z\s+wyjątkiem|bez|omijając)\s+(?:przez\s+)?(?:port\s+w\s+)?`;

/**
 * The places the reader EXCLUDED in this turn ("through Dar es Salaam, not Mombasa"): the ISO3 of
 * every typed place whose own words follow a negation. Presentation and scope bookkeeping only —
 * it reads the qualified reading's spans and never changes how a place is resolved.
 */
export function excludedPlaces(
  question: string,
  language: string,
  placeSpans: Readonly<Record<string, string>>,
): string[] {
  const lead = language === 'pl' ? PL_EXCLUSION : EN_EXCLUSION;
  return Object.entries(placeSpans)
    .filter(([, span]) => {
      const escaped = span.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(String.raw`(?<![\p{L}\p{N}])${lead}${escaped}(?![\p{L}\p{N}])`, 'iu').test(
        question,
      );
    })
    .map(([iso3]) => iso3);
}
