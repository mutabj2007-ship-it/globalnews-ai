import type { CountryMeta, LanguageCode, NewsArticle } from '@globalnews-ai/shared';
import { resolveCountryByAnyIdentifier } from '@globalnews-ai/shared';
import { resolvePrimaryCountry, scoreCountryRelevance } from '../country/country-relevance.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK PUBLIC BETA RETRIEVAL REPAIR R1 — ADMISSION FOR A COMPOUND RETRIEVAL PLAN
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MEASURED DEFECT (Production operation 5944db16). The question "What are the most recent
 * verified security or territorial changes in eastern Democratic Republic of the Congo, and
 * what effects on civilians or displacement are currently reported? Separate confirmed facts
 * …" matched no subject frame, so the whole sentence (stop-words removed, ~35 AND terms) was
 * both the provider query and the phrase the generic gate demanded. No article can carry
 * every one of those words, so the answer was "0 matching reports" while eastern-DRC
 * reporting existed.
 *
 * A compound question is now retrieved by a bounded, deterministic plan
 * (analysis/query/compound-retrieval-plan.util.ts) and each candidate is admitted HERE on the
 * three things the reader actually asked for, never on the wording of the question:
 *
 *   1  COUNTRY   the unmodified `scoreCountryRelevance()` for the resolved country, in the
 *                article's OWN language (so a French report is read with the French country
 *                forms). An article whose own primary country is a different one is refused
 *                unless it also carries the reader's governed sub-national scope — this is
 *                what keeps Republic of the Congo reporting out of a DRC answer.
 *   2  SCOPE     when the reader qualified the country ("eastern"), the article must name a
 *                governed place inside that part of the country, or the qualified country
 *                itself. The places come from the governed gazetteer; none is written here.
 *   3  FACET     the article must speak to at least one of the topics the reader asked about
 *                (security / humanitarian), in a closed English + French vocabulary.
 *
 * NO THRESHOLD MOVES and no other mode is touched: this is a separate RelevanceMode that
 * exactly one caller (AnalysisService's generic branch) opts into.
 */

export type CompoundFacet = 'SECURITY' | 'HUMANITARIAN';

/** A folded phrase naming the qualified country ("eastern drc", "est de la rdc"). */
export interface QualifiedCountryPhrase {
  readonly phrase: string;
  /**
   * Present when the country form inside the phrase is also another country's name ("congo" is
   * the Republic of the Congo's registry name): the phrase then counts only in a text that
   * carries none of these folded markers of that other country ("brazzaville", …).
   */
  readonly unlessAny?: readonly string[];
}

export interface CompoundRetrievalScope {
  /** The reader's compass qualifier, as typed ("eastern"). */
  readonly qualifier: string;
  /** Folded governed place names inside that part of the country (regions + major towns). */
  readonly places: readonly string[];
  /** The qualified country named directly — scope AND country evidence. */
  readonly countryPhrases: readonly QualifiedCountryPhrase[];
  /**
   * The country's own folded name forms. Removed before a marker is looked for, because
   * "republic of the congo" (COG) sits inside "democratic republic of the congo" (COD).
   */
  readonly ownForms: readonly string[];
  /** Scope stated without naming the country ("eastern part of the country", "est du pays"). */
  readonly plainPhrases: readonly string[];
}

export interface CompoundRetrievalPlanAdmission {
  readonly iso3: string;
  readonly scope: CompoundRetrievalScope | null;
  readonly facets: readonly CompoundFacet[];
}

/**
 * Word-prefix stems (folded) and exact short words, EN + FR.
 *
 * BETA-ASK-004 — RELEVANCE COHERENCE. Production admitted "12 dead, dozens missing after vessel
 * capsizes in eastern Congo's Lake Kivu" for a security + displacement question, because a bare
 * mortality word ("dead") satisfied the humanitarian facet. The vocabulary is therefore split by
 * what each word can PROVE:
 *
 *   CONFLICT            a security / armed-conflict nexus. Alone it satisfies SECURITY.
 *   RESPONSE            displacement, refugees, humanitarian response. Alone it satisfies
 *                       HUMANITARIAN — it is explicitly the humanitarian leg of the question.
 *   MORTALITY           dead / killed / victims / casualties / civilians. NEVER alone: it
 *                       satisfies HUMANITARIAN only together with a CONFLICT term ("civilians
 *                       killed in an attack"), because death has many non-conflict causes.
 *   NON_CONFLICT_HARM   boat / road / air accidents, disease, natural disasters, ordinary crime.
 *                       An article carrying one of these and NO conflict term is not evidence for
 *                       either facet, whatever else it says.
 */
interface Vocabulary {
  readonly stems: readonly string[];
  readonly words: readonly string[];
}

const CONFLICT: Vocabulary = {
  stems: [
    'fight',
    'clash',
    'attack',
    'armed',
    'rebel',
    'militia',
    'military',
    'milice',
    'militaire',
    'soldier',
    'soldat',
    'troops',
    'violen',
    'conflict',
    'conflit',
    'offensive',
    'ceasefire',
    'cessez',
    'seize',
    'seizing',
    'captur',
    'frontline',
    'insurg',
    'gunmen',
    'gunfire',
    'shelling',
    'bombard',
    'massacre',
    'ambush',
    'territor',
    'combat',
    'affrontement',
    'attaque',
    'guerre',
    'empare',
    'security',
    'securit',
  ],
  words: ['army', 'war', 'armee', 'arme', 'fardc', 'raid', 'raids', 'drone'],
};

const RESPONSE: Vocabulary = {
  stems: [
    'displace',
    'deplace',
    'refugee',
    'refugie',
    'humanitar',
    'evacuat',
    'fleeing',
    'shelter',
    'famine',
    /* R1B — people returning after displacement are the displacement story too. */
    'returnee',
  ],
  words: ['aid', 'fled', 'flee', 'flees', 'camp', 'camps', 'fui', 'fuir', 'fuite', 'exode'],
};

const MORTALITY: Vocabulary = {
  stems: ['civilian', 'civils', 'casualt', 'victim', 'wounded', 'injur', 'blesse'],
  words: [
    'dead',
    'death',
    'deaths',
    'killed',
    'killing',
    'killings',
    'morts',
    'mort',
    'tues',
    'tue',
    'civil',
  ],
};

const NON_CONFLICT_HARM: Vocabulary = {
  stems: [
    'capsiz',
    'shipwreck',
    'drown',
    'naufrag',
    'noyade',
    'chavir',
    'derail',
    'collision',
    'accident',
    'landslide',
    'glissement',
    'earthquake',
    'seisme',
    'eruption',
    'volcan',
    'flood',
    'inondation',
    'lightning',
    'foudre',
    'epidemi',
    'outbreak',
    'ebola',
    'cholera',
    'measles',
    'rougeole',
    'malaria',
    'paludisme',
    'disease',
    'maladie',
    'robbery',
    'burglar',
    'braquage',
  ],
  words: [
    'boat',
    'boats',
    'vessel',
    'ferry',
    'canoe',
    'pirogue',
    'bateau',
    'embarcation',
    'barge',
    'mpox',
    'storm',
    'theft',
    'crash',
  ],
};

/*
  BETA-ASK-004 R1B — NON-CONFLICT HARM NEEDS A MATERIAL ARMED-CONFLICT NEXUS.

  Production admitted "Efforts Show Promise in Fighting Congo's Ebola Outbreak" (summary: "…
  security issues …") for the eastern-DRC security + displacement plan: the idiom "fighting
  Ebola" matched the conflict stem "fight" and "security issues" matched "security", which was
  enough to lift the disease exclusion. Two corrections, both deterministic:

  1  NON-ARMED IDIOMS are removed before any conflict word is read — fighting / fight against /
     battling / combating / war on a disease, outbreak, hunger, fire or flood (EN + FR "lutte
     contre"), "security issues / challenges / concerns / risks", and health / food security.
     They never establish armed conflict, for any article.
  2  An article carrying NON_CONFLICT_HARM vocabulary (disease, disaster, accident, ordinary crime)
     must ALSO carry STRONG armed-conflict evidence — armed groups, clashes, troops, shelling, an
     offensive, a ceasefire, or "fighting" that is not one of the idioms above. "Security",
     "violence", "conflict" or "war" alone stay ordinary conflict vocabulary for non-harm
     articles, and are not enough to lift the harm exclusion.
*/
const NON_ARMED_IDIOMS: readonly RegExp[] = [
  /* The words between the verb and the disease may qualify it ("fighting Congo's Ebola outbreak")
     but never place it ("fighting IN the Ebola-hit region" is armed fighting). */
  /\b(?:fight|fights|fighting|fought|battle|battles|battling|combat|combats|combating|combatting|war\s+on|tackle|tackling)\s+(?:against\s+|on\s+)?(?:the\s+)?(?:(?!(?:in|near|around|across|amid|as|while|and|despite|after|during|with|by|from|over|between)\b)[a-z]+\s+){0,3}?(?:ebola|cholera|disease|diseases|outbreak|outbreaks|epidemic|epidemics|pandemic|virus|viruses|malaria|mpox|measles|covid|polio|tuberculosis|hiv|aids|hunger|poverty|corruption|fire|fires|wildfire|wildfires|blaze|flood|floods|inflation|malnutrition|infection|infections)\b/g,
  /\blutte\s+contre\s+(?:la\s+|le\s+|les\s+|l\s+)?(?:[a-z]+\s+){0,3}?(?:ebola|cholera|maladie|maladies|epidemie|epidemies|pandemie|virus|paludisme|rougeole|mpox|faim|pauvrete|corruption|incendie|incendies)\b/g,
  /\b(?:security|securite)\s+(?:issue|issues|challenge|challenges|concern|concerns|risk|risks|problem|problems|constraint|constraints|considerations?)\b/g,
  /\b(?:health|food|energy|water|job|social|cyber|data|financial)\s+security\b/g,
  /\bsecurite\s+(?:alimentaire|sanitaire|sociale|energetique)\b/g,
  /\bheart\s+attacks?\b/g,
];

/** Strip the non-armed idioms (folded text in, folded text out). */
export function withoutNonArmedIdioms(foldedText: string): string {
  let out = ` ${foldedText} `;
  for (const idiom of NON_ARMED_IDIOMS) out = out.replace(idiom, ' ');
  return out.replace(/\s+/g, ' ').trim();
}

/** Armed-conflict evidence strong enough to lift a NON_CONFLICT_HARM exclusion. */
const STRONG_CONFLICT: Vocabulary = {
  stems: [
    'fight',
    'clash',
    'armed',
    'rebel',
    'militia',
    'military',
    'milice',
    'militaire',
    'soldier',
    'soldat',
    'troops',
    'insurg',
    'gunmen',
    'gunfire',
    'shelling',
    'bombard',
    'massacre',
    'ambush',
    'frontline',
    'offensive',
    'ceasefire',
    'cessez',
    'affrontement',
    'attack',
    'attaque',
    'combat',
    'guerre',
    'empare',
    'seize',
    'seizing',
    'captur',
  ],
  words: ['army', 'armee', 'arme', 'fardc', 'raid', 'raids', 'drone'],
};

function matches(tokens: readonly string[], vocabulary: Vocabulary): boolean {
  return tokens.some(
    (token) =>
      vocabulary.words.includes(token) || vocabulary.stems.some((stem) => token.startsWith(stem)),
  );
}

/** Lowercase, strip diacritics, and keep letters/numbers only — the matching fold. */
export function foldForPlan(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsPhrase(folded: string, phrase: string): boolean {
  return phrase.length > 0 && ` ${folded} `.includes(` ${phrase} `);
}

export function articleSpeaksToFacet(foldedText: string, facet: CompoundFacet): boolean {
  /* R1B — idioms ("fighting Ebola", "security issues") are not armed conflict, anywhere. */
  const tokens = withoutNonArmedIdioms(foldedText).split(' ');
  const conflict = matches(tokens, CONFLICT);
  /* An accident, an epidemic, a flood or a robbery answers neither leg unless the text carries
     STRONG armed-conflict evidence — a generic conflict word is not a material nexus. */
  if (matches(foldedText.split(' '), NON_CONFLICT_HARM) && !matches(tokens, STRONG_CONFLICT)) {
    return false;
  }
  if (facet === 'SECURITY') return conflict;
  /* HUMANITARIAN: explicit displacement / response, or conflict-linked harm to people. */
  return matches(tokens, RESPONSE) || (conflict && matches(tokens, MORTALITY));
}

export function namesQualifiedCountry(foldedText: string, scope: CompoundRetrievalScope): boolean {
  let withoutOwn = ` ${foldedText} `;
  for (const form of [...scope.ownForms].sort((a, b) => b.length - a.length)) {
    withoutOwn = withoutOwn.split(` ${form} `).join(' | ');
  }
  return scope.countryPhrases.some(
    ({ phrase, unlessAny }) =>
      containsPhrase(foldedText, phrase) &&
      !(unlessAny ?? []).some((marker) => withoutOwn.includes(` ${marker} `)),
  );
}

export function namesScopePlace(foldedText: string, scope: CompoundRetrievalScope): boolean {
  return scope.places.some((place) => containsPhrase(foldedText, place));
}

export function articleInScope(foldedText: string, scope: CompoundRetrievalScope): boolean {
  return (
    namesScopePlace(foldedText, scope) ||
    namesQualifiedCountry(foldedText, scope) ||
    scope.plainPhrases.some((phrase) => containsPhrase(foldedText, phrase))
  );
}

function articleLanguage(article: Pick<NewsArticle, 'sourceLanguage'>): LanguageCode | undefined {
  const language = article.sourceLanguage?.trim().toLowerCase();
  return language === undefined || language.length === 0 || language === 'en'
    ? undefined
    : (language as LanguageCode);
}

export interface CompoundPlanRelevance {
  readonly isRelevant: boolean;
  readonly country: boolean;
  readonly scope: boolean;
  readonly facets: readonly CompoundFacet[];
}

export function scoreCompoundPlanRelevance(
  article: Pick<NewsArticle, 'title' | 'summary' | 'sourceLanguage'>,
  plan: CompoundRetrievalPlanAdmission,
): CompoundPlanRelevance {
  const country: CountryMeta | undefined = resolveCountryByAnyIdentifier(plan.iso3);
  if (country === undefined) return { isRelevant: false, country: false, scope: false, facets: [] };

  const text = `${article.title ?? ''} ${article.summary ?? ''}`;
  const folded = foldForPlan(text);
  const language = articleLanguage(article);

  const scope = plan.scope;
  const inScope = scope === null ? true : articleInScope(folded, scope);
  const countryScore = scoreCountryRelevance(article, country, language);
  const primary = resolvePrimaryCountry(article, language)?.countryCode;
  const namedQualified = scope !== null && namesQualifiedCountry(folded, scope);
  /*
    COUNTRY EVIDENCE. The unmodified scorer, OR the qualified country named outright ("l'est de
    la RDC" — the scorer deliberately ignores single-token aliases such as "RDC" in prose), OR a
    governed in-scope place when the text leans to this country or to none (a governed place is
    inside the country by construction, but "Beni" is also a name elsewhere).
  */
  const countryEvidence =
    countryScore.isRelevant ||
    namedQualified ||
    (scope !== null &&
      namesScopePlace(folded, scope) &&
      (countryScore.score > 0 || primary === undefined || primary === country.iso2));
  /* A different primary country contradicts everything but a direct naming of this one. */
  const contradicted =
    primary !== undefined &&
    primary !== country.iso2 &&
    !countryScore.isRelevant &&
    !namedQualified;
  const facets = plan.facets.filter((facet) => articleSpeaksToFacet(folded, facet));

  return {
    isRelevant: countryEvidence && !contradicted && inScope && facets.length > 0,
    country: countryEvidence && !contradicted,
    scope: inScope,
    facets,
  };
}
