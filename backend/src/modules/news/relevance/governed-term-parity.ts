import { FALLBACK_STOPWORDS } from '../../analysis/query/derive-generic-news-query.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK RETRIEVAL RECALL R2 — THE GOVERNED TERM-PARITY TABLES
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE DEFECT (proved on the real utilities, see generic-relevance.util.spec).
 * "Explain the new EU AI regulation in plain English" derives the gate phrase
 * "EU AI regulation", and the multi-word generic gate admitted an article only
 * if that exact contiguous phrase appeared in its title or summary. Reporting
 * that is plainly about what the reader asked — "EU AI Act: what the new rules
 * mean", "EU artificial intelligence regulation enters next phase", "Tech firms
 * push back on EU AI rules" — was rejected for wording alone.
 *
 * THE REPAIR IS DATA, NOT A NEW RELEVANCE MODEL. `scoreGenericRelevance()` keeps
 * its whole-phrase rule unchanged and gains ONE bounded second admission path
 * (see there). This file only declares WHICH words are framing and WHICH forms
 * are the same concept. Both lists are closed, reviewed, deterministic and
 * tested; nothing here is generated, inferred or AI-derived.
 */

/**
 * Closed equivalence classes. A query term that appears in a class may be
 * satisfied by ANY form of that class; a term in no class must appear itself.
 * Membership is symmetric. Every class is a synonym set for ONE concept —
 * abbreviation ↔ expansion, or one legal-instrument noun ↔ another — never a
 * loose topical association (no "Brussels" for EU, no "tech" for AI).
 */
export const GOVERNED_EQUIVALENCE_CLASSES: readonly (readonly string[])[] = [
  /* abbreviation ↔ expansion (EN) */
  ['ai', 'artificial intelligence'],
  ['eu', 'european union'],
  ['un', 'united nations'],
  ['uk', 'united kingdom'],
  ['us', 'united states'],

  /* one legal instrument, many names (EN) */
  ['regulation', 'act', 'law', 'rules', 'directive', 'legislation'],

  /* PL — same concepts, the inflected forms Polish reporting actually uses */
  /* 'si' is deliberately absent: too short and a common word in other languages. */
  ['ai', 'sztuczna inteligencja', 'sztucznej inteligencji'],
  ['ue', 'unia europejska', 'unii europejskiej', 'eu'],
  [
    'przepisy',
    'przepisów',
    'rozporządzenie',
    'rozporządzenia',
    'ustawa',
    'ustawy',
    'akt',
    'aktu',
    'regulacje',
    'regulacji',
    'prawo',
  ],
];

/**
 * Framing words: they shape a question, they are not its topic, so they never
 * become load-bearing terms. The English core IS the existing, reviewed
 * `FALLBACK_STOPWORDS` (reused, not re-declared), plus explanation framing and
 * the Polish function/novelty words that play the same role.
 *
 * An ALL-CAPS token in the query (EU, AI, US, UN) is never treated as framing,
 * whatever this set says: "US" in "US AI regulation" is the country, not "us".
 */
const EXPLANATION_FRAMING = ['explain', 'explained', 'explainer', 'simply', 'basically', 'briefly'];
const POLISH_FRAMING = [
  'nowe',
  'nowy',
  'nowa',
  'nowych',
  'nowego',
  'nowej',
  'dotyczące',
  'dotyczących',
  'dotyczy',
  'w',
  'sprawie',
  'o',
  'i',
  'oraz',
  'na',
  'z',
  'do',
  'dla',
];

export const GOVERNED_FRAMING_TERMS: ReadonlySet<string> = new Set([
  ...FALLBACK_STOPWORDS,
  ...EXPLANATION_FRAMING,
  ...POLISH_FRAMING,
]);

/** Every form a single query term may be satisfied by (itself first). */
export function equivalentForms(term: string): string[] {
  const forms = new Set<string>([term]);
  for (const cls of GOVERNED_EQUIVALENCE_CLASSES) {
    if (cls.includes(term)) for (const form of cls) forms.add(form);
  }
  return [...forms];
}

/**
 * The load-bearing terms of a gate phrase, lower-cased, in order, deduplicated.
 * Framing words are dropped unless written ALL-CAPS (an acronym) or a member of a
 * governed equivalence class; one-letter tokens never carry a topic.
 */
export function extractParityTerms(phrase: string): string[] {
  const terms: string[] = [];
  for (const raw of (phrase ?? '').split(/\s+/).filter(Boolean)) {
    const word = raw.replace(/[^\p{L}\p{N}]+/gu, '');
    if (word.length < 2) continue;
    const lower = word.toLowerCase();
    const isAcronym = /^\p{Lu}{2,}$/u.test(word);
    /* A governed concept is never framing, in any case: lower-case "us" in
       "us ai regulation" is still the United States, not the pronoun. */
    const isGovernedConcept = equivalentForms(lower).length > 1;
    if (!isAcronym && !isGovernedConcept && GOVERNED_FRAMING_TERMS.has(lower)) continue;
    if (!terms.includes(lower)) terms.push(lower);
  }
  return terms;
}
