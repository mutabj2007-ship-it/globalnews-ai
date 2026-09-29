import { COUNTRIES, type CountryMeta, type NewsArticle } from '@globalnews-ai/shared';
import { COUNTRY_DEMONYMS_BY_ISO3, scoreCountryRelevance } from '../country/country-relevance.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P1 MULTI-ENTITY / TOPIC RELEVANCE CLOSURE R1 — RELATIONAL EVENTS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE PROVEN DEFECT (reproduced deterministically, no Alpha guesswork):
 *
 *   "What are the latest reported Russian missile and drone attacks on Ukraine?"
 *
 *   1  The Analysis classifier collects countries only from a coordination frame
 *      ("X and Y") or a demonym, so it read ONE country — Russia (from "Russian").
 *      "Ukraine", named after "on", was never counted. The router, meanwhile, read the
 *      typed geography as Ukraine: two authorities, two different places.
 *   2  detectLocationByDemonym then made Russia the retrieval location, and the country
 *      branch called getCountryNews(Russia) with NO topic at all. The event the reader
 *      asked about ("missile and drone attacks") never reached retrieval or relevance —
 *      so "Russian central bank holds key rate" qualified merely because Russia appears,
 *      and Ukraine-side reporting depended on luck.
 *   3  The same relation phrased as "Did Russia launch … attacks on Ukraine?" matched no
 *      closed pattern, fell to the generic branch, and the whole prose sentence became
 *      the relevance phrase: 0 admitted.
 *
 * THE GENERAL MECHANISM, not a Russia/Ukraine rule: Entity A → event → Entity B.
 *
 *   RECOGNITION  exactly TWO distinct countries named in the reader's question — by name,
 *                demonym or curated city, through the SAME governed scorer
 *                (scoreCountryRelevance) country retrieval already trusts — AND exactly ONE
 *                event family from the closed table below. Anything else is not this shape
 *                and takes exactly the path it took before.
 *   RETRIEVAL    both entities and the event are kept: one provider search carrying all
 *                three, through the unchanged tier ladder.
 *   RELEVANCE    relationship-aware, not recall-by-mention: an article qualifies only when
 *                BOTH entities AND the event family are stated together — in the headline,
 *                or in ONE summary sentence while the headline carries at least one of them
 *                (the same locality bound the generic parity rule uses). One entity alone —
 *                "Russian central bank holds key rate", "Ukraine grain exports rise" — never
 *                qualifies; nor do both entities without the event ("grain talks" are not an
 *                attack). Equivalent source wording is admitted through the entity scorer
 *                (Kyiv, Ukrainian, Moscow, Russian) and the event-family forms (drones,
 *                missiles, shelling, strike … all one ARMED_ATTACK family).
 *
 * BOUNDS, each deliberate: a closed, reviewed event table (no stemming, no embeddings, no
 * model call); English questions only (the Polish retrieval path is untouched — see the
 * closeout's remaining items); role-symmetric at the family level (the gate proves the two
 * entities and the event co-occur; it does not parse which side acted).
 */

export type EventFamilyId = 'ARMED_ATTACK' | 'SANCTIONS' | 'TALKS' | 'TRADE_MEASURES';

export interface EventFamily {
  readonly id: EventFamilyId;
  /** Whole-word, case-insensitive surface forms (EN reporting). */
  readonly forms: readonly string[];
  /** The event word sent to providers with the two entities. */
  readonly query: string;
}

export const EVENT_FAMILIES: readonly EventFamily[] = [
  {
    id: 'ARMED_ATTACK',
    forms: [
      'attack',
      'attacks',
      'attacked',
      'strike',
      'strikes',
      'struck',
      'airstrike',
      'airstrikes',
      'air strike',
      'air strikes',
      'missile',
      'missiles',
      'drone',
      'drones',
      'rocket',
      'rockets',
      'shelling',
      'shelled',
      'bombardment',
      'bombing',
      'bombings',
      'bombed',
      'barrage',
      'invasion',
      'invaded',
      'offensive',
    ],
    query: 'attack',
  },
  {
    id: 'SANCTIONS',
    forms: ['sanction', 'sanctions', 'sanctioned', 'embargo', 'embargoes'],
    query: 'sanctions',
  },
  {
    id: 'TALKS',
    forms: [
      'talks',
      'negotiations',
      'negotiate',
      'negotiating',
      'summit',
      'peace deal',
      'ceasefire',
    ],
    query: 'talks',
  },
  {
    id: 'TRADE_MEASURES',
    forms: ['tariff', 'tariffs', 'trade war', 'trade deal', 'export ban', 'import ban'],
    query: 'trade',
  },
];

export interface RelationalEventQuestion {
  /** The two participating entities, in the order the reader named them. */
  readonly entities: readonly [CountryMeta, CountryMeta];
  readonly family: EventFamily;
  /** Both entities and the event: neither entity can be narrowed away. */
  readonly providerQuery: string;
  /**
   * INTELLIGENCE BINDING R1 (§10, P1 release guard) — who acts on whom, when the question
   * states it ("Russian … attacks ON Ukraine", "Ukraine hit BY Russian drones"). Null when the
   * question states no direction; then the landed role-symmetric gate applies unchanged.
   */
  readonly direction: { readonly actor: CountryMeta; readonly target: CountryMeta } | null;
}

/* ── direction: the smallest guard compatible with the landed mechanism ───────────────────
   An entity ACTS in a text when an event-family form follows its mention closely ("Russian
   missile", "Ukraine strikes", "Russia launch missile") or "by" precedes it ("hit by Russian
   drones"). An entity is the TARGET when a targeting preposition precedes it ("on Ukraine",
   "against Ukraine"). Mentions are the entity's name and governed demonyms only. */
const TARGETING_PREPOSITIONS: ReadonlySet<string> = new Set([
  'on',
  'against',
  'at',
  'into',
  'targeting',
]);
const ACT_WINDOW = 2;

function mentionForms(entity: CountryMeta): string[] {
  return [entity.name, ...(COUNTRY_DEMONYMS_BY_ISO3[entity.iso3] ?? [])].map((f) =>
    normalize(f).trim(),
  );
}

function wordsOf(text: string): string[] {
  return normalize(text).trim().split(' ').filter(Boolean);
}

/** Every [start, end) word span where the entity is mentioned. */
function mentionSpans(words: readonly string[], entity: CountryMeta): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  for (const form of mentionForms(entity)) {
    const parts = form.split(' ');
    for (let i = 0; i + parts.length <= words.length; i += 1) {
      if (parts.every((p, k) => words[i + k] === p)) spans.push([i, i + parts.length]);
    }
  }
  return spans;
}

function isFamilyForm(words: readonly string[], at: number, family: EventFamily): boolean {
  return family.forms.some((form) => {
    const parts = normalize(form).trim().split(' ');
    return parts.every((p, k) => words[at + k] === p);
  });
}

function acts(words: readonly string[], entity: CountryMeta, family: EventFamily): boolean {
  return mentionSpans(words, entity).some(([start, end]) => {
    if (words[start - 1] === 'by') return true;
    let at = end;
    if (words[at] === 's') at += 1; /* possessive "Russia's" */
    for (let k = 0; k < ACT_WINDOW; k += 1) if (isFamilyForm(words, at + k, family)) return true;
    return false;
  });
}

function targeted(words: readonly string[], entity: CountryMeta): boolean {
  return mentionSpans(words, entity).some(([start]) => {
    const before = words[start - 1] === 'the' ? words[start - 2] : words[start - 1];
    return before !== undefined && TARGETING_PREPOSITIONS.has(before);
  });
}

/** The direction the question states, or null when it states none (or contradicts itself). */
export function readDirection(
  question: string,
  entities: readonly [CountryMeta, CountryMeta],
  family: EventFamily,
): { actor: CountryMeta; target: CountryMeta } | null {
  const words = wordsOf(question);
  const [a, b] = entities;
  /* "Russia and Ukraine exchanging strikes": a coordinated pair states no direction. */
  const coordinated = mentionSpans(words, a).some(([, aEnd]) =>
    mentionSpans(words, b).some(
      ([bStart]) => bStart === aEnd + 1 && ['and', 'or'].includes(words[aEnd] ?? ''),
    ),
  );
  const reverseCoordinated = mentionSpans(words, b).some(([, bEnd]) =>
    mentionSpans(words, a).some(
      ([aStart]) => aStart === bEnd + 1 && ['and', 'or'].includes(words[bEnd] ?? ''),
    ),
  );
  if (coordinated || reverseCoordinated) return null;
  const aActs = acts(words, a, family);
  const bActs = acts(words, b, family);
  const aTarget = targeted(words, a);
  const bTarget = targeted(words, b);
  if ((aActs || bTarget) && !bActs && !aTarget) return { actor: a, target: b };
  if ((bActs || aTarget) && !aActs && !bTarget) return { actor: b, target: a };
  return null;
}

/** A sentence that states the OPPOSITE direction: the target acts and the actor does not. */
export function statesReversedDirection(
  sentence: string,
  direction: { actor: CountryMeta; target: CountryMeta },
  family: EventFamily,
): boolean {
  const words = wordsOf(sentence);
  return acts(words, direction.target, family) && !acts(words, direction.actor, family);
}

function normalize(text: string): string {
  return ` ${(text ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;
}

function hasForm(normalized: string, form: string): boolean {
  return normalized.includes(` ${normalize(form).trim()} `);
}

/** Every family the text states, in table order. */
export function eventFamiliesIn(text: string): EventFamily[] {
  const normalized = normalize(text);
  return EVENT_FAMILIES.filter((family) => family.forms.some((form) => hasForm(normalized, form)));
}

/** Does this one sentence name the entity (name, demonym or curated city)? */
export function sentenceNamesEntity(sentence: string, entity: CountryMeta): boolean {
  return scoreCountryRelevance({ title: sentence, summary: '' }, entity).isRelevant;
}

/** The countries a question names, in the order it names them. */
export function countriesNamedIn(text: string): CountryMeta[] {
  const lower = text.toLowerCase();
  return COUNTRIES.filter((country) => sentenceNamesEntity(text, country))
    .map((country) => {
      const at = lower.indexOf(country.name.toLowerCase());
      return { country, at: at === -1 ? Number.MAX_SAFE_INTEGER : at };
    })
    .sort((a, b) => a.at - b.at)
    .map(({ country }) => country);
}

/**
 * The shape, or null. EXACTLY two named countries and EXACTLY one event family; English only.
 */
export function readRelationalEventQuestion(
  question: string,
  language: string = 'en',
): RelationalEventQuestion | null {
  if (language !== 'en') return null;
  const families = eventFamiliesIn(question);
  if (families.length !== 1) return null;
  const countries = countriesNamedIn(question);
  if (countries.length !== 2) return null;
  const [a, b] = countries as [CountryMeta, CountryMeta];
  const [family] = families as [EventFamily];
  return {
    entities: [a, b],
    family,
    providerQuery: `${a.name} ${b.name} ${family.query}`,
    direction: readDirection(question, [a, b], family),
  };
}

function sentenceCarries(
  sentence: string,
  entities: readonly CountryMeta[],
  family: EventFamily,
): { all: boolean; any: boolean } {
  const hits = [
    ...entities.map((entity) => sentenceNamesEntity(sentence, entity)),
    family.forms.some((form) => hasForm(normalize(sentence), form)),
  ];
  return { all: hits.every(Boolean), any: hits.some(Boolean) };
}

/**
 * THE RELATIONSHIP-AWARE GATE. Both entities AND the event family, stated together: in the
 * headline, or in ONE summary sentence while the headline carries at least one of them.
 */
export function scoreRelationalEventRelevance(
  article: Pick<NewsArticle, 'title' | 'summary'>,
  entities: readonly CountryMeta[],
  family: EventFamily,
  /** INTELLIGENCE BINDING R1 (§10) — when the question states a direction, a sentence stating
      the opposite direction never supports it. Absent → the landed symmetric gate. */
  direction: { actor: CountryMeta; target: CountryMeta } | null = null,
): { isRelevant: boolean; reasons: string[] } {
  const title = article.title ?? '';
  const headline = sentenceCarries(title, entities, family);
  const reversed = (sentence: string): boolean =>
    direction !== null && statesReversedDirection(sentence, direction, family);
  if (headline.all && !reversed(title)) {
    return { isRelevant: true, reasons: ['entities + event (title)'] };
  }
  if (!headline.any) {
    return { isRelevant: false, reasons: ['headline names neither entity nor the event'] };
  }
  for (const sentence of (article.summary ?? '').split(/(?<=[.!?])\s+/)) {
    if (sentenceCarries(sentence, entities, family).all && !reversed(sentence)) {
      return {
        isRelevant: true,
        reasons: ['entities + event (summary sentence, headline-anchored)'],
      };
    }
  }
  return { isRelevant: false, reasons: ['the entities and the event never meet in one sentence'] };
}

export function eventFamily(id: EventFamilyId): EventFamily {
  const found = EVENT_FAMILIES.find((family) => family.id === id);
  if (found === undefined) throw new Error(`Unknown event family ${id}`);
  return found;
}
