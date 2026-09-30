/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R2 CONSOLIDATED INTEGRATION R1 · GATE C — THE SIX LANDED READINGS, WIRED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Frozen C's `LandedClassifierReading` port says: "The six landed classifiers are
 * consumed ... as DECLARED INPUT. This file defines the port; it implements no
 * classifier." This adapter is the other side of that port — the first integration step
 * the router names ("wire the real readings behind LandedClassifierReading, re-run the
 * corpus", G 04 §5). Each field is ONE CALL to ONE landed module, and nothing else:
 *
 *   queryIntent               classifyQueryIntent()            query-intent.util
 *   analyticalDomains         the qualified reading's domains  (EN: detectRequestedDomains,
 *                                                               unchanged; PL: L's lexicon
 *                                                               keyed by the same concepts)
 *   sourceAttributed          detectSourceAttributedIntent()   derive-source-attributed-query.util
 *   eventAnchor               deriveEventTopic() + detectEventAspects()   event-anchor.util
 *   conversationSubject       deriveConversationSubject()      conversation-subject.util
 *   questionAsksAboutCoverage asksAboutCoverage()              coverage-question.util
 *
 * IC-8: every value carries WHERE IT CAME FROM in `LandedReadingTrace`, so a spec can
 * prove the landed intent classifier actually fed the producer and an unwired default
 * cannot pass as a reading.
 */

import { classifyQueryIntent } from '../analysis/query/query-intent.util';
import { detectSourceAttributedIntent } from '../analysis/query/derive-source-attributed-query.util';
import {
  deriveEventTopic,
  detectEventAspects,
  isEventTopic,
} from '../analysis/anchor/event-anchor.util';
import { deriveConversationSubject } from '../analysis/anchor/conversation-subject.util';
import { asksAboutCoverage } from '../analysis/query/coverage-question.util';
import type { LandedClassifierReading, QueryIntent } from './frozen-c/src/ports';
import type { QualifiedReading } from './normalization/qualified-reading';

export interface LandedReadingInputs {
  /** The previous user question in this conversation, when there is one. */
  readonly priorQuestion?: string;
  /** `storyContext.articleId` resolved to a real article (frozen rank 2). */
  readonly hasResolvedArticleAnchor?: boolean;
}

/** Provenance for each of the six readings — IC-8. */
export interface LandedReadingTrace {
  readonly queryIntent: 'classifyQueryIntent';
  readonly analyticalDomains: readonly string[];
  readonly sourceAttributed: 'detectSourceAttributedIntent';
  readonly eventAnchor: 'deriveEventTopic+detectEventAspects';
  readonly conversationSubject: 'deriveConversationSubject' | 'NO_PRIOR_QUESTION';
  readonly questionAsksAboutCoverage: 'asksAboutCoverage';
}

export interface LandedReadings {
  readonly reading: LandedClassifierReading;
  readonly trace: LandedReadingTrace;
}

/**
 * Read the six landed classifiers for one question. `domains` is the qualified reading's
 * domain axis — or empty for a question that could not be read, whose domains frozen C
 * suppresses anyway (no manufactured default stands in for a reading).
 */
export function readLandedClassifiers(
  originalQuestion: string,
  domains: QualifiedReading['domains'],
  inputs: LandedReadingInputs = {},
): LandedReadings {
  const text = originalQuestion.trim();

  const intent = classifyQueryIntent(text, {
    hasResolvedArticleAnchor: inputs.hasResolvedArticleAnchor === true,
    /* PR #72 — for ROUTING, asserted freshness outranks every background frame. */
    freshnessOutranksBackground: true,
  });

  const attributed = detectSourceAttributedIntent(text);

  const aspects = detectEventAspects(text);
  const aspectCount = [aspects.cause, aspects.effect, aspects.crossBorder].filter(Boolean).length;

  const prior = inputs.priorQuestion?.trim() ?? '';
  const priorSubject = prior.length > 0 ? deriveConversationSubject(prior) : undefined;

  return {
    reading: {
      queryIntent: intent.intent as QueryIntent,
      analyticalDomains: domains.map((d) => d.value),
      sourceAttributed: {
        parsed: attributed?.query !== undefined,
        namedPublisher: attributed === undefined ? null : attributed.rawSourcePhrase,
      },
      eventAnchor: { hasEventAnchor: isEventTopic(deriveEventTopic(text)), aspectCount },
      conversationSubject: {
        hasPriorQuestion: prior.length > 0,
        focusFromPriorQuestion: priorSubject === undefined ? [] : [priorSubject],
      },
      questionAsksAboutCoverage: asksAboutCoverage(text),
    },
    trace: {
      queryIntent: 'classifyQueryIntent',
      analyticalDomains: domains.map((d) => d.source),
      sourceAttributed: 'detectSourceAttributedIntent',
      eventAnchor: 'deriveEventTopic+detectEventAspects',
      conversationSubject: prior.length > 0 ? 'deriveConversationSubject' : 'NO_PRIOR_QUESTION',
      questionAsksAboutCoverage: 'asksAboutCoverage',
    },
  };
}
