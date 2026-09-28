import type { AnalysisRetrievalContext, EventAnchorDisclosure, LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { localisedCountryName } from '@/lib/map/geography/displayName';

/**
 * ASK R2 ALPHA ENABLEMENT R1 — questions the backend ASKED about instead of searching:
 *   NO_PRIOR_SUBJECT              a first-turn "And Kenya?" (MC-070) — the named place kept
 *   IDENTITY_REQUIRED             the reader's own saved stories, signed out (MC-055)
 *   PERSONAL_LIBRARY_UNAVAILABLE  the same, signed in: the library is not reachable here
 * One wording for the Ask dock, /ask and the /search frame. Undefined for every other state.
 */
export function resolveAskedNotSearched(
  ctx: AnalysisRetrievalContext,
  language: LanguageCode,
):
  | { code: string; heading: string; body: string; sentence: string; places: readonly string[] }
  | undefined {
  if (ctx.retrievalOutcome !== 'CLARIFICATION_REQUIRED') return undefined;
  const copy = getDictionary(language).eventAnchor;
  if (ctx.clarificationReason === 'NO_PRIOR_SUBJECT') {
    const places = (ctx.clarificationCandidates ?? []).map(
      (iso3) => localisedCountryName(iso3, language) ?? iso3,
    );
    /* The place is shown beside the sentence (a chip), never inflected into it. */
    return {
      code: 'NO_PRIOR_SUBJECT',
      heading: copy.stateNoPriorSubject,
      body: copy.noPriorSubjectQuestion,
      sentence: copy.noPriorSubjectQuestion,
      places,
    };
  }
  if (ctx.clarificationReason === 'IDENTITY_REQUIRED') {
    return {
      code: 'IDENTITY_REQUIRED',
      heading: copy.stateIdentityRequired,
      body: copy.identityRequiredBody,
      sentence: copy.identityRequiredBody,
      places: [],
    };
  }
  if (ctx.clarificationReason === 'PERSONAL_LIBRARY_UNAVAILABLE') {
    return {
      code: 'PERSONAL_LIBRARY_UNAVAILABLE',
      heading: copy.statePersonalUnavailable,
      body: copy.personalUnavailableBody,
      sentence: copy.personalUnavailableBody,
      places: [],
    };
  }
  return undefined;
}

/**
 * ASK CONVERSATIONAL EVIDENCE ANCHORING R1 — THE ONE DISPLAY AUTHORITY FOR
 * WHAT THE EVENT EVIDENCE DOES AND DOES NOT ESTABLISH.
 *
 * The backend decides every fact here deterministically (`eventAnchor` on the
 * retrieval context): which country the event was interpreted as and from
 * what, whether any reporting establishes a cause or a neighbouring-country
 * impact, and whether same-place context was kept apart from the event. This
 * file only words those codes, in EN and PL, for BOTH the Ask dock and the
 * analysis frame, so the two surfaces cannot say different things.
 *
 * It renders NOTHING when there is no anchor: every question that does not
 * reason about an event is untouched.
 */

type Copy = ReturnType<typeof getDictionary>['eventAnchor'];

function countryLabel(ctx: AnalysisRetrievalContext, copy: Copy): string | undefined {
  const iso3 = ctx.eventAnchor?.countryIso3;
  if (iso3 === undefined) return undefined;
  return (copy.countryNames as Record<string, string>)[iso3] ?? ctx.countryName ?? iso3;
}

const ORDER: readonly EventAnchorDisclosure[] = [
  'COUNTRY_INTERPRETED_FROM_EVIDENCE',
  'COUNTRY_FROM_SELECTED_CONTEXT',
  'CROSS_BORDER_NOT_ESTABLISHED',
  'CAUSE_NOT_ESTABLISHED',
  'CONTEXT_SEPARATED',
];

export interface EventAnchorLine {
  readonly code: EventAnchorDisclosure | 'CONTEXT_CLAIMS_WITHHELD';
  readonly text: string;
  /** INLINE CITATIONS R1 B3 — the same fact as a short fragment, for the compact note. */
  readonly short: string;
}

/** The disclosure sentences, in a fixed order. Empty when there is no anchor. */
export function resolveEventAnchorLines(
  ctx: AnalysisRetrievalContext,
  language: LanguageCode,
): EventAnchorLine[] {
  const anchor = ctx.eventAnchor;
  if (anchor === undefined) return [];
  const copy = getDictionary(language).eventAnchor;
  const country = countryLabel(ctx, copy) ?? '';
  const lines: EventAnchorLine[] = [];
  for (const code of ORDER) {
    if (!anchor.disclosures.includes(code)) continue;
    const short = (
      code === 'COUNTRY_INTERPRETED_FROM_EVIDENCE'
        ? copy.short.interpretedFromEvidence
        : code === 'COUNTRY_FROM_SELECTED_CONTEXT'
          ? copy.short.fromSelectedContext
          : code === 'CROSS_BORDER_NOT_ESTABLISHED'
            ? copy.short.crossBorderNotEstablished
            : code === 'CAUSE_NOT_ESTABLISHED'
              ? copy.short.causeNotEstablished
              : copy.short.contextSeparated
    ).replace('{country}', country);
    const text =
      code === 'COUNTRY_INTERPRETED_FROM_EVIDENCE'
        ? copy.interpretedFromEvidence.replace('{country}', country)
        : code === 'COUNTRY_FROM_SELECTED_CONTEXT'
          ? copy.fromSelectedContext.replace('{country}', country)
          : code === 'CROSS_BORDER_NOT_ESTABLISHED'
            ? copy.crossBorderNotEstablished
            : code === 'CAUSE_NOT_ESTABLISHED'
              ? copy.causeNotEstablished
              : copy.contextSeparated;
    lines.push({ code, text, short });
  }
  if ((anchor.contextOnlyClaimsWithheld ?? 0) > 0) {
    lines.push({
      code: 'CONTEXT_CLAIMS_WITHHELD',
      text: copy.contextClaimsWithheld,
      short: copy.short.contextClaimsWithheld,
    });
  }
  return lines;
}

/**
 * The ambiguous-country clarification: the question and one line per
 * candidate, named in the reader's language. Undefined unless the backend
 * asked for exactly this clarification.
 */
export function resolveAmbiguousCountryQuestion(
  ctx: AnalysisRetrievalContext,
  language: LanguageCode,
): { question: string; candidates: string[]; sentence: string } | undefined {
  if (ctx.retrievalOutcome !== 'CLARIFICATION_REQUIRED' || ctx.clarificationReason !== 'AMBIGUOUS_COUNTRY') {
    return undefined;
  }
  const copy = getDictionary(language).eventAnchor;
  const names = copy.countryNamesFull as Record<string, string>;
  const candidates = (ctx.clarificationCandidates ?? []).map((iso3) => names[iso3] ?? iso3);
  return {
    question: copy.ambiguousCountryQuestion,
    candidates,
    /* The one-line form for the Ask dock: fixed copy and country names only, never model text. */
    sentence: [copy.ambiguousCountryQuestion, ...candidates].join(' · '),
  };
}

export function EventAnchorNotice({
  retrievalContext,
  language,
  compact = false,
}: {
  retrievalContext: AnalysisRetrievalContext;
  language: LanguageCode;
  /**
   * INLINE CITATIONS R1 B3 — PRESENTATION ONLY. One line of short fragments
   * ("Evidence note · Cause not established · …") with the full sentences one
   * tap away. The same codes, in the same order, from the same resolver: the
   * compact note can say less, never something different.
   */
  compact?: boolean;
}): JSX.Element | null {
  const lines = resolveEventAnchorLines(retrievalContext, language);
  if (lines.length === 0) return null;
  const copy = getDictionary(language).eventAnchor;
  if (compact) {
    return (
      <section data-event-anchor="notice" data-event-anchor-variant="compact" role="note" aria-label={copy.heading}>
        <details className="group text-xs leading-relaxed text-ink-secondary">
          <summary className="cursor-pointer list-none rounded-md py-1 [&::-webkit-details-marker]:hidden">
            <span className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">{copy.compactHeading}</span>
            {lines.map((line) => (
              <span key={line.code} data-event-anchor-short={line.code}>
                {' · '}
                {line.short}
              </span>
            ))}
            <span className="sr-only"> — {copy.compactShowDetails}</span>
          </summary>
          <ul className="mt-1 space-y-1 border-s-2 border-border-strong ps-3">
            {lines.map((line) => (
              <li key={line.code} data-event-anchor-disclosure={line.code}>
                {line.text}
              </li>
            ))}
          </ul>
        </details>
      </section>
    );
  }
  return (
    <section
      data-event-anchor="notice"
      role="note"
      aria-label={copy.heading}
      className="rounded-xl border border-border-strong bg-surface px-3 py-2"
    >
      <p className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">{copy.heading}</p>
      <ul className="mt-1 space-y-1 text-xs leading-relaxed text-ink-secondary">
        {lines.map((line) => (
          <li key={line.code} data-event-anchor-disclosure={line.code}>
            {line.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
