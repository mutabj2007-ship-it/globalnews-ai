import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ANALYSIS_TOTAL_BUDGET_MS } from '@globalnews-ai/shared';
import type { NewsArticle } from '@globalnews-ai/shared';
import { AnalysisService } from './analysis.service';
import type { AnalysisProvider, AnalysisProviderInput } from '../interfaces';
import { AnalysisConfigService } from '../config/analysis-config.service';
import { MockAnalysisProvider } from '../providers/mock-analysis.provider';
import { NewsService } from '../../news/news.service';
import { CountryNewsService } from '../../news/country/country-news.service';
import type { NewsProvider } from '../../news/interfaces';
import {
  ALL_NEWS_PROVIDERS,
  FALLBACK_NEWS_PROVIDERS,
  NEWS_PROVIDERS,
} from '../../news/providers/provider.tokens';
import { ArticlePersistenceService } from '../../news/persistence/article-persistence.service';
import { GNewsProviderError } from '../../news/providers/gnews.provider';
import { COMPOUND_PLAN_PACING } from '../query/compound-retrieval-plan.util';
import { deriveEventFrame, MAX_EVENT_SEARCHES } from '../query/event-frame.util';
import { deduplicateArticles } from '../../news/country/deduplicate-articles.util';
import { scoreEventFrameRelevance } from '../../news/relevance/event-frame-relevance.util';
import { canAssertNegative, findNegativeAssertions } from '../validation/negative-assertion.util';
import { assessClaims, isOfficialSource } from '../validation/claim-graph.util';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK PUBLIC BETA RETRIEVAL REPAIR R1 — BETA-ASK-002 / 003 on the real services.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Production op 5944db16 (request 444058c7): the eastern-DRC question reached GNews as one
 * ~35-term AND phrase, returned nothing, and was answered "0 matching reports". Fixtures are
 * [RECONSTRUCTED] headlines of the kind the wires and Radio Okapi / Actualite.cd publish; no
 * live provider or model is called.
 */

const Q2 =
  'What are the most recent verified security or territorial changes in eastern Democratic Republic of the Congo, and what effects on civilians or displacement are currently reported? Separate confirmed facts from analytical inference, identify important claims that remain disputed, distinguish event dates from publication dates, and cite independent local/regional, official, and international sources where available.';

function a(
  id: string,
  title: string,
  summary: string,
  extra: Partial<NewsArticle> = {},
): NewsArticle {
  return {
    id,
    title,
    summary,
    url: `https://${id}.example/${id}`,
    sourceId: `src-${id}`,
    sourceName: `Outlet ${id}`,
    category: 'world',
    sourcesCount: 1,
    publishedAt: new Date(Date.now() - 3_600_000).toISOString(),
    publishedAtBasis: 'publisher' as const,
    sourceLanguage: 'en',
    ...extra,
  };
}

const EN_SECURITY = a(
  'en-sec',
  'M23 rebels seize another town in North Kivu',
  'Fighting in eastern Democratic Republic of Congo pushed the front line north of Goma.',
);
const EN_DISPLACED = a(
  'en-hum',
  'Thousands flee as clashes spread in Ituri',
  'Aid agencies said civilians displaced in eastern Congo lack shelter.',
);
const FR_LOCAL = a(
  'fr-loc',
  'Nord-Kivu : le M23 prend le contrôle de Masisi',
  "Les combats dans l'est de la RDC ont provoqué le déplacement de milliers de civils.",
  { sourceLanguage: 'fr' },
);
/* One wire story, syndicated under two outlets. */

/* Plan pacing is exercised by its own test; everything else runs without real waiting. */
beforeAll(() => {
  COMPOUND_PLAN_PACING.spacingMs = 0;
});

type Call = { providerId: string; q: string; lang?: string };

function stub(
  id: string,
  byLang: (lang: string | undefined) => NewsArticle[],
  calls: Call[],
  failWith?: Error,
): NewsProvider {
  return {
    id,
    displayName: id,
    isMock: false,
    capabilities: ['search'],
    async search(q: string, options?: { lang?: string }) {
      calls.push({ providerId: id, q, ...(options?.lang ? { lang: options.lang } : {}) });
      if (failWith) throw failWith;
      return byLang(options?.lang);
    },
    async topHeadlines() {
      return [];
    },
    async category() {
      return [];
    },
    async health() {
      return { providerId: id, displayName: id, status: 'ok' as const, checkedAt: '' };
    },
  } as unknown as NewsProvider;
}

async function services(primary: NewsProvider[], fallback: NewsProvider[] = [], summary?: string) {
  const persistence = {
    persistMany: jest.fn().mockResolvedValue(new Map()),
    findRecent: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    findRetainedByUrl: jest.fn().mockResolvedValue(null),
    findRecentByCountry: jest.fn().mockResolvedValue([]),
    persistCountryRelations: jest.fn().mockResolvedValue(undefined),
  };
  const all = [...primary, ...fallback];
  const moduleRef = await Test.createTestingModule({
    providers: [
      NewsService,
      CountryNewsService,
      { provide: ConfigService, useValue: { get: () => undefined } },
      { provide: NEWS_PROVIDERS, useValue: all },
      { provide: ALL_NEWS_PROVIDERS, useValue: all },
      { provide: FALLBACK_NEWS_PROVIDERS, useValue: fallback },
      { provide: ArticlePersistenceService, useValue: persistence },
    ],
  }).compile();
  const inputs: AnalysisProviderInput[] = [];
  const mock = new MockAnalysisProvider();
  const model: AnalysisProvider = {
    id: 'openai',
    displayName: 'Fixture model',
    isMock: false,
    analyzeNews: async (input: AnalysisProviderInput) => {
      inputs.push(input);
      const out = (await mock.analyzeNews(input)) as Record<string, unknown>;
      return summary === undefined ? out : { ...out, summary };
    },
  };
  const config = {
    get: () => ({
      maxArticles: 8,
      maxArticleChars: 1200,
      timeoutMs: 20000,
      totalBudgetMs: ANALYSIS_TOTAL_BUDGET_MS,
      cacheTtlSeconds: 0,
      openAiApiKey: undefined,
      openAiModel: 'fixture',
      executionMode: 'development' as const,
      retryAttempts: 1,
      retryBaseDelayMs: 1,
      maxCompletionTokens: 2000,
    }),
  } as unknown as AnalysisConfigService;
  const service = new AnalysisService(
    moduleRef.get(NewsService),
    moduleRef.get(CountryNewsService),
    model,
    config,
  );
  return { service, inputs };
}

/* ════════════════════════════════════════════════════════════════════════════
   ASK TRUTHFUL RETRIEVAL R2A — BETA-ASK-006 and the negative-assertion guard.
   [RECONSTRUCTED] headline shapes; no live provider or model is called.
   ════════════════════════════════════════════════════════════════════════════ */

const FLYDUBAI_Q =
  'tell me in details what happened today in the Air from Dubai to Israel in a passenger plane. How did it happen?, Indicate if there were some casualties in that incidence';

const fresh = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
/* The irrelevant Israel-country corpus Production answered from. */
const GAZA_COLLAPSE = a(
  'gaza-collapse',
  'Apartment building collapses in Gaza City, several dead',
  'Rescuers in Gaza searched the rubble; Israel said it was reviewing the incident.',
);
const HEZBOLLAH_DISPLACED = a(
  'hezbollah-displaced',
  'Thousands displaced in southern Lebanon as Israel strikes Hezbollah targets',
  'Israeli strikes continued near the border.',
);
const ISRAEL_POLITICS = a(
  'isr-politics',
  'Israeli cabinet meets on security budget',
  'Ministers in Jerusalem debated military spending.',
);
/* The event itself, as the wires and the airline would report it. */
const FLIGHT_WIRE = a(
  'flight-wire',
  'Flydubai flight from Dubai to Tel Aviv makes emergency landing',
  'Flydubai flight FZ1073 declared an emergency after an engine problem; the airline said no injuries were reported among the passengers.',
  { publishedAt: fresh(3) },
);
const FLIGHT_SYNDICATED = a(
  'flight-syndicated',
  'Flydubai flight from Dubai to Tel Aviv makes emergency landing',
  'Flydubai flight FZ1073 declared an emergency after an engine problem; the airline said no injuries were reported among the passengers.',
  { publishedAt: fresh(3), url: 'https://syndicator.example/flight-wire' },
);
const FLIGHT_LOCAL = a(
  'flight-local',
  'Passenger jet from Dubai lands safely at Ben Gurion airport after mid-air scare',
  'The Israel Airports Authority said the aircraft landed safely in Tel Aviv.',
  { publishedAt: fresh(2) },
);
const FLIGHT_RESCUE_ONLY = a(
  'flight-rescue',
  'FZ1073 diverted crew cites engine warning',
  'Aviation trackers showed FZ1073 circling before landing.',
  { publishedAt: fresh(1) },
);
const OLD_FLIGHT = a(
  'old-flight',
  'Flydubai flight from Dubai to Tel Aviv delayed by fog',
  'Passengers waited at the airport.',
  { publishedAt: fresh(24 * 20) },
);

describe('R2A · the event frame (BETA-ASK-006)', () => {
  const frame = deriveEventFrame(FLYDUBAI_Q, 'en')!;

  it('the exact PO question is an AVIATION event on Dubai → Israel, not Israel country news', () => {
    expect(frame).toBeDefined();
    expect(frame.eventType).toBe('AVIATION');
    expect(frame.origin?.iso3).toBe('ARE');
    expect(frame.origin?.label).toBe('Dubai');
    expect(frame.destination?.iso3).toBe('ISR');
    /* Israel is named by its large cities too — from the gazetteer, not a list here. */
    expect(frame.destination?.names).toEqual(
      expect.arrayContaining(['israel', 'tel aviv', 'jerusalem']),
    );
    expect(frame.claims.map((c) => c.type)).toEqual([
      'OCCURRENCE',
      'ROUTE',
      'TIME',
      'CAUSE',
      'CASUALTIES',
    ]);
    expect(frame.queries).toEqual(['Dubai Israel flight', 'Dubai Israel plane']);
    expect(frame.queries.length).toBeLessThanOrEqual(MAX_EVENT_SEARCHES);
    expect(frame.notBefore).not.toBeNull();
  });

  it('a typed flight number becomes an identifier and its own search', () => {
    const typed = deriveEventFrame(
      'What happened to flight FZ1073 from Dubai to Tel Aviv today?',
      'en',
    )!;
    expect(typed.identifiers).toEqual(['fz1073']);
    expect(typed.queries[0]).toBe('FZ1073 flight');
  });

  it('non-event questions keep their path', () => {
    expect(deriveEventFrame("What has changed in Poland's economy?", 'en')).toBeUndefined();
    expect(deriveEventFrame('What is happening in Israel?', 'en')).toBeUndefined();
    expect(deriveEventFrame(FLYDUBAI_Q, 'pl')).toBeUndefined();
  });

  it('event coherence: Gaza / Hezbollah / Israeli politics rejected; the flight reports admitted', () => {
    const admit = (x: NewsArticle) => scoreEventFrameRelevance(x, frame).isRelevant;
    expect(admit(GAZA_COLLAPSE)).toBe(false);
    expect(admit(HEZBOLLAH_DISPLACED)).toBe(false);
    expect(admit(ISRAEL_POLITICS)).toBe(false);
    expect(admit(FLIGHT_WIRE)).toBe(true);
    expect(admit(FLIGHT_LOCAL)).toBe(true);
    /* "today": a 20-day-old flight story is not today's event. */
    expect(admit(OLD_FLIGHT)).toBe(false);
  });
});

describe('R2A · Flydubai end to end on the real services', () => {
  it('AFTER: event searches, identifier rescue, only the flight admitted, claims assessed, one model call', async () => {
    const calls: Array<{ q: string }> = [];
    const gnews = {
      ...stub('gnews', () => [], []),
      async search(q: string) {
        calls.push({ q });
        return q.startsWith('FZ1073')
          ? [FLIGHT_RESCUE_ONLY]
          : [
              GAZA_COLLAPSE,
              HEZBOLLAH_DISPLACED,
              ISRAEL_POLITICS,
              FLIGHT_WIRE,
              FLIGHT_SYNDICATED,
              FLIGHT_LOCAL,
            ];
      },
    } as unknown as NewsProvider;
    const { service, inputs } = await services([gnews]);

    const result = await service.analyzeNews(FLYDUBAI_Q, 'en');

    expect(calls.map((c) => c.q)).toEqual([
      'Dubai Israel flight',
      'Dubai Israel plane',
      'FZ1073 flight',
    ]);
    const ids = result.articles.map((x) => x.id);
    expect(ids).not.toEqual(expect.arrayContaining(['gaza-collapse']));
    expect(ids).not.toContain('hezbollah-displaced');
    expect(ids).not.toContain('isr-politics');
    expect(ids).toEqual(expect.arrayContaining(['flight-wire', 'flight-local', 'flight-rescue']));
    expect(inputs).toHaveLength(1);

    const ctx = result.retrievalContext!;
    expect(ctx.countryCode).toBeUndefined();
    expect(ctx.retrievalTrace).toMatchObject({
      queryVariants: ['Dubai Israel flight', 'Dubai Israel plane', 'FZ1073 flight'],
      lanesSucceeded: ['gnews'],
      lanesUnavailable: [],
    });
    expect(ctx.retrievalTrace!.candidatesSeen).toBeGreaterThan(
      ctx.retrievalTrace!.candidatesAdmitted,
    );
    const state = (id: string) => ctx.claimAssessments!.find((c) => c.id === id)!;
    expect(state('occurrence').state).toBe('CORROBORATED_REPORTING');
    /* The wire story and its syndicated copy are ONE family. */
    expect(state('occurrence').independentFamilies).toBe(3);
    expect(state('cause').state).not.toBe('NOT_VERIFIED');
    expect(ctx.verificationNotice).toBeUndefined();
  });

  it('only the irrelevant Israel corpus → zero evidence, NO model call, NOT_VERIFIED (never "it did not happen")', async () => {
    const gnews = stub('gnews', () => [GAZA_COLLAPSE, HEZBOLLAH_DISPLACED, ISRAEL_POLITICS], []);
    const { service, inputs } = await services([gnews]);
    const result = await service.analyzeNews(FLYDUBAI_Q, 'en');
    expect(result.articles).toEqual([]);
    expect(result.analysis).toBeNull();
    expect(inputs).toHaveLength(0);
    expect(result.retrievalContext?.verificationNotice).toBe('NOT_VERIFIED');
    expect(result.retrievalContext?.claimAssessments?.[0]?.state).toBe('NOT_VERIFIED');
  });

  it('GNews 429 → COVERAGE_INCOMPLETE with the lane named; other lanes still ran', async () => {
    const calls: string[] = [];
    const gnews = {
      ...stub('gnews', () => [], []),
      async search() {
        calls.push('gnews');
        throw new GNewsProviderError('GNews rate limit reached.', 429, 'rate-limited');
      },
    } as unknown as NewsProvider;
    const feeds = {
      ...stub('rss-feeds', () => [], []),
      async search() {
        calls.push('rss-feeds');
        return [];
      },
    } as unknown as NewsProvider;
    const { service, inputs } = await services([gnews], [feeds]);

    const result = await service.analyzeNews(FLYDUBAI_Q, 'en');

    /* GNews is asked once and never hammered; the publisher-feed lane still runs. */
    expect(calls.filter((c) => c === 'gnews')).toHaveLength(1);
    expect(calls).toContain('rss-feeds');
    expect(inputs).toHaveLength(0);
    const ctx = result.retrievalContext!;
    expect(ctx.verificationNotice).toBe('COVERAGE_INCOMPLETE');
    expect(ctx.retrievalTrace?.lanesUnavailable).toEqual([
      { lane: 'gnews', reason: 'rate-limited' },
    ]);
    expect(ctx.claimAssessments?.[0]?.state).toBe('COVERAGE_INCOMPLETE');
  });

  it('a GNews 429 mid-plan does not cancel the remaining lanes (compound DRC plan)', async () => {
    const calls: Array<{ id: string; q: string }> = [];
    let n = 0;
    const gnews = {
      ...stub('gnews', () => [], []),
      async search(q: string) {
        calls.push({ id: 'gnews', q });
        n += 1;
        if (n >= 2) throw new GNewsProviderError('GNews rate limit reached.', 429, 'rate-limited');
        return [EN_SECURITY];
      },
    } as unknown as NewsProvider;
    const feeds = {
      ...stub('rss-feeds', () => [], []),
      async search(q: string) {
        calls.push({ id: 'rss-feeds', q });
        return [FR_LOCAL];
      },
    } as unknown as NewsProvider;
    const { service } = await services([gnews], [feeds]);

    const result = await service.analyzeNews(Q2, 'en');

    expect(calls.filter((c) => c.id === 'gnews')).toHaveLength(2);
    expect(calls.some((c) => c.id === 'rss-feeds')).toBe(true);
    expect(result.articles.map((x) => x.id)).toEqual(expect.arrayContaining(['en-sec', 'fr-loc']));
    expect(result.retrievalContext?.retrievalTrace?.lanesUnavailable).toEqual([]);
    expect(result.retrievalContext?.retrievalTrace?.lanesSucceeded).toEqual(
      expect.arrayContaining(['gnews', 'rss-feeds']),
    );
  });
});

describe('R2A · the negative-assertion guard (hard requirement)', () => {
  it('finds denials and leaves coverage-scoped hedges alone', () => {
    expect(
      findNegativeAssertions(
        'There is no evidence of an incident involving a passenger plane travelling from Dubai to Israel today.',
      ),
    ).toHaveLength(1);
    expect(findNegativeAssertions('The incident did not occur.')).toHaveLength(1);
    expect(findNegativeAssertions('There were no casualties.')).toHaveLength(1);
    expect(findNegativeAssertions('The available reports do not mention casualties.')).toHaveLength(
      0,
    );
    expect(findNegativeAssertions('The cause has not been confirmed.')).toHaveLength(0);
    expect(
      findNegativeAssertions('It could not be verified from the sources checked.'),
    ).toHaveLength(0);
  });

  it('absence, timeouts, rate limits or unavailable lanes never authorise a denial', () => {
    const denial = 'There is no evidence of an incident involving the flight.';
    expect(canAssertNegative(denial, [], { incomplete: false })).toBe(false);
    expect(canAssertNegative(denial, [GAZA_COLLAPSE, ISRAEL_POLITICS], { incomplete: false })).toBe(
      false,
    );
    expect(canAssertNegative(denial, [], { incomplete: true })).toBe(false);
  });

  it('explicit counter-evidence authorises exactly what it says', () => {
    /* The airline said no injuries → "no casualties" may be stated. */
    expect(
      canAssertNegative('There were no casualties.', [FLIGHT_WIRE], { incomplete: false }),
    ).toBe(true);
    /* … but that is not counter-evidence that the event did not happen. */
    expect(
      canAssertNegative('There is no evidence of an incident.', [FLIGHT_WIRE], {
        incomplete: false,
      }),
    ).toBe(false);
    const denied = a(
      'denied',
      'Airline denies reports of mid-air incident',
      'Flydubai said the report was a false report.',
    );
    expect(canAssertNegative('The incident did not occur.', [denied], { incomplete: false })).toBe(
      true,
    );
  });

  it('end to end: the Production false negative is withheld and the reader is told it could not be verified', async () => {
    const gnews = stub('gnews', () => [FLIGHT_LOCAL], []);
    const { service } = await services(
      [gnews],
      [],
      'There is no evidence of an incident involving a passenger plane travelling from Dubai to Israel today.',
    );
    const result = await service.analyzeNews(FLYDUBAI_Q, 'en');
    expect(result.analysis?.summary).toBe('');
    expect(result.analysis?.briefState?.availability).toBe('withheld-non-compliant');
    expect(result.analysis?.briefState?.reason).toMatch(
      /absence of retrieved evidence is not evidence of absence/,
    );
    expect(result.retrievalContext?.verificationNotice).toBe('NOT_VERIFIED');
  });

  it('a supported "no injuries" statement is served', async () => {
    const gnews = stub('gnews', () => [FLIGHT_WIRE], []);
    const { service } = await services(
      [gnews],
      [],
      'One qualifying report currently indicates the flight made an emergency landing; there were no casualties, according to the airline.',
    );
    const result = await service.analyzeNews(FLYDUBAI_Q, 'en');
    expect(result.analysis?.briefState?.availability).toBe('accepted');
    expect(result.retrievalContext?.verificationNotice).toBeUndefined();
  });
});

describe('R2A · claim states are deterministic', () => {
  const event = deriveEventFrame(FLYDUBAI_Q, 'en')!;
  const ctx = (incomplete = false) => ({
    event: {
      eventType: event.eventType,
      endpoints: event.endpoints,
      identifiers: event.identifiers,
      notBefore: event.notBefore,
    },
    coverageIncomplete: incomplete,
  });

  it('syndicated copies are one family: REPORTED, not corroborated', () => {
    const [occ] = assessClaims(event.claims, [FLIGHT_WIRE, FLIGHT_SYNDICATED], ctx());
    expect(occ!.independentFamilies).toBe(1);
    expect(occ!.state).toBe('REPORTED');
  });

  it('an explicit denial alongside support is DISPUTED', () => {
    const denied = a(
      'denied',
      'Airline denies reports of mid-air incident',
      'The airline called it a false report.',
    );
    const [occ] = assessClaims(event.claims, [FLIGHT_LOCAL, denied], ctx());
    expect(occ!.state).toBe('DISPUTED');
  });

  it('no support: NOT_VERIFIED, or COVERAGE_INCOMPLETE when a lane failed — never a denial', () => {
    expect(assessClaims(event.claims, [], ctx())[0]!.state).toBe('NOT_VERIFIED');
    expect(assessClaims(event.claims, [], ctx(true))[0]!.state).toBe('COVERAGE_INCOMPLETE');
  });

  it('an official source family plus independent reporting is CONFIRMED (feed identity verified)', () => {
    const official = a('cbk', 'Central Bank of Kenya statement on flight', 'Statement.', {
      sourceId: 'feed:cbk-ke',
      url: 'https://www.centralbank.go.ke/statement',
    });
    const spoof = { ...official, id: 'spoof', url: 'https://elsewhere.example/statement' };
    expect(isOfficialSource(official)).toBe(true);
    expect(isOfficialSource(spoof)).toBe(false);
    const occurrence = [{ id: 'occurrence', type: 'OCCURRENCE', text: 'x' }];
    expect(assessClaims(occurrence, [official, FLIGHT_LOCAL], ctx())[0]!.state).toBe('CONFIRMED');
    expect(assessClaims(occurrence, [spoof, FLIGHT_LOCAL], ctx())[0]!.state).toBe(
      'CORROBORATED_REPORTING',
    );
  });
});

describe('R2A · DRC compound plan carries a trace and facet claims', () => {
  it('trace + claim states for security and civilian impact', async () => {
    const gnews = stub(
      'gnews',
      (lang) => (lang === 'fr' ? [FR_LOCAL] : [EN_SECURITY, EN_DISPLACED]),
      [],
    );
    const { service } = await services([gnews]);
    const result = await service.analyzeNews(Q2, 'en');
    const ctx = result.retrievalContext!;
    expect(ctx.retrievalTrace?.queryVariants).toEqual([
      'eastern Congo',
      'Congo [fr]',
      'eastern Congo fighting',
      'eastern Congo displaced',
    ]);
    expect(ctx.retrievalTrace?.independentClusters).toBe(3);
    expect(ctx.claimAssessments?.map((c) => [c.id, c.state])).toEqual([
      ['security', 'CORROBORATED_REPORTING'],
      ['civilian-impact', 'CORROBORATED_REPORTING'],
    ]);
  });
});

/*
  CTO ADDENDUM — TEMPORAL ELIGIBILITY CANNOT BE LOST TO DEDUP ORDERING. Every duplicate collapse
  keeps the FIRST copy it meets. Strict window eligibility is therefore decided per provider
  candidate BEFORE any collapse, so an old representative can never remove a valid in-window
  story. Each case puts the out-of-window copy FIRST.
*/
describe('CTO addendum · an out-of-window duplicate never displaces its in-window copy', () => {
  const Q1W =
    'What has changed in eastern Democratic Republic of the Congo over the last 7 days? Identify any verified security or territorial changes, effects on civilians or displacement, and any important claims that remain disputed.';
  const now = Date.now();
  const policy = {
    reportingWindow: {
      statedPeriod: 'last 7 days',
      from: new Date(now - 7 * 86_400_000).toISOString(),
      to: new Date(now + 60_000).toISOString(),
    },
  };
  const TITLE = 'M23 rebels seize Rubaya mining town in North Kivu';
  const SUMMARY =
    'Fighting in eastern Democratic Republic of Congo displaced thousands of civilians.';
  const OLD_COPY = a('old-copy', TITLE, SUMMARY, {
    publishedAt: new Date(now - 30 * 86_400_000).toISOString(),
  });
  const NEW_COPY = a('new-copy', TITLE, SUMMARY, {
    publishedAt: new Date(now - 2 * 3_600_000).toISOString(),
  });

  it('the hazard is real: the shared duplicate collapse keeps whichever copy comes first', () => {
    expect(deduplicateArticles([OLD_COPY, NEW_COPY]).map((x) => x.id)).toEqual(['old-copy']);
  });

  it('one provider, old copy first: the in-window copy survives', async () => {
    const gnews = stub('gnews', () => [OLD_COPY, NEW_COPY], []);
    const { service, inputs } = await services([gnews]);
    const result = await service.analyzeNews(
      Q1W,
      'en',
      undefined,
      undefined,
      undefined,
      undefined,
      policy,
    );
    const ids = result.articles.map((x) => x.id);
    expect(ids).toContain('new-copy');
    expect(ids).not.toContain('old-copy');
    expect(inputs).toHaveLength(1);
  });

  it('across providers, old copy from the earlier-registered provider: the in-window copy survives', async () => {
    const gnews = stub('gnews', () => [OLD_COPY], []);
    const feeds = stub('rss-feeds', () => [NEW_COPY], []);
    /* both primaries, so the cross-provider collapse is exercised */
    const { service } = await services([gnews, feeds]);
    const result = await service.analyzeNews(
      Q1W,
      'en',
      undefined,
      undefined,
      undefined,
      undefined,
      policy,
    );
    expect(result.articles.map((x) => x.id)).toEqual(['new-copy']);
  });

  it('a NEWER ineligible copy (aggregator-observed time) never displaces the publisher-dated copy', async () => {
    /* GDELT's copy carries an observation time, later than publication: recency alone would pick it. */
    const OBSERVED_COPY = a('observed-copy', TITLE, SUMMARY, {
      publishedAt: new Date(now - 3_600_000).toISOString(),
      publishedAtBasis: 'observed',
    });
    const PUBLISHER_COPY = a('publisher-copy', TITLE, SUMMARY, {
      publishedAt: new Date(now - 5 * 3_600_000).toISOString(),
    });
    const gdelt = stub('gdelt-doc', () => [OBSERVED_COPY], []);
    const gnews = stub('gnews', () => [PUBLISHER_COPY], []);
    const { service } = await services([gdelt, gnews]);
    const result = await service.analyzeNews(
      Q1W,
      'en',
      undefined,
      undefined,
      undefined,
      undefined,
      policy,
    );
    expect(result.articles.map((x) => x.id)).toEqual(['publisher-copy']);
  });

  it('a future-dated copy (after the window end) never displaces the in-window copy', async () => {
    const FUTURE_COPY = a('future-copy', TITLE, SUMMARY, {
      publishedAt: new Date(now + 3 * 86_400_000).toISOString(),
    });
    const gnews = stub('gnews', () => [FUTURE_COPY, NEW_COPY], []);
    const { service } = await services([gnews]);
    const result = await service.analyzeNews(
      Q1W,
      'en',
      undefined,
      undefined,
      undefined,
      undefined,
      policy,
    );
    expect(result.articles.map((x) => x.id)).toEqual(['new-copy']);
  });

  it('the country feed (its own duplicate collapse) keeps the in-window copy', async () => {
    const RW_TITLE = 'Rwanda opens new Kigali border post with DR Congo';
    const OLD_RW = a('old-rw', RW_TITLE, 'Rwanda officials opened the post.', {
      publishedAt: new Date(now - 30 * 86_400_000).toISOString(),
    });
    const NEW_RW = a('new-rw', RW_TITLE, 'Rwanda officials opened the post.', {
      publishedAt: new Date(now - 3_600_000).toISOString(),
    });
    const gnews = stub('gnews', () => [OLD_RW, NEW_RW], []);
    const { service } = await services([gnews]);
    const result = await service.analyzeNews(
      'What has happened in Rwanda over the last 7 days?',
      'en',
      undefined,
      undefined,
      undefined,
      undefined,
      policy,
    );
    const ids = result.articles.map((x) => x.id);
    expect(ids).toContain('new-rw');
    expect(ids).not.toContain('old-rw');
  });
});
