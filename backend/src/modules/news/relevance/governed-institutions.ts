/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK CURRENT REPORTING FINAL CLOSURE R1 (M2) — GOVERNED INSTITUTIONS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * THE MEASURED DEFECT. "What is the current policy interest rate of the National Bank of
 * Poland, and when was it last changed?" retrieved nothing usable on Alpha:
 *
 *   1  no place resolved ("of Poland" is not a location preposition and "National Bank" is
 *      not an office head noun), so the question took the generic branch;
 *   2  the whole sentence became the provider query, and GDELT's bounded 12-term expression
 *      cut "poland" off the end;
 *   3  the generic relevance gate then demanded that whole sentence (or every one of its
 *      words) inside a headline, which no headline contains;
 *   4  nothing knew that NBP, the National Bank of Poland and Narodowy Bank Polski are one
 *      institution, so Polish reporting ("RPP obniżyła stopy procentowe") could never match.
 *
 * THE REPAIR IS A CLOSED, REVIEWED TABLE — no stemming, no dictionary, no model call, no
 * provider. One institution family, and one status subject it can be asked about. A question
 * is shaped by this module ONLY when it names BOTH a governed institution form AND one of that
 * institution's governed status-subject forms; every other question reaches exactly the code
 * it reached before (the generic equivalence classes in governed-term-parity.ts are untouched,
 * so "interest rate" queries about anything else admit exactly what they admitted before).
 *
 * WHAT THE SHAPE CHANGES, AND WHAT IT DOES NOT.
 *   - The provider query leads with the COUNTRY ANCHOR ("Poland interest rate"), short enough
 *     that no bounded provider expression can truncate the anchor away.
 *   - Relevance for this shape is institution AND subject, by governed forms, in the headline
 *     or in one headline-anchored summary sentence — the same locality bounds the existing
 *     parity rule uses. It is NOT looser than that rule: an article must name the institution
 *     (or its rate-setting council) AND the status subject; a Polish mortgage-rate story that
 *     never names the central bank is not admitted.
 *   - Routing is untouched. This is retrieval shaping inside the one approved Analysis path;
 *     the Ask plan, its evidence requirements and every sufficiency rule stay as they were.
 *   - Nothing here is an official source. Reporting ABOUT the NBP is still reporting.
 */

export type GovernedInstitutionId = 'PL_NBP';

export interface GovernedStatusSubject {
  readonly id: 'POLICY_RATE';
  /** Whole-word, case-insensitive forms (EN + the PL inflections reporting uses). */
  readonly forms: readonly string[];
  /** The subject words sent to providers after the anchor. */
  readonly query: string;
}

export interface GovernedInstitution {
  readonly id: GovernedInstitutionId;
  readonly countryIso3: string;
  /**
   * The retrieval anchor that must lead every provider query: the country's English name,
   * because that is the form the fallback tier recognises as "this publisher's own country"
   * (RssFeedProvider.isOwnCountryQuery) — so Polish publishers' recent records are offered to
   * the gate for a Polish question too, and admitted only through the Polish forms below.
   */
  readonly anchor: string;
  /** Whole-word, case-insensitive name forms (EN + PL inflections). */
  readonly names: readonly string[];
  /** Acronyms, matched CASE-SENSITIVELY as whole tokens ("NBP", never "nbp" inside a word). */
  readonly acronyms: readonly string[];
  readonly subjects: readonly GovernedStatusSubject[];
}

export const GOVERNED_INSTITUTIONS: readonly GovernedInstitution[] = [
  {
    id: 'PL_NBP',
    countryIso3: 'POL',
    anchor: 'Poland',
    names: [
      /* EN */
      'national bank of poland',
      'central bank of poland',
      'polish central bank',
      "poland's central bank",
      /* PL — Narodowy Bank Polski, the reviewed institution form, and its inflections */
      'narodowy bank polski',
      'narodowego banku polskiego',
      'narodowemu bankowi polskiemu',
      'narodowym banku polskim',
      /* the NBP's own rate-setting body, named in almost every rate headline */
      'monetary policy council',
      'rada polityki pieniężnej',
      'rady polityki pieniężnej',
      'radzie polityki pieniężnej',
      'radę polityki pieniężnej',
    ],
    acronyms: ['NBP', 'RPP'],
    subjects: [
      {
        id: 'POLICY_RATE',
        /*
          Phrases, never a bare "rates"/"stopy": "NBP publishes exchange rates" is not a
          policy-rate story, and a bare word would admit it.
        */
        forms: [
          'interest rate',
          'interest rates',
          'policy rate',
          'policy rates',
          'reference rate',
          'benchmark rate',
          'base rate',
          'key rate',
          'main rate',
          'holds rates',
          'keeps rates',
          'leaves rates',
          'cuts rates',
          'raises rates',
          'hikes rates',
          'rates unchanged',
          'rates on hold',
          'stopy procentowe',
          'stóp procentowych',
          'stopach procentowych',
          'stopa procentowa',
          'stopę procentową',
          'stopa referencyjna',
          'stopy referencyjnej',
          'stopę referencyjną',
          'obniżyła stopy',
          'podniosła stopy',
          'nie zmieniła stóp',
          'stopy bez zmian',
        ],
        query: 'interest rate',
      },
    ],
  },
];

/** A question this module shapes: the institution, the subject, and what to send. */
export interface InstitutionalStatusQuestion {
  readonly institution: GovernedInstitution;
  readonly subject: GovernedStatusSubject;
  /** Anchor first, then the subject: the anchor can never be truncated away. */
  readonly providerQuery: string;
}

/** Lower-case, every non letter/digit run is one space — "Poland's" ≡ "poland s". */
function normalizeText(text: string): string {
  return ` ${(text ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;
}

function hasForm(normalized: string, form: string): boolean {
  const f = normalizeText(form).trim();
  return f.length > 0 && normalized.includes(` ${f} `);
}

function hasAcronym(text: string, acronym: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{N}])${acronym}(?![\\p{L}\\p{N}])`, 'u').test(text ?? '');
}

export function namesInstitution(text: string, institution: GovernedInstitution): boolean {
  const normalized = normalizeText(text);
  return (
    institution.names.some((name) => hasForm(normalized, name)) ||
    institution.acronyms.some((acronym) => hasAcronym(text, acronym))
  );
}

export function namesSubject(text: string, subject: GovernedStatusSubject): boolean {
  const normalized = normalizeText(text);
  return subject.forms.some((form) => hasForm(normalized, form));
}

/**
 * The shape, or null. Requires BOTH a governed institution form AND one of its governed
 * status-subject forms in the reader's own question.
 */
export function readInstitutionalStatusQuestion(
  question: string,
): InstitutionalStatusQuestion | null {
  for (const institution of GOVERNED_INSTITUTIONS) {
    if (!namesInstitution(question, institution)) continue;
    const subject = institution.subjects.find((s) => namesSubject(question, s));
    if (subject === undefined) continue;
    return {
      institution,
      subject,
      providerQuery: `${institution.anchor} ${subject.query}`,
    };
  }
  return null;
}

export function governedInstitution(id: GovernedInstitutionId): GovernedInstitution {
  const found = GOVERNED_INSTITUTIONS.find((institution) => institution.id === id);
  if (found === undefined) throw new Error(`Unknown governed institution ${id}`);
  return found;
}

/**
 * THE RELEVANCE GATE FOR THIS SHAPE. The institution AND the subject, both in the headline,
 * or both inside ONE summary sentence while the headline names at least one of them — the
 * same locality bounds as the generic parity rule. Deterministic; no model.
 */
export function scoreInstitutionalStatusRelevance(
  article: { readonly title?: string | null; readonly summary?: string | null },
  institution: GovernedInstitution,
  subject: GovernedStatusSubject,
): { isRelevant: boolean; reasons: string[] } {
  const title = article.title ?? '';
  const summary = article.summary ?? '';
  const titleInstitution = namesInstitution(title, institution);
  const titleSubject = namesSubject(title, subject);
  if (titleInstitution && titleSubject) {
    return { isRelevant: true, reasons: ['governed institution + subject (title)'] };
  }
  if (!titleInstitution && !titleSubject) {
    return {
      isRelevant: false,
      reasons: ['headline names neither the institution nor the subject'],
    };
  }
  const sentences = summary.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    if (namesInstitution(sentence, institution) && namesSubject(sentence, subject)) {
      return {
        isRelevant: true,
        reasons: ['governed institution + subject (summary sentence, headline-anchored)'],
      };
    }
  }
  return { isRelevant: false, reasons: ['institution and subject never meet in one sentence'] };
}
