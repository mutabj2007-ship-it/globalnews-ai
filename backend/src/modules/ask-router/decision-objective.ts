import { readDecisionSupport } from './decision-support';
import { plTolerant } from './pl-tolerant';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO R4 FIFTH PASS — "BEST FOR WHAT?" ONLY WHEN THE CONVERSATION HAS NO OBJECTIVE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Two evaluations look alike and are not:
 *
 *   CHOICE_EVALUATION               "Which country is best?" — a choice between options; it needs
 *                                   an objective, and asks for one only if the conversation has none
 *   ARTIFACT_COMPONENT_EVALUATION   "Which argument is strongest?", "Which part is weakest?",
 *                                   "Which of the skeptic's points matters most?" — the object being
 *                                   evaluated is ALREADY there (the arguments, the framework, the
 *                                   recommendation set): never "best for what?"
 *
 * OBJECTIVE MEMORY is bounded semantic state built ONLY from the reader's own words — never from
 * model prose: the newest objective the reader stated (a decision's "for X", "what matters most to
 * me is X", "the goal is X", "evaluate … for reducing X") with the turn it came from. A newer
 * explicit objective overrides an older one. A DECISION_CRITERIA artifact's label is the
 * structured fallback.
 */
export type EvaluationKind = 'CHOICE_EVALUATION' | 'ARTIFACT_COMPONENT_EVALUATION';

/* the evaluated thing is a COMPONENT of earlier work: arguments, points, parts, recommendations… */
const COMPONENT_NOUN = String.raw`(?:point|points|argument|arguments|part|parts|component|components|element|elements|factor|factors|reason|reasons|assumption|assumptions|recommendation|recommendations|objection|objections|criticism|criticisms|critique|critiques|claim|claims|step|steps|risk|risks|idea|ideas|scenario|scenarios|lesson|lessons|pillar|pillars|dimension|dimensions|option\s+you\s+(?:listed|gave)|counterargument|counterarguments|weakness|weaknesses|strength|strengths)`;
const EN_COMPONENT_EVALUATION = new RegExp(
  String.raw`\b(?:which|what)\s+(?:one\s+)?(?:of\s+(?:the|these|those|his|her|their|your|my|our|them)\s+(?:[\p{L}'’-]+['’]s\s+)?(?:[\p{L}-]+\s+)?)?${COMPONENT_NOUN}\b|\b(?:the|your|their)\s+(?:strongest|weakest|best|worst|most\s+(?:important|convincing|persuasive|fragile|critical)|least\s+(?:convincing|important|robust))\s+${COMPONENT_NOUN}\b|\bwhich\s+of\s+(?:those|these|them)\b`,
  'iu',
);
const PL_COMPONENT_EVALUATION = plTolerant(
  /(?:któr\p{L}*|co)\s+(?:z\s+(?:tych|nich|twoich|jego|jej|ich)\s+(?:\p{L}+\s+)?)?(?:argument\p{L}*|punkt\p{L}*|część|części|element\p{L}*|czynnik\p{L}*|powod\p{L}*|powód|założeni\p{L}*|rekomendacj\p{L}*|zarzut\p{L}*|krok\p{L}*|ryzyk\p{L}*|scenariusz\p{L}*|słab\p{L}*\s+stron\p{L}*)|(?:któr\p{L}*|co)\s+z\s+(?:tych|nich|powyższ\p{L}*)/iu,
);

/** Is the turn an evaluation of COMPONENTS of earlier work (never "best for what?")? */
export function readEvaluationKind(text: string, language: string): EvaluationKind | null {
  const lang = language === 'pl' ? 'pl' : 'en';
  if ((lang === 'pl' ? PL_COMPONENT_EVALUATION : EN_COMPONENT_EVALUATION).test(text))
    return 'ARTIFACT_COMPONENT_EVALUATION';
  return readDecisionSupport(text, lang) !== null ? 'CHOICE_EVALUATION' : null;
}

/* an objective STATED by the reader, in any turn */
const EN_OBJECTIVE =
  /\b(?:what\s+matters\s+(?:most\s+)?(?:to\s+(?:me|us)\s+)?(?:is|are)|my\s+(?:main\s+|top\s+|biggest\s+)?(?:priority|priorities|goal|objective|aim|concern)\s+(?:is|are)|our\s+(?:main\s+|top\s+)?(?:priority|priorities|goal|objective|aim)\s+(?:is|are)|i\s+(?:mostly\s+|mainly\s+|really\s+)?care\s+(?:most\s+)?about|we\s+(?:mostly\s+|mainly\s+)?care\s+(?:most\s+)?about|the\s+goal\s+is|i\s+(?:want|need)\s+to\s+(?:maximi[sz]e|minimi[sz]e|optimi[sz]e)|(?:evaluate|compare|assess|rank|weigh)\b[^.?!]{0,80}?\b(?:for|in\s+terms\s+of|with\s+the\s+goal\s+of|aimed\s+at)\s+(?=(?:reducing|increasing|improving|cutting|growing|lowering|raising|boosting|minimi[sz]ing|maximi[sz]ing|getting|finding|keeping|retaining|winning|attracting|saving|making|building|protecting)\b))\s*(.{3,90}?)\s*(?:[.?!;:]|$)/iu;
const PL_OBJECTIVE = plTolerant(
  /(?:najważniejsze\s+(?:dla\s+(?:mnie|nas)\s+)?(?:jest|są)|najbardziej\s+zależy\s+(?:mi|nam)\s+na|zależy\s+(?:mi|nam)\s+(?:głównie\s+|najbardziej\s+)?na|moim\s+(?:głównym\s+)?(?:celem|priorytetem)\s+jest|naszym\s+(?:głównym\s+)?(?:celem|priorytetem)\s+jest|priorytetem\s+(?:jest|są)|(?:oceń|porównaj|zestaw)\p{L}*[^.?!]{0,80}?\s+pod\s+kątem)\s*(.{3,90}?)\s*(?:[.?!;:]|$)/iu,
);

/** The objective a single turn states ("for job prospects", "what matters most is X"), or null. */
export function objectiveStatedIn(text: string, language: string): string | null {
  const lang = language === 'pl' ? 'pl' : 'en';
  const decision = readDecisionSupport(text, lang)?.objective ?? null;
  if (decision !== null) return decision;
  const m = (lang === 'pl' ? PL_OBJECTIVE : EN_OBJECTIVE).exec(text.trim());
  return m?.[1]?.trim().replace(/[,;]+$/, '') ?? null;
}

export interface ConversationObjective {
  readonly text: string;
  /** the ordinal (0-based) of the reader's turn that stated it */
  readonly sourceTurn: number;
}

/**
 * The conversation's objective: the NEWEST objective the reader stated among the earlier turns
 * (oldest first) — bounded semantic state from the reader's own words only.
 */
export function conversationObjective(
  earlierOldestFirst: readonly string[],
  language: string,
): ConversationObjective | null {
  for (let i = earlierOldestFirst.length - 1; i >= 0; i--) {
    const text = objectiveStatedIn(earlierOldestFirst[i], language);
    if (text !== null) return { text, sourceTurn: i };
  }
  return null;
}
