import { hasExplicitTime } from './advisory-requirement';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CONVERSATIONAL INTELLIGENCE JOURNEY R3 — DECISION SUPPORT (§12, §13, §24, §32)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * "Which is better for a logistics expansion, Kenya or Rwanda?" was routed CURRENT_REPORTING
 * (a Kenya news search); "Which economy is best?" too. Neither asks what happened: they ask the
 * reader's DECISION to be weighed. A decision is answered by reasoning against criteria — the
 * objective, the trade-offs, a conclusion conditional on stated assumptions, and what would change
 * it — never by a fake universal winner and never by current figures recalled from memory.
 *
 * The objective is what the answer depends on. When the reader gave none ("Which economy is
 * best?") the honest answer is the question "best for what?" (§12, §24), asked at zero compute.
 * Political choices (parties, candidates, votes) are never decision support (§32): they keep the
 * existing path.
 *
 * Reads FORMS (how a choice is asked for), never a list of seen questions. Pure: no I/O.
 */
export interface DecisionSupportReading {
  /** The reader's stated objective ("logistics expansion"), or null when none was given. */
  readonly objective: string | null;
  /** Clauses with an explicit time marker: the part that needs current sourced evidence. */
  readonly currentClauses: readonly string[];
}

const EN_CHOICE: readonly RegExp[] = [
  /\bwhich\b[^?.!]{0,60}?\b(?:is|are|would\s+be|seems?|appears?|looks?)\s+(?:the\s+)?(?:better|best|stronger|strongest|more\s+(?:suitable|attractive|promising|viable)|most\s+(?:suitable|attractive|promising|viable)|preferable|a\s+better\s+(?:fit|choice|bet)|the\s+best\s+(?:fit|choice|bet))\b/i,
  /\bwhich\s+(?:\w+\s+){0,2}?(?:should\s+(?:i|we)\s+(?:choose|pick|prefer|go\s+with|prioriti[sz]e)|suits?|fits?|works?\s+best)\b/i,
  /\b(?:best|better|strongest|stronger)\s+(?:country|countries|market|markets|economy|economies|option|options|choice|destination|location|city|place|base|hub)\s+for\b/i,
  /\bwhat\s+does\s+(?:this|that|it)\s+mean\s+for\s+(?:my|our)\s+(?:decision|choice|plan|expansion|business)\b/i,
  /\b(?:is|would)\s+\p{Lu}[\p{L}-]+\s+(?:or|a\s+better\s+choice\s+than)\s+\p{Lu}[\p{L}-]+\s+(?:better|a\s+better\s+choice)\s+for\b/iu,
  /* R3 (blind evaluation) — "…which makes more sense?", "Compare A and B as a base for X" */
  /\bwhich\b[^?.!]{0,40}?\bmakes?\s+(?:more|the\s+most)\s+sense\b/i,
  /\bcompar\w*\b.+\bas\s+(?:a|an|the)\s+(?:base|hub|location|destination|market|place|home|headquarters)\s+for\b/i,
];
const PL_CHOICE: readonly RegExp[] = [
  /(?:któr\p{L}*|co)\b[^?.!]{0,60}?(?:jest|będzie|wydaje\s+się)?\s*(?:lepsz\p{L}*|najlepsz\p{L}*|silniejsz\p{L}*|najsilniejsz\p{L}*|bardziej\s+odpowiedni\p{L}*|najbardziej\s+odpowiedni\p{L}*|korzystniejsz\p{L}*)/iu,
  /(?:któr\p{L}*)\s+(?:\p{L}+\s+){0,2}?(?:wybrać|powinienem\s+wybrać|powinniśmy\s+wybrać|pasuje)/iu,
  /co\s+to\s+oznacza\s+dla\s+(?:mojej|naszej)\s+decyzji/iu,
];

const POLITICAL =
  /\b(?:party|parties|candidates?|vote|voting|elections?|president|presidential|politicians?|referendum|ideolog\w*)\b|(?:parti\p{L}*|kandydat\p{L}*|głosow\p{L}*|wybor\p{L}*|prezydent\p{L}*|polityk\p{L}*)/iu;

/* "for (a|an|my|our) <objective>" / "for <objective>" — the reader's goal */
const EN_OBJECTIVE =
  /\b(?:for|suits?|fits?)\s+(?:a|an|my|our|the|your)?\s*((?:[\p{L}-]+\s+){0,4}?(?:expansion|investment|investing|logistics|hub|base|office|warehouse|manufacturing|sourcing|operations?|growth|market\s+entry|entry|trade|exports?|imports?|distribution|retail|tourism|travel|trip|holiday|relocation|living|study|startup|business|partnership|supply\s+chain|e-?commerce|agriculture|mining|energy|it\s+services|services|safari|visit|nature|budget|families|family|retirement|cent(?:re|er)|factory|plant|headquarters|hq)(?:\s+[\p{L}-]+){0,2}?)(?=\s*(?:[?.!,;:]|$|\s+(?:in|between|among|and|or|—|-)\s))/iu;
const PL_OBJECTIVE =
  /(?:dla|pod\s+kątem|do)\s+((?:[\p{L}-]+\s+){0,3}?(?:ekspansj\p{L}*|inwestycj\p{L}*|logistyk\p{L}*|hub\p{L}*|biur\p{L}*|magazyn\p{L}*|produkcj\p{L}*|wzrost\p{L}*|wejści\p{L}*\s+na\s+rynek|handl\p{L}*|eksport\p{L}*|turystyk\p{L}*|podróż\p{L}*|wycieczk\p{L}*|biznes\p{L}*|startup\p{L}*|safari)(?:\s+[\p{L}-]+){0,2}?)(?=\s*(?:[?.!,;:]|$))/iu;

function clauses(text: string): string[] {
  return text
    .split(
      /(?<=[?.!;])\s+|,\s+(?:and|but|while|plus)\s+|\s+(?:and|but)\s+(?=(?:what|which|who|how|where|when|is|are|do|does)\b)/i,
    )
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

/** Null when the question does not ask for a (non-political) decision to be weighed. */
export function readDecisionSupport(
  question: string,
  language: string,
): DecisionSupportReading | null {
  if (language !== 'en' && language !== 'pl') return null;
  const lang: 'en' | 'pl' = language;
  const text = question.trim();
  if (text.length === 0 || POLITICAL.test(text)) return null;
  const choice = (lang === 'pl' ? PL_CHOICE : EN_CHOICE).some((re) => re.test(text));
  if (!choice) return null;
  const m = (lang === 'pl' ? PL_OBJECTIVE : EN_OBJECTIVE).exec(text);
  const objective = m?.[1]?.trim().replace(/\s+/g, ' ').toLowerCase() ?? null;
  const currentClauses = clauses(text).filter((c) => hasExplicitTime(c, lang));
  return { objective: objective === '' ? null : objective, currentClauses };
}

/** §12 — the objectives offered when the reader asked "best" without saying for what. */
export const DECISION_OBJECTIVE_CANDIDATES = [
  'investment',
  'logistics',
  'market size',
  'growth',
] as const;
