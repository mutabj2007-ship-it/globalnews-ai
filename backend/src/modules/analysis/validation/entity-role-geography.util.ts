/**
 * ============================================================================
 * C911-R2 -- ENTITY + ROLE + GEOGRAPHY RELATION VALIDATION
 * ============================================================================
 *
 * -- THE PRODUCTION ERROR THIS EXISTS TO CATCH --------------------------
 *
 *     "South Africa's Prime Minister Narendra Modi"
 *
 * The words "South Africa", "Prime Minister", "Narendra" and "Modi" were all
 * genuinely present in the retrieved evidence for a South Africa analysis.
 * Every grounding check in this repository therefore PASSED:
 *
 *   resolveEvidenceBasis()   verifies an EXCERPT is a substring of the exact
 *                            evidence text shown to the model. It never reads
 *                            the claim, so it cannot notice that the claim
 *                            asserts something the excerpt does not.
 *
 *   validateSourcedClaims()  verifies a claim cites a REAL article id. Citing
 *                            a real article is not the same as being supported
 *                            by it.
 *
 *   validateEntities()       passes the model's entity string arrays through
 *                            untouched. No grounding of any kind.
 *
 *   extractArticleEntities() records a person's NAME and discards the title
 *                            that identified them and any country qualifier
 *                            attached to it. "India Prime Minister Narendra
 *                            Modi" is stored as the string "Narendra Modi".
 *
 * So validation measured ENTITY OCCURRENCE -- "do these words appear in the
 * evidence" -- and never the tuple that carries the meaning:
 *
 *     ENTITY + ROLE + GEOGRAPHY + RELATION
 *
 * There was no representation anywhere in the system in which "Modi is
 * India's prime minister" could contradict "Modi is South Africa's prime
 * minister", because the role and the geography were thrown away at
 * extraction time. That is the root cause, and it is a MISSING RELATION,
 * not a bad threshold.
 *
 * -- WHY THIS IS NOT A WORLD-KNOWLEDGE DATABASE -------------------------
 *
 * Nothing here knows who governs anywhere. The contradiction is drawn
 * ENTIRELY from the evidence already in hand: the same articles that were
 * shown to the model say "India Prime Minister Narendra Modi", and that is
 * the only reason this module can say the brief is wrong. Remove the
 * evidence and this module has no opinion at all.
 *
 * That is deliberate. A curated table of heads of government would be a
 * second source of truth that goes stale every election, in a repository
 * whose entire geography model is built on evidence rather than assertion.
 *
 * -- IT FAILS CLOSED ONLY ON A POSITIVE CONTRADICTION -------------------
 *
 *   evidence attributes the person to a DIFFERENT country  -> CONTRADICTED
 *   evidence attributes the person to the SAME country     -> supported
 *   evidence attributes the person to no country at all    -> NO OPINION
 *   the candidate text attributes no country to a person   -> NO OPINION
 *
 * Absence is never treated as contradiction. This is the same rule
 * resolvePrimaryCountry() already applies -- "absence of a competing country
 * is not evidence of a competing country" -- and it is what keeps the
 * examples the product must KEEP admissible:
 *
 *     "Prime Minister of India Narendra Modi ..."      supported
 *     "South African President Cyril Ramaphosa ..."    supported
 *     "Narendra Modi met South African officials"      no attribution to Modi
 *     "India's prime minister discussed South Africa"  no person named
 *
 * and rejects exactly the shape that was reported:
 *
 *     "South Africa's Prime Minister Narendra Modi"    CONTRADICTED
 *
 * -- ONE TABLE, NOT A SECOND ONE ----------------------------------------
 *
 * Country identity comes from COUNTRIES and COUNTRY_DEMONYMS_BY_ISO3, the
 * tables that already back country relevance scoring, read through this
 * repository's own normalizer. Person titles come from PERSON_TITLES in
 * article-entities.util.ts, the list that already drives person extraction.
 * This module introduces no geography vocabulary and no new title.
 */
import type { NewsArticle } from '@globalnews-ai/shared';

import type { BriefComplianceVerdict } from './brief-compliance.util';
import { COUNTRIES } from '@globalnews-ai/shared';

import { PERSON_TITLES } from '../../news/analysis/article-entities.util';
import {
  COUNTRY_DEMONYMS_BY_ISO3,
  normalizeForCountryMatch,
} from '../../news/country/country-relevance.util';

/** A person attributed a role, and the country that role was attributed to. */
export interface RoleAttribution {
  /** The person's name exactly as written. */
  readonly person: string;
  /** Lower-cased comparison key for the person. */
  readonly personKey: string;
  /** The title that identified them, lower-cased (e.g. 'prime minister'). */
  readonly role: string;
  /** ISO3 of the country the role was attributed to. */
  readonly countryIso3: string;
  /** The matched span, for diagnostics and test evidence. */
  readonly surface: string;
}

export interface RoleContradiction {
  readonly person: string;
  readonly role: string;
  /** What the candidate text claimed. */
  readonly claimedCountryIso3: string;
  /** What the supplied evidence actually attests. */
  readonly evidenceCountryIso3: string;
  readonly claimedSurface: string;
  readonly evidenceSurface: string;
  readonly reason: string;
}

/**
 * Every surface form that NAMES a country, mapped to its ISO3.
 *
 * Built once. Longer forms are matched first so "South Africa" can never be
 * consumed by a shorter form that is a prefix of it, and so a demonym like
 * "south african" wins over nothing at all.
 */
const COUNTRY_FORMS: ReadonlyArray<{ form: string; iso3: string }> = (() => {
  const forms: Array<{ form: string; iso3: string }> = [];

  for (const country of COUNTRIES) {
    const demonyms = COUNTRY_DEMONYMS_BY_ISO3[country.iso3] ?? [];

    for (const raw of [country.name, ...demonyms]) {
      const form = normalizeForCountryMatch(raw);

      if (form.length > 0) {
        forms.push({ form, iso3: country.iso3 });
      }
    }
  }

  return forms.sort((a, b) => b.form.length - a.form.length);
})();

/** Titles, longest first, so 'prime minister' is never matched as 'minister'. */
const TITLES_LONGEST_FIRST: readonly string[] = [...PERSON_TITLES]
  .map((t) => t.toLowerCase())
  .sort((a, b) => b.length - a.length);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const NAME_TOKEN = "[A-Z][a-zA-ZÀ-ÖØ-öø-ÿ'’.-]+";
const NAME_PATTERN = `${NAME_TOKEN}(?:\\s+${NAME_TOKEN}){1,2}`;

const COUNTRY_ALTERNATION = COUNTRY_FORMS.map((c) => escapeRegExp(c.form)).join('|');
const TITLE_ALTERNATION = TITLES_LONGEST_FIRST.map(escapeRegExp).join('|');

/**
 * The four attribution shapes this module recognises. Each one BINDS a
 * country to a titled person; a shape that binds a country to something
 * other than a named person is deliberately absent, which is why
 * "met South African officials" produces no attribution.
 *
 *   1  <Country>'s <Title> <Name>      "South Africa's Prime Minister Modi"
 *   2  <Country|Demonym> <Title> <Name> "India Prime Minister Narendra Modi"
 *   3  <Title> of <Country> <Name>     "Prime Minister of India Narendra Modi"
 *   4  <Title> <Name> of <Country>     "Prime Minister Narendra Modi of India"
 */
const PATTERNS: ReadonlyArray<{
  readonly regex: RegExp;
  readonly countryGroup: number;
  readonly titleGroup: number;
  readonly nameGroup: number;
}> = [
  {
    // 1 and 2 share one expression: the possessive is optional.
    regex: new RegExp(
      `\\b(${COUNTRY_ALTERNATION})(?:'s|’s)?\\s+(${TITLE_ALTERNATION})\\s+(${NAME_PATTERN})`,
      'gi',
    ),
    countryGroup: 1,
    titleGroup: 2,
    nameGroup: 3,
  },
  {
    regex: new RegExp(
      `\\b(${TITLE_ALTERNATION})\\s+of\\s+(${COUNTRY_ALTERNATION})\\s+(${NAME_PATTERN})`,
      'gi',
    ),
    countryGroup: 2,
    titleGroup: 1,
    nameGroup: 3,
  },
  {
    regex: new RegExp(
      `\\b(${TITLE_ALTERNATION})\\s+(${NAME_PATTERN})\\s+of\\s+(${COUNTRY_ALTERNATION})\\b`,
      'gi',
    ),
    countryGroup: 3,
    titleGroup: 1,
    nameGroup: 2,
  },
];

const ISO3_BY_FORM: ReadonlyMap<string, string> = new Map(
  COUNTRY_FORMS.map((c) => [c.form, c.iso3] as const),
);

function personKeyOf(name: string): string {
  return name.toLowerCase().replace(/[.'’]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * The capitalised leading run of `captured`, or '' when there is not one of at
 * least two tokens.
 *
 * WHY THIS IS CODE AND NOT PART OF THE PATTERN. The country and title
 * alternations must match in any case ("India"/"india", "Prime Minister"/
 * "prime minister"), which forces the /i flag onto the whole expression -- and
 * under /i the name token's `[A-Z]` matches lower-case too, so "Narendra Modi
 * spoke." captured the verb as a third name token. Measured, and it is why
 * this function exists rather than a cleverer regex: the capitalisation rule
 * is a property of NAMES ONLY, so it is enforced only on the name.
 */
const CAPITALISED_TOKEN = /^[A-Z][a-zA-ZÀ-ÖØ-öø-ÿ'’.-]*$/;

function capitalisedNameRun(captured: string): string {
  const tokens = captured.trim().split(/\s+/);
  const kept: string[] = [];

  for (const token of tokens) {
    if (!CAPITALISED_TOKEN.test(token)) break;
    kept.push(token);
  }

  // A single capitalised token is not a person for this module's purposes --
  // it is as likely to be a sentence-initial word or an organisation. The
  // extraction pattern already demands two, and this keeps that guarantee
  // after the run is trimmed.
  return kept.length >= 2 ? kept.join(' ') : '';
}

/**
 * Every (person, role, country) attribution the text actually makes.
 *
 * Text is read as written -- no normalization that would destroy the
 * capitalisation the name pattern depends on.
 */
export function extractRoleAttributions(text: string): RoleAttribution[] {
  const source = text ?? '';

  if (source.trim().length === 0) return [];

  const found: RoleAttribution[] = [];
  const seen = new Set<string>();

  for (const pattern of PATTERNS) {
    // A fresh RegExp per call: the module-level ones carry /g lastIndex state
    // and this function must be re-entrant.
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(source)) !== null) {
      const countryForm = normalizeForCountryMatch(match[pattern.countryGroup] ?? '');
      const iso3 = ISO3_BY_FORM.get(countryForm);

      if (!iso3) continue;

      const person = capitalisedNameRun(match[pattern.nameGroup] ?? '');

      if (person.length === 0) continue;

      const key = personKeyOf(person);

      if (key.length === 0) continue;

      const role = (match[pattern.titleGroup] ?? '').toLowerCase().trim();
      const dedupeKey = `${key}|${role}|${iso3}`;

      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      found.push({
        person,
        personKey: key,
        role,
        countryIso3: iso3,
        surface: match[0].trim(),
      });
    }
  }

  return found;
}

/** Every attribution the supplied evidence makes, across all articles. */
export function extractEvidenceAttributions(
  articles: ReadonlyArray<Pick<NewsArticle, 'title' | 'summary'>>,
): RoleAttribution[] {
  const all: RoleAttribution[] = [];

  for (const article of articles) {
    const text = `${article.title ?? ''}. ${article.summary ?? ''}`;

    all.push(...extractRoleAttributions(text));
  }

  return all;
}

/**
 * Attributions in `candidateText` that the supplied evidence CONTRADICTS.
 *
 * A contradiction requires the evidence to positively attribute the SAME
 * person to a DIFFERENT country. Silence in the evidence is never a
 * contradiction, and an attribution the evidence agrees with anywhere is
 * supported even if another article is silent.
 */
export function findRoleContradictions(
  candidateText: string,
  evidence: ReadonlyArray<Pick<NewsArticle, 'title' | 'summary'>>,
): RoleContradiction[] {
  return findContradictionsAgainst(candidateText, extractEvidenceAttributions(evidence));
}

/**
 * The same verdict against attributions that have ALREADY been extracted.
 *
 * `validateAnalysisResult` validates many claims against one evidence set, so
 * the evidence is read once per request rather than once per claim. Identical
 * semantics to findRoleContradictions() -- that function is this one with the
 * extraction inlined.
 */
export function findContradictionsAgainst(
  candidateText: string,
  attested: ReadonlyArray<RoleAttribution>,
): RoleContradiction[] {
  const claimed = extractRoleAttributions(candidateText);

  if (claimed.length === 0) return [];
  if (attested.length === 0) return [];

  const contradictions: RoleContradiction[] = [];

  for (const claim of claimed) {
    const forPerson = attested.filter((a) => a.personKey === claim.personKey);

    if (forPerson.length === 0) continue;

    // Supported anywhere in the evidence wins -- a person may legitimately be
    // attributed to one country by one outlet and described without a country
    // by another.
    if (forPerson.some((a) => a.countryIso3 === claim.countryIso3)) continue;

    const conflicting = forPerson[0];

    contradictions.push({
      person: claim.person,
      role: claim.role,
      claimedCountryIso3: claim.countryIso3,
      evidenceCountryIso3: conflicting.countryIso3,
      claimedSurface: claim.surface,
      evidenceSurface: conflicting.surface,
      reason:
        `the text attributes ${claim.person} to ${claim.countryIso3}, ` +
        `but the supplied evidence attributes the same person to ${conflicting.countryIso3}`,
    });
  }

  return contradictions;
}

/**
 * ============================================================================
 * C911-R11 -- THE EXECUTIVE BRIEF ITSELF
 * ============================================================================
 *
 * -- WHY R1 DID NOT CLOSE THE REPORTED DEFECT --------------------------
 *
 * C911-R1 wired this module into `validateSourcedClaims`, so a CLAIM that
 * contradicts the evidence is dropped. But the reported Production error was
 * never in a claim. It was in the user-visible Executive Brief:
 *
 *     "South Africa's Prime Minister Narendra Modi"
 *
 * A reader sees the brief. Protecting the claims and leaving the brief
 * unguarded closes the smaller half of the defect.
 *
 * -- THE CTO PRODUCT RULING THIS IMPLEMENTS -----------------------------
 *
 * The two-state availability vocabulary is UNCHANGED. No third state is
 * added. `withheld-non-compliant` is authorized to cover a brief that
 * positively contradicts the supplied evidence on an entity + role +
 * geography relationship, because that IS a compliance failure -- not a new
 * kind of partial acceptance.
 *
 * -- WHY THE STRUCTURAL CHECK IS NOT TOUCHED ----------------------------
 *
 * `assessBriefCompliance()` measures paragraph shape against measured
 * evidence breadth. Its threshold, its inputs and its reasoning are accepted
 * and are not modified here -- this function COMPOSES with its verdict
 * instead. A brief that already failed structurally stays failed, with its
 * original reason intact; a brief that passed structurally can still fail
 * here, on relation integrity.
 *
 * That ordering matters: the structural reason is the one the C910 work
 * established, and it must not be overwritten by this newer one.
 *
 * -- WHAT IT WILL NOT DO ------------------------------------------------
 *
 * It does not rewrite the brief. It does not "correct" a country or a title
 * in generated prose -- silently repairing a factual claim would be a worse
 * failure than withholding it, because the reader would have no way to know
 * the product had edited a fact. It makes no provider call, requests no
 * repair and performs no retrieval. It returns a verdict; the existing
 * `withholdExecutiveBrief()` does the withholding, exactly as it does today.
 *
 * FAIL CLOSED RATHER THAN FABRICATE.
 */
export function applyBriefRelationIntegrity(
  structuralVerdict: BriefComplianceVerdict,
  summary: string,
  evidence: ReadonlyArray<Pick<NewsArticle, 'title' | 'summary'>>,
): BriefComplianceVerdict {
  // A brief that already failed keeps its ORIGINAL reason. The structural
  // finding is the accepted one and this must not mask it.
  if (!structuralVerdict.compliant) return structuralVerdict;

  const text = summary ?? '';

  // A withheld brief is an empty string. There is nothing to contradict, and
  // re-judging it here would be judging the absence of prose.
  if (text.trim().length === 0) return structuralVerdict;

  const contradictions = findRoleContradictions(text, evidence);

  if (contradictions.length === 0) return structuralVerdict;

  const first = contradictions[0];

  return {
    compliant: false,
    paragraphs: structuralVerdict.paragraphs,
    breadth: structuralVerdict.breadth,
    reason:
      `The brief attributes ${first.person} to ${first.claimedCountryIso3}, but the supplied ` +
      `evidence attributes the same person to ${first.evidenceCountryIso3}. An executive brief ` +
      'that contradicts its own evidence on an entity, role and geography relationship is not a ' +
      'compliant brief.',
  };
}
