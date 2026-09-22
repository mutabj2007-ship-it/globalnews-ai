import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readElection, readPolitics } from './retainedReaders';
import { ElectionEvidenceScreen } from '@/components/election/ElectionEvidenceScreen';
import { PoliticsEvidenceScreen } from '@/components/politics/PoliticsEvidenceScreen';

describe('retained evidence dashboard binding', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each(['en', 'pl'] as const)(
    'keeps a disabled election reader closed in %s',
    async (locale) => {
      const fetcher = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            domain: 'ELECTION',
            state: 'COVERAGE_GAP',
            locale,
            records: [],
            reason: 'READER_DISABLED',
          }),
        ),
      );
      const result = await readElection(locale);
      const html = renderToStaticMarkup(
        createElement(ElectionEvidenceScreen, { locale, compact: true, result }),
      );
      expect(html).toContain('READER_DISABLED');
      expect(html).not.toContain('data-eln="contestant"');
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher.mock.calls[0][0]).toMatch(
        new RegExp('/election/evidence/ke\\?locale=' + locale + '$'),
      );
      expect(fetcher.mock.calls[0][1]?.cache).toBe('no-store');
    },
  );
  it.each(['en', 'pl'] as const)(
    'distinguishes empty Politics retention from unavailable in %s',
    async (locale) => {
      const fetcher = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            observations: [],
            absence: 'NOT_ASSESSED',
            truncated: false,
            acquisition: 'RETAINED_ONLY',
          }),
        ),
      );
      const result = await readPolitics();
      const html = renderToStaticMarkup(createElement(PoliticsEvidenceScreen, { locale, result }));
      expect(html).toContain('NOT_ASSESSED');
    if (locale === 'pl') { expect(html).toContain('Proces legislacyjny'); expect(html).toContain('Nie oceniono'); expect(html).not.toContain('Legislative subject'); }
      expect(html).toContain(locale === 'pl' ? 'nie oznacza, że nic' : 'does not mean nothing');
      fetcher.mockRejectedValue(new Error('offline'));
      const unavailable = await readPolitics();
      expect(unavailable.status).toBe('UNAVAILABLE');
      expect(
        renderToStaticMarkup(
          createElement(PoliticsEvidenceScreen, { locale, result: unavailable }),
        ),
      ).toContain('UNAVAILABLE');
    },
  );
  it.each([
    null,
    {},
    { acquisition: 'LIVE_NEWS', observations: [] },
    { domain: 'ELECTION', state: 'EVIDENCE', records: [] },
  ])('withholds malformed or ungoverned response %j', async (payload) => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(JSON.stringify(payload)));
    expect((await readPolitics()).status).toBe('UNAVAILABLE');
    expect((await readElection('en')).status).toBe('UNAVAILABLE');
  });
  it('does not turn HTTP errors into empty retention', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }));
    expect((await readPolitics()).status).toBe('UNAVAILABLE');
  });
  it('keeps withheld and partial Politics reads explicit', () => {
    for (const locale of ['en', 'pl'] as const) {
      const html = renderToStaticMarkup(
        createElement(PoliticsEvidenceScreen, {
          locale,
          result: {
            status: 'READ',
            data: {
              observations: [],
              absence: 'EVIDENCE_WITHHELD',
              truncated: true,
              acquisition: 'RETAINED_ONLY',
            },
          },
        }),
      );
      expect(html).toContain('EVIDENCE_WITHHELD');
      expect(html).toContain(locale === 'pl' ? 'Odpowiedź częściowa' : 'Partial response');
    }
  });
});

describe('admitted declaration projection', () => {
  afterEach(() => jest.restoreAllMocks());
  const bundle = JSON.parse(
    readFileSync(
      resolve(
        __dirname,
        '../../../../backend/src/modules/election/data/6de1471074dc8162b038b949c0283fca029dea571a6ef6ee0564b89371cbe5fd.json',
      ),
      'utf8',
    ),
  );
  it.each(['en', 'pl'] as const)(
    'renders only the documented declaration in %s',
    async (locale) => {
      const raw = bundle.records[0];
      const label = locale === 'pl' ? 'OFICJALNE OGŁOSZENIE' : 'OFFICIAL DECLARATION';
      const record = {
        ...raw,
        source: { ...raw.source },
        label,
        qualifiedReading: label + ' · ' + raw.votesAsPublished,
      };
      const fetcher = jest.spyOn(globalThis, 'fetch').mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              domain: 'ELECTION',
              locale,
              state: 'EVIDENCE',
              records: [record],
            }),
          ),
      );
      const result = await readElection(locale);
      expect(result.status).toBe('READ');
      const html = renderToStaticMarkup(
        createElement(ElectionEvidenceScreen, { locale, compact: false, result }),
      );
      for (const value of [
        'Ol Kalou',
        'Nyandarua',
        'ke-ol-kalou-mna-2026-07-16',
        '35,440',
        'OFFICIAL_DECLARATION',
        raw.capturedAt,
        raw.source.artifactSha256,
      ])
        expect(html).toContain(value);
      record.source.url = 'javascript:alert(1)';
      expect((await readElection(locale)).status).toBe('UNAVAILABLE');
      fetcher.mockResolvedValue(
        new Response(
          JSON.stringify({ domain: 'ELECTION', locale, state: 'COVERAGE_GAP', records: [record] }),
        ),
      );
      expect((await readElection(locale)).status).toBe('UNAVAILABLE');
    },
  );
});
