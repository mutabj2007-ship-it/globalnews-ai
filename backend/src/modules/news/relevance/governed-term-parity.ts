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
 * name the same retrieval topic. Both lists are closed, reviewed, deterministic
 * and tested; nothing here is generated, inferred or AI-derived.
 *
 * THIS IS RETRIEVAL-TOPIC PARITY, NOT LEGAL EQUIVALENCE. "act", "law", "rules"
 * and "legislation" are grouped because reporting uses them interchangeably
 * for one legal topic, not because the instruments are legally identical.
 * PR #41 R2.1 B3: formal EU instrument names that are genuinely DISTINCT —
 * a directive vs. a regulation — are deliberately NOT grouped, so a question
 * about one never admits reporting about the other through this table.
 */

/**
 * Closed equivalence classes. A term in a class may be satisfied by any form of
 * its CONCEPT; a term in no class must appear itself. Classes that share a form
 * are merged into one concept (so the EN "eu" and the PL "ue" classes are one
 * concept), which is what makes membership symmetric in every direction.
 */
export const GOVERNED_EQUIVALENCE_CLASSES: readonly (readonly string[])[] = [
  /* abbreviation ↔ expansion (EN) */
  ['ai', 'artificial intelligence'],
  ['eu', 'european union'],
  ['un', 'united nations'],
  ['uk', 'united kingdom'],
  ['us', 'united states'],

  /* one legal TOPIC, several everyday names (EN). No "directive": R2.1 B3. */
  ['regulation', 'act', 'law', 'rules', 'legislation'],

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
 * Acronym forms. In an ARTICLE these match only as an acronym — upper case,
 * optionally dotted ("US", "U.S.") — never as an ordinary lower-case word:
 * the pronoun "us", Portuguese "eu", French "un", or the name "Ai Weiwei" must
 * not satisfy a country, union or AI concept (R2.1 B2).
 */
const ACRONYM_FORMS: ReadonlySet<string> = new Set(['ai', 'eu', 'ue', 'un', 'uk', 'us']);

/**
 * Forms that are ALSO ordinary words, and therefore name the concept on the
 * QUERY side only when written as an acronym. "tell us about AI regulation" is
 * about AI regulation, not the United States (R2.1 B2). "US"/"United States"
 * keep the country concept.
 */
const CASE_SENSITIVE_QUERY_FORMS: ReadonlySet<string> = new Set(['us']);

/* ── concept groups: transitive closure over the classes ─────────────────── */
const CONCEPTS: readonly string[][] = (() => {
  const groups: Set<string>[] = [];
  for (const cls of GOVERNED_EQUIVALENCE_CLASSES) {
    const touching = groups.filter((group) => cls.some((form) => group.has(form)));
    /* Earlier forms first, so a concept keeps its first-declared canonical key ("eu", not "ue"). */
    const merged = new Set<string>();
    for (const group of touching) {
      for (const form of group) merged.add(form);
      groups.splice(groups.indexOf(group), 1);
    }
    for (const form of cls) merged.add(form);
    groups.push(merged);
  }
  return groups.map((group) => [...group]);
})();

const CONCEPT_OF_FORM: ReadonlyMap<string, readonly string[]> = new Map(
  CONCEPTS.flatMap((concept) => concept.map((form) => [form, concept] as const)),
);

/** Longest multi-word form, in words — the bound on the query-side scan. */
const MAX_FORM_WORDS = Math.max(
  ...[...CONCEPT_OF_FORM.keys()].map((form) => form.split(' ').length),
);

/**
 * Framing words: they shape a question, they are not its topic, so they never
 * become load-bearing terms. The English core IS the existing, reviewed
 * `FALLBACK_STOPWORDS` (reused, not re-declared), plus explanation framing and
 * the Polish function/novelty words that play the same role.
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

/** Every form a term may be satisfied by: its whole concept, the term itself first. */
export function equivalentForms(term: string): string[] {
  const concept = CONCEPT_OF_FORM.get(term);
  return concept ? [term, ...concept.filter((form) => form !== term)] : [term];
}

/** True when `form` must be matched as an acronym (case-sensitive) in article text. */
export function isAcronymForm(form: string): boolean {
  return ACRONYM_FORMS.has(form);
}

/** Whole-token, upper-case acronym match, optionally dotted: "US", "U.S.", "U.S". */
export function containsAcronym(text: string, form: string): boolean {
  const pattern = new RegExp(`${EDGE_BEFORE}${acronymSource(form)}${EDGE_AFTER}`, 'u');
  return pattern.test(text ?? '');
}

const EDGE_BEFORE = '(?<![\\p{L}\\p{N}])';
const EDGE_AFTER = '(?![\\p{L}\\p{N}])';

/** Case-sensitive source for an acronym form: "US" or dotted "U.S." / "U.S". */
function acronymSource(form: string): string {
  const letters = form.toUpperCase().split('');
  return `(?:${letters.join('')}|${letters.map((letter) => `${letter}\\.`).join('')}?)`;
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A case-INSENSITIVE source for an ordinary word, without the 'i' flag. */
function anyCaseSource(word: string): string {
  return [...word]
    .map((char) => {
      const lower = char.toLowerCase();
      const upper = char.toUpperCase();
      return lower === upper ? escapeForRegExp(char) : `[${lower}${upper}]`;
    })
    .join('');
}

/**
 * PR #41 R2.1 B2.1 — THE EXACT-PHRASE RULE RESPECTS GOVERNED CASE.
 *
 * The whole-phrase rule compares lower-cased text, so on its own it cannot tell
 * the country acronym "US" from the pronoun "us". This is the ONE governed-case
 * authority it consults before accepting an exact multi-word phrase; the token
 * list is the same `CASE_SENSITIVE_QUERY_FORMS` the parity path uses, and the
 * acronym shape is the same `acronymSource` — no second table.
 *
 * Returns true — changing nothing — when the phrase holds no case-sensitive
 * token. Otherwise the phrase must occur in `text` with every case-sensitive
 * token of the SAME kind the query wrote, at that position:
 *   query "US" (acronym)  → the article must say "US" / "U.S." there;
 *   query "us" (pronoun)  → the article must say "us" / "Us" there.
 * Every other word stays case-insensitive, with the gate's regular plural
 * tolerance, so only the case-sensitive token's meaning is enforced.
 */
export function phraseRespectsGovernedCase(phrase: string, text: string): boolean {
  const words = (phrase ?? '')
    .split(/\s+/)
    .map((raw) => raw.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter((word) => word.length > 0);
  if (!words.some((word) => CASE_SENSITIVE_QUERY_FORMS.has(word.toLowerCase()))) return true;

  const parts = words.map((word) => {
    const lower = word.toLowerCase();
    if (!CASE_SENSITIVE_QUERY_FORMS.has(lower)) return `${anyCaseSource(lower)}(?:s|es)?`;
    if (/^\p{Lu}{2,}$/u.test(word)) return acronymSource(lower);
    return `(?:${lower}|${lower.charAt(0).toUpperCase()}${lower.slice(1)})`;
  });
  const pattern = new RegExp(`${EDGE_BEFORE}${parts.join('[^\\p{L}\\p{N}]+')}${EDGE_AFTER}`, 'u');
  return pattern.test(text ?? '');
}

/**
 * The load-bearing terms of a gate phrase, as CONCEPT KEYS, in order,
 * deduplicated.
 *
 * R2.1 B1 — multi-word forms are recognised BEFORE ordinary tokenisation, by a
 * bounded longest-match scan ("European Union" → eu, "artificial intelligence"
 * → ai), so an expanded query maps to the same concept as its abbreviation.
 * Each concept is represented by its canonical key, so "EU AI regulation" and
 * "European Union artificial intelligence regulation" produce the same terms.
 *
 * Framing words are dropped unless written ALL-CAPS (an acronym) or a member of
 * a governed concept — except the case-sensitive forms ("us"), which name the
 * concept only when written as an acronym. One-letter tokens never carry a topic.
 */
export function extractParityTerms(phrase: string): string[] {
  const tokens = (phrase ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => raw.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter((word) => word.length > 0);
  const terms: string[] = [];
  const push = (term: string): void => {
    if (!terms.includes(term)) terms.push(term);
  };

  for (let i = 0; i < tokens.length;) {
    let matched = false;
    for (let len = Math.min(MAX_FORM_WORDS, tokens.length - i); len >= 2; len--) {
      const span = tokens
        .slice(i, i + len)
        .join(' ')
        .toLowerCase();
      const concept = CONCEPT_OF_FORM.get(span);
      if (concept) {
        push(concept[0]);
        i += len;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const word = tokens[i];
    i += 1;
    if (word.length < 2) continue;
    const lower = word.toLowerCase();
    const isAcronym = /^\p{Lu}{2,}$/u.test(word);

    if (CASE_SENSITIVE_QUERY_FORMS.has(lower) && !isAcronym) continue;

    const concept = CONCEPT_OF_FORM.get(lower);
    if (concept) {
      push(concept[0]);
      continue;
    }
    if (!isAcronym && GOVERNED_FRAMING_TERMS.has(lower)) continue;
    push(lower);
  }
  return terms;
}
