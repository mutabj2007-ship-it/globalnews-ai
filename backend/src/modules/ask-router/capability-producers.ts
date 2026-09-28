/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE H — CAPABILITY-REQUEST PRODUCERS (S6)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Frozen C models six capability classes through DECLARED inputs — `computationRequested`,
 * `attachmentCount`, `officialRequested`/`officialTerms`, `personalRequested`/`personalScope`
 * and `explicitSpecialistDomains` (its rows B4, B5, O1, B7a–c, D3a) — and states that no
 * landed producer exists for them (baseline fact on the specialist axis; the others are
 * absent from every landed classifier). Main R1.1 MC-047…MC-056 and MC-072…MC-075 measured
 * the consequence on the integrated route: with nothing feeding those inputs, "Solve
 * x^3 - 4x + 1 = 0", "Summarise the PDF I attached" or "What have I saved about Rwanda?"
 * silently became generic news retrieval — the substitution frozen C exists to prevent.
 *
 * These producers feed those inputs from CLOSED, WHOLE-PHRASE markers, EN and PL, each set
 * listed below and nothing inferred beyond it. They produce READINGS OF WHAT THE READER
 * ASKED FOR, never a route: frozen C still decides class, terminal and refusals.
 *
 * Direction of error. A marker that fails to fire leaves today's behaviour (news retrieval
 * with its own honest states). A marker that fires wrongly turns an answerable question into
 * a typed CAPABILITY_UNAVAILABLE / IDENTITY_REQUIRED — visible, costless and never a false
 * answer. So the sets are narrow: a DEFINITION of a computational concept ("What is a
 * derivative in calculus?", "What is CAGR?") stays reference; only an imperative to compute,
 * an equation, or a request over the reader's own figures is computation.
 *
 * All sets are integration-authored and recorded in the seam report for Product review.
 */

import type { EnvelopeSource } from './frozen-c/src/envelope';

export type CapabilityRequestKind =
  | 'COMPUTATION'
  | 'CODE_EXECUTION'
  | 'ATTACHMENT'
  | 'OFFICIAL_ARTIFACT'
  | 'PERSONAL'
  | 'EXPLICIT_SPECIALIST';

export interface CapabilityRequestReading {
  readonly source: Pick<
    EnvelopeSource,
    | 'computationRequested'
    | 'attachmentCount'
    | 'officialRequested'
    | 'officialTerms'
    | 'personalRequested'
    | 'personalScope'
    | 'explicitSpecialistDomains'
  >;
  /** IC-8 trace: which closed marker fired, per kind. Empty when none did. */
  readonly trace: readonly { readonly kind: CapabilityRequestKind; readonly marker: string }[];
}

/* ── COMPUTATION ─────────────────────────────────────────────────────────── */

/** An imperative to compute, at the start of the question. */
const EN_COMPUTE_IMPERATIVE =
  /^\s*(?:please\s+)?(solve|compute|calculate|work\s+out|evaluate|simplify|differentiate|integrate|factori[sz]e)\b/i;
const PL_COMPUTE_IMPERATIVE =
  /^\s*(?:proszę\s+)?(oblicz|policz|rozwiąż|wylicz|oszacuj|zróżniczkuj|scałkuj|uprość)(?=$|[^\p{L}])/iu;
/** An equation: an equals sign with a variable term ("4x", "x^3") on the line. */
const EQUATION =
  /(?:\b\d*[a-z]\s*\^\s*\d|\b\d+[a-z]\b).*=|=.*(?:\b\d*[a-z]\s*\^\s*\d|\b\d+[a-z]\b)/i;
/** A request over the reader's OWN figures, or an engineering design quantity. */
const EN_COMPUTE_OVER =
  /\b(from|using|with)\s+(these|those|my|the\s+following)\s+(figures|numbers|values|data)\b|\bdesign\s+(load|capacity|strength|moment)\b|\b(load|bearing)\s+capacity\s+(of|for)\b/i;
const PL_COMPUTE_OVER =
  /(?:^|[^\p{L}])(z|na\s+podstawie)\s+(tych|moich|poniższych)\s+(danych|liczb|wartości)(?=$|[^\p{L}])|(?:^|[^\p{L}])(obciążeni\p{L}*\s+obliczeniow\p{L}*|nośnoś\p{L}*)(?=$|[^\p{L}])/iu;

/* ── CODE EXECUTION (the computation executor; E1: substrate ABSENT) ──────── */

const EN_RUN_CODE =
  /\b(run|execute)\b[^.?!]*\b(code|snippet|script|program|python|javascript|sql|function)\b/i;
const PL_RUN_CODE =
  /(?:^|[^\p{L}])(uruchom|wykonaj)(?=$|[^\p{L}])[^.?!]*(?:^|[^\p{L}])(kod\p{L}*|skrypt\p{L}*|fragment\p{L}*|program\p{L}*|python\p{L}*)(?=$|[^\p{L}])/iu;

/* ── ATTACHMENT (a reader-held artifact the Ask cannot receive — F: upload HOLD) ── */

const EN_ATTACHED =
  /\b(i|we)\s+(have\s+|'ve\s+)?(attached|uploaded)\b|\battached\s+(file|pdf|document|image|drawing|spreadsheet)\b|\bthe\s+(pdf|file|spreadsheet|image|photo|scan)\s+i\b/i;
const EN_THIS_ARTIFACT =
  /\bth(is|ese)\s+(?:structural\s+|technical\s+|engineering\s+|attached\s+|python\s+|source\s+)?(drawing|drawings|file|files|pdf|spreadsheet|image|photo|picture|scan|diagram|snippet|library|codebase)\b/i;
const PL_ATTACHED =
  /(?:^|[^\p{L}])(załączon\p{L}*|załączam|załączył\p{L}*|przesłan\p{L}*\s+plik\p{L}*|wgran\p{L}*)(?=$|[^\p{L}])/iu;
const PL_THIS_ARTIFACT =
  /(?:^|[^\p{L}])(ten|tego|tym|ta|tej|tę|to|tych)\s+(rysun\p{L}*|plik\p{L}*|pdf|arkusz\p{L}*|obraz\p{L}*|zdjęci\p{L}*|skan\p{L}*|diagram\p{L}*|bibliotek\p{L}*|fragment\p{L}*\s+kodu)(?=$|[^\p{L}])/iu;

/* ── OFFICIAL ARTIFACT ───────────────────────────────────────────────────── */

/**
 * Institutions whose OWN artifact a reader can ask for. Registry names (NISR, Eurostat) and
 * a closed list of statistical / intergovernmental bodies. A publisher is never here: "What
 * does Statistics Poland report about…" is a publisher frame (SOURCE_INTENT), not a request
 * for an artifact — see the artifact-noun requirement below.
 */
const INSTITUTIONS = String.raw`(?:NISR|Eurostat|IPCC|IMF|OECD|UNHCR|OCHA|WHO|World\s+Bank|National\s+Bank\s+of\s+Rwanda|BNR|GUS|NBP|central\s+bank|(?:national\s+)?statistics\s+office|statistical\s+office|bureau\s+of\s+statistics|National\s+Institute\s+of\s+Statistics(?:\s+of\s+\w+)?)`;
/** "per NISR", "according to the IMF" — the reader names the institution as the authority. */
const EN_PER_INSTITUTION = new RegExp(
  String.raw`\b(?:per|according\s+to)\s+(?:the\s+)?(${INSTITUTIONS})\b`,
  'i',
);
/** "the NISR CPI release states…", "the latest IPCC assessment says…" */
const EN_INSTITUTION_ARTIFACT = new RegExp(
  String.raw`\b(${INSTITUTIONS})\b(?:\s+[\w-]+){0,2}\s+(release|bulletin|assessment|communiqu[eé]|gazette|dataset|statistical\s+release)\b[^.?!]*\b(say|says|state|states|show|shows|report|reports)\b`,
  'i',
);
const PL_PER_INSTITUTION = new RegExp(
  String.raw`(?:^|[^\p{L}])(?:według|wg\.?|zdaniem)\s+(${INSTITUTIONS})(?=$|[^\p{L}])`,
  'iu',
);
const PL_INSTITUTION_ARTIFACT = new RegExp(
  String.raw`(?:^|[^\p{L}])(komunikat\p{L}*|biuletyn\p{L}*|raport\p{L}*|publikacj\p{L}*)\s+(${INSTITUTIONS})(?=$|[^\p{L}])`,
  'iu',
);

/* ── PERSONAL (frozen B7: IDENTITY_REQUIRED without a verified identity) ──── */

const EN_PERSONAL_SAVED =
  /\b(my|our)\s+(saved|bookmarked)\b|\b(have|did)\s+i\s+(saved|bookmarked)\b|\bi\s+(have\s+|'ve\s+)?(saved|bookmarked)\b/i;
const EN_PERSONAL_FOLLOWING =
  /\b(have|did)\s+i\s+(been\s+)?follow(ed|ing)\b|\bi\s+(have\s+|'ve\s+)?been\s+following\b|\bmy\s+(interests|watchlist|followed\s+topics)\b/i;
const PL_PERSONAL_SAVED =
  /(?:^|[^\p{L}])(moj\p{L}*|mój)\s+(zapisan\p{L}*|zakład\p{L}*)(?=$|[^\p{L}])|(?:^|[^\p{L}])(zapisał\p{L}*|mam\s+zapisan\p{L}*)(?=$|[^\p{L}])/iu;
const PL_PERSONAL_FOLLOWING =
  /(?:^|[^\p{L}])(śledzę|śledziłe\p{L}*|obserwuję|moje\s+zainteresowania)(?=$|[^\p{L}])/iu;

/* ── EXPLICITLY REQUESTED SPECIALIST (frozen D3a: REQUIRED leg) ──────────── */

/** The specialist the reader names → the analytical domain its leg is keyed by. */
const SPECIALIST_DOMAIN_OF: Readonly<Record<string, string>> = {
  conflict: 'security',
  security: 'security',
  political: 'political',
  economic: 'economic',
  diplomatic: 'diplomatic',
  /* Not an analytical domain: the leg is named, resolves UNREGISTERED, and is withheld. */
  humanitarian: 'humanitarian',
};
const EN_SPECIALIST =
  /\b(conflict|security|political|economic|diplomatic|humanitarian)\s+(specialist|assessment|analyst)\b/i;
const PL_SPECIALIST_OF: Readonly<Record<string, string>> = {
  konfliktu: 'conflict',
  konfliktów: 'conflict',
  bezpieczeństwa: 'security',
  humanitarna: 'humanitarian',
  humanitarnej: 'humanitarian',
  humanitarną: 'humanitarian',
  polityczna: 'political',
  polityczną: 'political',
  ekonomiczna: 'economic',
  ekonomiczną: 'economic',
};
const PL_SPECIALIST =
  /(?:^|[^\p{L}])(?:ocen\p{L}*|specjalist\p{L}*(?:\s+ds\.)?)\s+(konfliktu|konfliktów|bezpieczeństwa|humanitarn\p{L}*|polityczn\p{L}*|ekonomiczn\p{L}*)(?=$|[^\p{L}])/iu;

/**
 * Read what the reader asked the Ask to DO beyond reporting. Pure; no I/O.
 * `hasResolvedArticleAnchor`: "this document" next to a resolved article is the article,
 * not a reader-held artifact, so the attachment reading stands down.
 */
export function readCapabilityRequests(
  text: string,
  language: string,
  opts: { readonly hasResolvedArticleAnchor?: boolean } = {},
): CapabilityRequestReading {
  const pl = language === 'pl';
  const trace: { kind: CapabilityRequestKind; marker: string }[] = [];
  const hit = (kind: CapabilityRequestKind, re: RegExp): boolean => {
    const m = re.exec(text);
    if (m !== null) trace.push({ kind, marker: m[0].trim() });
    return m !== null;
  };

  const computation =
    hit('COMPUTATION', pl ? PL_COMPUTE_IMPERATIVE : EN_COMPUTE_IMPERATIVE) ||
    hit('COMPUTATION', EQUATION) ||
    hit('COMPUTATION', pl ? PL_COMPUTE_OVER : EN_COMPUTE_OVER);
  const code = hit('CODE_EXECUTION', pl ? PL_RUN_CODE : EN_RUN_CODE);
  const attachment =
    opts.hasResolvedArticleAnchor !== true &&
    (hit('ATTACHMENT', pl ? PL_ATTACHED : EN_ATTACHED) ||
      hit('ATTACHMENT', pl ? PL_THIS_ARTIFACT : EN_THIS_ARTIFACT));

  const perInstitution = (pl ? PL_PER_INSTITUTION : EN_PER_INSTITUTION).exec(text);
  const artifact = (pl ? PL_INSTITUTION_ARTIFACT : EN_INSTITUTION_ARTIFACT).exec(text);
  const officialMatch = perInstitution ?? artifact;
  const official = officialMatch !== null;
  if (officialMatch !== null)
    trace.push({ kind: 'OFFICIAL_ARTIFACT', marker: officialMatch[0].trim() });
  const institution = perInstitution?.[1] ?? (pl ? artifact?.[2] : artifact?.[1]);

  const saved = hit('PERSONAL', pl ? PL_PERSONAL_SAVED : EN_PERSONAL_SAVED);
  const following = !saved && hit('PERSONAL', pl ? PL_PERSONAL_FOLLOWING : EN_PERSONAL_FOLLOWING);

  const specialistMatch = (pl ? PL_SPECIALIST : EN_SPECIALIST).exec(text);
  let specialistDomain: string | undefined;
  if (specialistMatch !== null) {
    const named = specialistMatch[1]!.toLowerCase();
    const key = pl
      ? (PL_SPECIALIST_OF[named] ??
        (named.startsWith('humanitarn')
          ? 'humanitarian'
          : named.startsWith('polityczn')
            ? 'political'
            : named.startsWith('ekonomiczn')
              ? 'economic'
              : undefined))
      : named;
    specialistDomain = key === undefined ? undefined : SPECIALIST_DOMAIN_OF[key];
    if (specialistDomain !== undefined)
      trace.push({ kind: 'EXPLICIT_SPECIALIST', marker: specialistMatch[0].trim() });
  }

  return {
    source: {
      /* Code execution IS computation: the one executor that would run it is ABSENT (E1). */
      ...(computation || code ? { computationRequested: true } : {}),
      /* The count of reader-held artifacts the question addresses; 0 are ever transported. */
      ...(attachment ? { attachmentCount: 1 } : {}),
      ...(official
        ? {
            officialRequested: true,
            officialTerms: institution === undefined ? [] : [institution.replace(/\s+/g, ' ')],
          }
        : {}),
      ...(saved || following
        ? {
            personalRequested: true,
            personalScope: saved ? ('SAVED_STORIES' as const) : ('INTERESTS' as const),
          }
        : {}),
      ...(specialistDomain === undefined ? {} : { explicitSpecialistDomains: [specialistDomain] }),
    },
    trace,
  };
}
