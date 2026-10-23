import { readFileSync } from 'fs';
import { join } from 'path';
import type { AskR2Payload } from '@/lib/api/askV2Api';
import { ASK_PROGRESS_LOCALES, askProgressStrings } from './askProgressStrings';
import { askR2Strings } from './askR2Strings';
import { aboutRetrievalFigures, askR2View } from './askR2View';
import { searchActivityOf } from './askSearchActivity';

/**
 * PO live test, Alpha e5e4ac3 (Kenya economy, nothing searched): Search activity read "not searched"
 * while "About this answer" read "0 retrieved reports · 0 reporting clusters". The About line is
 * a separate renderer (AskR2TurnView) fed by sourceDiversity; it must agree with Search activity.
 */
const base = (analysis: Record<string, unknown>, extra: Record<string, unknown> = {}): AskR2Payload =>
  ({
    schema: 'ask-r2-result/1',
    route: { terminalState: 'EXECUTABLE' },
    answer: { state: 'INSUFFICIENT', basis: 'x', missingRoles: [] },
    chips: { kind: 'NONE' },
    analysis: {
      articles: [],
      sourceDiversity: { retrievedArticleCount: 0, reportingClusterCount: 0 },
      ...analysis,
    },
    ...extra,
  }) as never;

const refusedAll = {
  retrievalContext: {
    dataMode: 'unavailable',
    providers: [],
    providerFailures: [
      { providerId: 'gnews', kind: 'rights-not-cleared' },
      { providerId: 'gdelt-doc', kind: 'rights-not-cleared' },
    ],
    retrievalTrace: {
      candidatesSeen: 0,
      lanesUnavailable: [
        { lane: 'x', reason: 'not-configured' },
        { lane: 'rss-feeds', reason: 'not-configured' },
      ],
    },
  },
};

describe('"About this answer" never shows search figures when nothing was searched', () => {
  it('PO shape: all refused + not-configured → no figures, and Search activity says not-searched', () => {
    const p = base(refusedAll);
    expect(searchActivityOf(p)?.steps[0]).toMatchObject({ status: 'not-searched' });
    expect(aboutRetrievalFigures(p)).toBeNull();
  });

  it('a stored research record NOT_PERMITTED → no figures (same as Search activity)', () => {
    const p = base(
      { retrievalContext: { dataMode: 'unavailable', providers: [] } },
      {
        research: {
          schema: 'ask-research/1',
          performed: true,
          reused: false,
          outcome: 'NOT_PERMITTED',
          lanes: { attempted: [], answered: [], unavailable: [] },
        },
      },
    );
    expect(searchActivityOf(p)?.steps[0]).toMatchObject({ status: 'not-searched' });
    expect(aboutRetrievalFigures(p)).toBeNull();
  });

  it('a search that RAN and found nothing keeps its true figures (0 is a real result there)', () => {
    const p = base({
      retrievalContext: {
        dataMode: 'live',
        providers: ['rss-feeds'],
        retrievalTrace: { candidatesSeen: 4, lanesUnavailable: [] },
      },
    });
    expect(aboutRetrievalFigures(p)).toEqual({ reports: 0, clusters: 0 });
  });

  it('E1 C-1: reports found and ALL withheld for rights → no figures (never "0 retrieved")', () => {
    const p = base({
      retrievalContext: {
        dataMode: 'live',
        providers: ['rss-feeds'],
        articlesRetrieved: 0,
        rightsExcluded: { count: 4, reasons: { SOURCE_RIGHTS_NOT_CLEARED: 4 } },
        retrievalTrace: { candidatesSeen: 4, lanesUnavailable: [] },
      },
    });
    expect(aboutRetrievalFigures(p)).toBeNull();
  });

  /* Politics F-1 (a66972b review) — the freshness line on the same answer said "0 matching reports" */
  it.each(ASK_PROGRESS_LOCALES)(
    '%s: a total rights withholding never reads "0 matching reports" in the freshness line',
    (locale) => {
      const withheld = base({
        retrievalContext: {
          dataMode: 'live',
          providers: ['rss-feeds'],
          articlesRetrieved: 0,
          rightsExcluded: { count: 4, reasons: { SOURCE_RIGHTS_NOT_CLEARED: 4 } },
        },
      });
      const s = askR2Strings(locale as never);
      const v = askR2View(withheld, s, locale as never);
      expect(v.freshness).toContain(askProgressStrings(locale).rightsWithheld(4));
      expect(v.freshness).not.toContain(s.freshness.zero.replace(/^.*\{when\}/, '').trim());
      /* positive control: the same answer from a search that ran and matched nothing keeps "0 matching" */
      const zero = base({
        retrievalContext: { dataMode: 'live', providers: ['rss-feeds'], articlesRetrieved: 0 },
      });
      expect(askR2View(zero, s, locale as never).freshness).toContain(
        s.freshness.zero.replace(/^.*\{when\}/, '').trim(),
      );
    },
  );

  it('a genuine outage keeps its figures (a search was attempted)', () => {
    const p = base({
      retrievalContext: {
        dataMode: 'unavailable',
        providers: [],
        providerFailures: [{ providerId: 'gnews', kind: 'rate-limited' }],
      },
    });
    expect(aboutRetrievalFigures(p)).not.toBeNull();
  });

  it('the About renderer uses the shared decision (never the raw sourceDiversity telemetry)', () => {
    const source = readFileSync(
      join(__dirname, '..', '..', 'components', 'ask-frame', 'AskR2TurnView.tsx'),
      'utf8',
    );
    expect(source).toMatch(/aboutRetrievalFigures\(payload\)/);
    expect(source).not.toMatch(/buildBriefTelemetry/);
  });
});
