/**
 * ════════════════════════════════════════════════════════════════════════════
 * CTO P0 — GENERAL ADVISORY / DECISION-SUPPORT ROUTING
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Live Alpha operation 11218ecd-0096-4e0f-83ca-7b9eef646af9: "…how I can benefit from selling
 * secondary data online like GlobalNewsAI… Who are going to be our best customers and what
 * techniques are we going to implement to keep them around?" was routed CURRENT_REPORTING, a news
 * search ran, GDELT timed out and the reader got INSUFFICIENT EVIDENCE. Nothing in it asks for
 * news, a place, an event or a time window: it asks for advice.
 *
 * Root cause: deriveKnowledgeRequirement recognised only narrow stable SHAPES ("what is", "how
 * does"); anything else fell to null and the news-oriented reading defaulted it to current
 * reporting. And its freshness test counted topic nouns ("news", "situation") as freshness, so
 * "How should I monetize a news intelligence product?" read as current.
 *
 * This module is the governed capability: CUE FAMILIES (how a request for advice or decision
 * support is framed, and the professional-planning subjects it is about), not a list of the
 * questions seen so far. It reads; the classifier decides.
 *
 *   ADVISORY  a cue, and no EXPLICIT time marker → answered by the existing background/reasoning
 *             provider (no news call), labelled as general guidance, never as current fact.
 *   MIXED     a cue AND an explicit time marker ("…and what are competitors charging today?") →
 *             the advisory part is answered the same way; the current part is NAMED as needing
 *             current sourced evidence. A news outage can never erase the advisory part, and the
 *             whole answer never collapses to INSUFFICIENT because of the current part.
 *
 * Freshness outranks advisory only when it is GENUINE: an explicit time marker (today, currently,
 * latest, this week, a year…). Topic nouns are not time.
 */

/* ── how advice / decision support is asked for ──────────────────────────────────────────── */
const EN_DECISION_FRAMES: readonly RegExp[] = [
  /\b(?:how|what|which|where|when|why|who)\s+(?:should|could|can|would|do|might|must)\s+(?:i|we)\b/i,
  /\bshould\s+(?:i|we)\b/i,
  /* advice about a generic venture ("How should a small startup position itself?") — venture
     nouns only, never a public actor ("How should the government respond?" stays news) */
  /\b(?:how|what|which|where|when)\s+(?:should|could|can|might|do|does)\s+(?:a|an|my|our|your)\s+(?:(?:small|new|young|early[-\s]stage|growing|local|online|b2b|b2c|saas|data|analytics|media|news)\s+)*(?:startup|start-up|company|business|team|founder|product|brand|organi[sz]ation|firm|agency|newsroom|publisher|service|platform|shop|store|app)\b/i,
  /\b(?:what|which|how)\s+(?:would|do|could)\s+you\s+(?:suggest|recommend|advise|propose)\b/i,
  /\b(?:offer|give|need|want|looking\s+for)\s+(?:me\s+|us\s+)?(?:some\s+)?(?:advice|guidance|recommendations?|suggestions?|tips)\b/i,
  /* directed at the assistant — "What did the IMF recommend?" is reported speech, not a request */
  /\b(?:your|some|any)\s+(?:advice|recommendations?|suggestions?|guidance|tips)\b/i,
  /\b(?:advise|recommend|suggest)\s+(?:me|us)\b/i,
  /\b(?:to\s+)?(?:offer|give)\s+advice\b/i,
  /\bhelp\s+(?:me|us)\s+(?:decide|plan|choose|design|write|structure|figure|think|build|improve|prioriti[sz]e)\b/i,
  /\bhow\s+(?:can|could|do|might)\s+(?:i|we|a\s+company|a\s+business|a\s+startup)\s+(?:benefit|grow|improve|attract|retain|keep|reduce|increase|build|launch|sell|price|market|monetize|monetise|scale|win)\b/i,
  /\bwhat\s+(?:do|should|must)\s+(?:i|we)\s+(?:need\s+to\s+)?(?:consider|know|keep\s+in\s+mind|prioriti[sz]e|avoid)\b/i,
  /\b(?:pros\s+and\s+cons|trade-?offs?|best\s+practices?)\b/i,
  /\b(?:indicate|explain|outline|describe)\s+how\s+(?:i|we)\s+(?:can|could|might)\b/i,
];
/* the professional-planning subjects decision support is about (never a public-affairs subject) */
const EN_PLANNING_SUBJECTS =
  /\b(?:business\s+models?|business\s+plan|go-to-market|monetiz\w*|monetis\w*|pricing\s+(?:model|strategy|strategies|tiers?|page|plans?)|subscriptions?|usage[-\s](?:based\s+)?pricing|enterprise\s+(?:contracts?|licen[cs]es?|deals?)|freemium|pay-per-use|customer[-\s]+(?:segments?|segmentation|retention|acquisition|base|churn|success|lifetime\s+value)|(?:target|ideal|best|likely|potential)\s+(?:customers?|clients?|market|audience|buyers?)|retention\s+(?:techniques?|strategy|strategies|plan)|churn|onboarding|product\s+(?:roadmap|strategy|planning|positioning|features?|market\s+fit)|feature\s+(?:planning|prioriti[sz]ation|set)|roadmap|value\s+proposition|marketing\s+(?:plan|strategy|strategies|channels?)|sales\s+(?:strategy|process|funnel|pipeline)|workflow|process\s+design|org(?:ani[sz]ational)?\s+(?:structure|design)|hiring\s+plan|unit\s+economics)\b/i;
const EN_OWN_VENTURE =
  /\b(?:my|our)\s+(?:business|company|startup|product|service|team|customers?|clients?|brand|app|platform|offering|venture|project)\b|\bthis\s+(?:product|service|platform|business|offering)\b/i;
const EN_INTERROGATIVE =
  /\?|^\s*(?:how|what|which|who|should|could|can|would|compare|is\s+it|are\s+there|indicate|explain|outline|suggest|recommend)\b/i;

const PL_DECISION_FRAMES: readonly RegExp[] = [
  /(?:^|\s)jak\s+(?:powinien(?:em|nem)?|powinna(?:m)?|powinniśmy|mogę|możemy|mam|mamy|najlepiej)(?=\s|$|[?,.])/iu,
  /(?:^|\s)co\s+(?:powinienem|powinnam|powinniśmy|polecasz|radzisz|doradzisz|sugerujesz|warto)(?=\s|$|[?,.])/iu,
  /(?:^|\s)(?:doradź|poradź|porad[aęy]|rekomend\p{L}*|sugesti\p{L}*|zalece\p{L}*|wskazówk\p{L}*)/iu,
  /(?:^|\s)(?:zalety\s+i\s+wady|plusy\s+i\s+minusy|kompromis\p{L}*)/iu,
];
const PL_PLANNING_SUBJECTS =
  /(?:model\p{L}*\s+biznesow\p{L}*|monetyz\p{L}*|strategi\p{L}*\s+cenow\p{L}*|subskrypc\p{L}*|segment\p{L}*\s+klient\p{L}*|klient\p{L}*\s+docelow\p{L}*|utrzyma\p{L}*\s+klient\p{L}*|retencj\p{L}*|plan\p{L}*\s+biznesow\p{L}*|plan\p{L}*\s+marketingow\p{L}*|harmonogram\p{L}*\s+produkt\p{L}*|propozycj\p{L}*\s+wartości)/iu;
const PL_OWN_VENTURE =
  /(?:^|\s)(?:moj\p{L}*|nasz\p{L}*|mój)\s+(?:firm\p{L}*|biznes\p{L}*|produkt\p{L}*|usług\p{L}*|klient\p{L}*|zesp\p{L}*|startup\p{L}*|platform\p{L}*)/iu;
const PL_INTERROGATIVE =
  /\?|^\s*(?:jak|co|kto|który|która|które|czy|porównaj|doradź|poradź)(?=\s)/iu;

/* ── genuine freshness: an explicit time marker, never a topic noun ───────────────────────── */
const EN_EXPLICIT_TIME =
  /\b(?:today|today's|tonight|right\s+now|now|currently|current\s+(?:market|prices?|pricing|rates?|state|situation|data|figures|events|news|status)|latest|most\s+recent|recent(?:ly)?|this\s+(?:week|month|year|quarter)|yesterday|as\s+of|at\s+the\s+moment|at\s+present|so\s+far\s+this|in\s+(?:19|20)\d{2}|(?:19|20)\d{2})\b/i;
const PL_EXPLICIT_TIME =
  /(?:^|\s)(?:dziś|dzisiaj|dzisiejsz\p{L}*|teraz|obecnie|aktualn\p{L}*|najnowsz\p{L}*|ostatnio|w\s+tym\s+(?:tygodniu|miesiącu|roku|kwartale)|wczoraj|(?:19|20)\d{2})(?=\s|$|[?,.!])/iu;

export type AdvisoryMode = 'ADVISORY' | 'MIXED_ADVISORY_CURRENT';

export interface AdvisoryReading {
  readonly mode: AdvisoryMode;
  /** The clauses that carry an explicit time marker: the current part that needs evidence. */
  readonly currentClauses: readonly string[];
}

function clauses(text: string): string[] {
  return text
    .split(
      /(?<=[?.!;])\s+|,\s+(?:and|but|while|plus)\s+|\s+(?:and|but)\s+(?=(?:what|which|who|how|where|when|is|are|do|does)\b)/i,
    )
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

export function hasExplicitTime(text: string, lang: 'en' | 'pl'): boolean {
  return (lang === 'pl' ? PL_EXPLICIT_TIME : EN_EXPLICIT_TIME).test(text);
}

/** Null when the question is not a request for advice / decision support. */
export function readAdvisory(question: string, language: string): AdvisoryReading | null {
  if (language !== 'en' && language !== 'pl') return null;
  const lang: 'en' | 'pl' = language;
  const text = question.trim();
  if (text.length === 0) return null;
  const frames = lang === 'pl' ? PL_DECISION_FRAMES : EN_DECISION_FRAMES;
  const subjects = lang === 'pl' ? PL_PLANNING_SUBJECTS : EN_PLANNING_SUBJECTS;
  const own = lang === 'pl' ? PL_OWN_VENTURE : EN_OWN_VENTURE;
  const interrogative = (lang === 'pl' ? PL_INTERROGATIVE : EN_INTERROGATIVE).test(text);

  const decisionFrame = frames.some((frame) => frame.test(text));
  const planningSubject = subjects.test(text);
  const ownVenture = own.test(text);
  /*
    A cue is either an explicit request for advice / a decision, or a professional-planning
    subject asked about as a question. "Strategy" alone is NOT a planning subject ("What is
    Russia's strategy?" is current affairs); a decision frame about one's own venture is.
  */
  const advisory = decisionFrame || (interrogative && (planningSubject || ownVenture));
  if (!advisory) return null;

  const timed = clauses(text).filter((clause) => hasExplicitTime(clause, lang));
  if (timed.length === 0) return { mode: 'ADVISORY', currentClauses: [] };
  /* A question that is ONLY a timed fact request with an advice word in it is still advisory in
     part: the advisory guidance is answered, the timed part is named as needing evidence. */
  return { mode: 'MIXED_ADVISORY_CURRENT', currentClauses: timed };
}
