import {
  DEEP_ANALYSIS_COUNTRY_THRESHOLD,
  DEEP_ANALYSIS_DOMAIN_THRESHOLD,
  DEEP_ANALYSIS_TIME_WINDOW_DAYS,
  classifyCompute,
} from '../../compute/classification/classify-compute.util';
import { deriveAskSignals } from './derive-ask-signals.util';

/** Runs the real pipeline: question text -> signals -> compute class. */
function classifyQuestion(
  question: string,
  context?: Parameters<typeof deriveAskSignals>[0]['context'],
) {
  const signals = deriveAskSignals({ normalizedQuestion: question, context });
  return classifyCompute({ ...signals, kind: 'ask-turn', storedResultAvailable: false });
}

describe('BETA-SIMPLE-ASK-SAND-1 §20 — the backend classifies, not the prompt', () => {
  describe('ordinary questions stay bounded', () => {
    it.each([
      'What is happening in Rwanda?',
      'Why did the central bank raise rates?',
      'Who won the election?',
      'Summarise the latest news',
    ])('keeps %s at FRESH_BOUNDED', (question) => {
      expect(classifyQuestion(question).computeClass).toBe('FRESH_BOUNDED');
    });

    it('keeps a two-country comparison bounded — comparison is reading', () => {
      expect(classifyQuestion('Compare Rwanda and Uganda').computeClass).toBe('FRESH_BOUNDED');
    });
  });

  describe('expansive questions escalate without the user asking', () => {
    it('escalates a regional question entered through ordinary Ask', () => {
      const result = classifyQuestion('What is the energy outlook across East Africa?');
      expect(result.computeClass).toBe('DEEP_ANALYSIS');
      expect(result.requiresConfirmation).toBe(true);
    });

    it('escalates an explicitly-named multi-country question', () => {
      const result = classifyQuestion('Compare Rwanda, Uganda, Kenya and Tanzania');
      expect(result.computeClass).toBe('DEEP_ANALYSIS');
    });

    it('escalates a long historical question', () => {
      const result = classifyQuestion('How has inflation moved in Poland over the last 5 years?');
      expect(result.computeClass).toBe('DEEP_ANALYSIS');
    });

    it('escalates an explicit deep-dive request', () => {
      expect(classifyQuestion('Give me a deep analysis of Rwanda energy').computeClass).toBe(
        'DEEP_ANALYSIS',
      );
    });

    it('classifies an explicit report request as RESEARCH_REPORT', () => {
      expect(classifyQuestion('Write me a full report on Rwanda energy policy').computeClass).toBe(
        'RESEARCH_REPORT',
      );
    });
  });

  describe('determinism — a user cannot re-roll a cheaper price by asking again', () => {
    it('produces identical signals for the same question', () => {
      const a = deriveAskSignals({
        normalizedQuestion: 'energy across Africa in the last 3 years',
      });
      const b = deriveAskSignals({
        normalizedQuestion: 'energy across Africa in the last 3 years',
      });
      expect(a).toEqual(b);
    });
  });

  describe('country counting', () => {
    it('counts at least one country even when none is detectable', () => {
      expect(deriveAskSignals({ normalizedQuestion: 'what is going on' }).countryCount).toBe(1);
    });

    it('does not double-count one country named twice', () => {
      const signals = deriveAskSignals({ normalizedQuestion: 'Rwanda news about Rwanda' });
      expect(signals.countryCount).toBe(1);
    });

    it('treats a regional phrase as multi-country retrieval', () => {
      const signals = deriveAskSignals({ normalizedQuestion: 'developments across the region' });
      expect(signals.countryCount).toBeGreaterThanOrEqual(DEEP_ANALYSIS_COUNTRY_THRESHOLD);
    });

    it('includes the geography carried in from §4 navigation context', () => {
      const withContext = deriveAskSignals({
        normalizedQuestion: 'what changed here',
        context: { countryCode: 'RW' },
      });
      expect(withContext.countryCount).toBe(1);
    });

    it('does not treat ordinary lowercase words as countries', () => {
      // 'chad', 'jordan', 'turkey' are real country names AND ordinary
      // words; a false positive here would escalate an ordinary
      // question into a priced Deep Analysis.
      const signals = deriveAskSignals({
        normalizedQuestion: 'is turkey expensive this year and did chad call jordan',
      });
      expect(signals.countryCount).toBe(1);
    });
  });

  describe('domain counting reuses the existing analysis domain detector', () => {
    it('counts at least one domain', () => {
      expect(deriveAskSignals({ normalizedQuestion: 'anything' }).domainCount).toBe(1);
    });

    it('detects a genuinely cross-domain question', () => {
      const signals = deriveAskSignals({
        normalizedQuestion:
          'How do energy prices, security incidents and humanitarian aid interact in Rwanda?',
      });
      expect(signals.domainCount).toBeGreaterThanOrEqual(DEEP_ANALYSIS_DOMAIN_THRESHOLD);
    });
  });

  describe('time windows', () => {
    it('reads an explicit multi-year request as historical', () => {
      const signals = deriveAskSignals({ normalizedQuestion: 'trends over the last 3 years' });
      expect(signals.requestedTimeWindowDays).toBeGreaterThanOrEqual(
        DEEP_ANALYSIS_TIME_WINDOW_DAYS,
      );
    });

    it('reads a short request as non-historical', () => {
      const signals = deriveAskSignals({ normalizedQuestion: 'news from the last 7 days' });
      expect(signals.requestedTimeWindowDays).toBe(7);
    });

    it('uses a UI time-window filter only when the question names none', () => {
      const fromContext = deriveAskSignals({
        normalizedQuestion: 'what is happening',
        context: { timeWindow: '30d' },
      });
      expect(fromContext.requestedTimeWindowDays).toBe(30);

      // The question's own explicit window wins — a UI filter must not
      // escalate a request into historical synthesis.
      const fromQuestion = deriveAskSignals({
        normalizedQuestion: 'news from the last 7 days',
        context: { timeWindow: '90d' },
      });
      expect(fromQuestion.requestedTimeWindowDays).toBe(7);
    });
  });

  describe('contextualOnly is never inferred from wording', () => {
    it('is always false for a free-text question', () => {
      // Whether an answer needs fresh retrieval is a property of what
      // retrieval finds, not of how the question is phrased. Inferring
      // it from text would let a plausible-sounding question skip
      // retrieval entirely.
      for (const question of [
        'just explain what you already know',
        'no need to search, summarise stored data',
        'what is happening in Rwanda',
      ]) {
        expect(deriveAskSignals({ normalizedQuestion: question }).contextualOnly).toBe(false);
      }
    });
  });
});
