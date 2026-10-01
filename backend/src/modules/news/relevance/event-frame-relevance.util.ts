import type { NewsArticle } from '@globalnews-ai/shared';
import { foldForPlan } from './compound-plan-relevance.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK TRUTHFUL RETRIEVAL R2A — EVENT-COHERENCE ADMISSION (BETA-ASK-006)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Production: "what happened today in the Air from Dubai to Israel in a passenger plane …"
 * was answered from the Israel country feed — seven Gaza / Lebanon stories, every one
 * country-relevant and none about the flight — and the model concluded there was "no evidence
 * of an incident". Country relevance is necessary and NOT sufficient for an event question.
 *
 * An article is admitted for an event frame only when it speaks to THE EVENT:
 *
 *   EVENT TYPE   it uses the event's own vocabulary (aviation: flight / plane / aircraft …);
 *   AND ONE OF   it carries a stated identifier (a flight number) — or
 *                it names BOTH endpoints of the route — or
 *                it names one endpoint AND has the event vocabulary in its HEADLINE;
 *   AND TIME     when the question is about today, a publisher-stated publication time more
 *                than 72 h before the request cannot be today's event.
 *
 * Endpoint names come from the frame (the existing country authority and the governed
 * gazetteer); nothing here names a place, an airline or an event.
 */

export type EventType = 'AVIATION' | 'MARITIME' | 'RAIL';

export interface EventEndpoint {
  /** The reader's words for the place ("Dubai", "Israel"). */
  readonly label: string;
  readonly iso3: string;
  /** Folded names that establish this endpoint in an article (place, country forms, cities). */
  readonly names: readonly string[];
}

export interface EventFrameAdmission {
  readonly eventType: EventType;
  readonly endpoints: readonly EventEndpoint[];
  /** Folded identifiers ("fz1073"); an article naming one is about the event. */
  readonly identifiers: readonly string[];
  /** ISO-8601; a trustworthy publication time before this cannot be the asked event. */
  readonly notBefore: string | null;
}

/**
 * Event vocabulary per type, folded, EN + FR. STEMS match a word prefix ("flight" → flights);
 * WORDS match whole tokens only — short words are exact so "cabinet" is not "cabin" and
 * "planet" is not "plane".
 */
export const EVENT_VOCABULARY: Readonly<
  Record<EventType, { readonly stems: readonly string[]; readonly words: readonly string[] }>
> = {
  AVIATION: {
    stems: [
      'flight',
      'aircraft',
      'airliner',
      'airplane',
      'aeroplane',
      'aviation',
      'turbulence',
      'takeoff',
      'aeroport',
    ],
    words: [
      'plane',
      'planes',
      'jet',
      'jets',
      'airline',
      'airlines',
      'airport',
      'airports',
      'pilot',
      'pilots',
      'cabin',
      'runway',
      'runways',
      'avion',
      'avions',
      'vol',
      'vols',
      'emergency landing',
    ],
  },
  MARITIME: {
    stems: ['capsiz', 'shipwreck', 'navire', 'naufrag'],
    words: [
      'ship',
      'ships',
      'vessel',
      'vessels',
      'ferry',
      'ferries',
      'boat',
      'boats',
      'bateau',
      'bateaux',
    ],
  },
  RAIL: {
    stems: ['railway', 'derail', 'locomotive'],
    words: ['train', 'trains', 'rail'],
  },
};

function tokens(folded: string): string[] {
  return folded.split(' ').filter(Boolean);
}

export function speaksToEventType(folded: string, type: EventType): boolean {
  const words = tokens(folded);
  const { stems, words: exact } = EVENT_VOCABULARY[type];
  return (
    stems.some((stem) => words.some((w) => w.startsWith(stem))) ||
    exact.some((w) => (w.includes(' ') ? ` ${folded} `.includes(` ${w} `) : words.includes(w)))
  );
}

/** A place name: whole phrase, or (single word ≥ 5 letters) inside one token ("flydubai"). */
export function namesEndpoint(folded: string, endpoint: EventEndpoint): boolean {
  const padded = ` ${folded} `;
  return endpoint.names.some((name) =>
    name.includes(' ') || name.length < 5
      ? padded.includes(` ${name} `)
      : tokens(folded).some((w) => w.includes(name)),
  );
}

export function namesIdentifier(folded: string, identifiers: readonly string[]): boolean {
  const compact = folded.replace(/\s+/g, '');
  return identifiers.some((id) => id.length >= 3 && compact.includes(id));
}

export interface EventFrameRelevance {
  readonly isRelevant: boolean;
  readonly eventType: boolean;
  readonly endpointsNamed: number;
  readonly identifier: boolean;
  readonly temporal: boolean;
}

export function scoreEventFrameRelevance(
  article: Pick<NewsArticle, 'title' | 'summary' | 'publishedAt' | 'publishedAtBasis'>,
  frame: EventFrameAdmission,
): EventFrameRelevance {
  const title = foldForPlan(article.title ?? '');
  const folded = foldForPlan(`${article.title ?? ''} ${article.summary ?? ''}`);
  const eventType = speaksToEventType(folded, frame.eventType);
  const identifier = namesIdentifier(folded, frame.identifiers);
  const endpointsNamed = frame.endpoints.filter((e) => namesEndpoint(folded, e)).length;
  const allEndpoints = frame.endpoints.length > 0 && endpointsNamed === frame.endpoints.length;
  const headlineEvent = speaksToEventType(title, frame.eventType);
  const published = Date.parse(article.publishedAt ?? '');
  const temporal =
    frame.notBefore === null ||
    article.publishedAtBasis !== 'publisher' ||
    !Number.isFinite(published) ||
    published >= Date.parse(frame.notBefore);

  return {
    isRelevant:
      eventType &&
      temporal &&
      (identifier || allEndpoints || (endpointsNamed > 0 && headlineEvent)),
    eventType,
    endpointsNamed,
    identifier,
    temporal,
  };
}

/** Flight-number-shaped identifiers stated in a text ("FZ1073", "EK 203"). */
export function flightIdentifiersIn(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{2,4})\b/g)) {
    const prefix = m[1] ?? '';
    /* Not a flight number: four-digit years ("AD 2026") and common acronyms followed by a count. */
    if (['AD', 'BC', 'UN', 'EU', 'US', 'UK', 'MP', 'PM', 'AM', 'NO', 'TV'].includes(prefix))
      continue;
    out.add(`${prefix}${m[2]}`.toLowerCase());
  }
  return [...out];
}
