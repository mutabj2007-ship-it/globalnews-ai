import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readHumanitarianObservations } from './humanitarianRead';
import { humanitarianReadLabel, humanitarianReadExplanation } from './humanitarianReadLabel';
import { humanitarianUnassessedView } from '@/components/humanitarian/HumanitarianModel';
import { HUM_FRAME_STATES } from './humState';

describe('Humanitarian frontend read binding', () => {
  afterEach(() => jest.restoreAllMocks());
  it('reads only the backend and admits a validated absence', async () => {
    const spy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      kind: 'UNAVAILABLE', absence: 'NOT_ASSESSED', observations: [],
    })));
    const read = await readHumanitarianObservations();
    expect(read.absence).toBe('NOT_ASSESSED');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toMatch(/\/humanitarian\/observations$/);
    expect(spy.mock.calls[0]?.[1]).toMatchObject({cache:'no-store',redirect:'error'});
    expect(humanitarianReadLabel(read, 'en')).toContain('Not assessed');
  });
  it.each(['error', 'http', 'json', 'oversized', 'unadmitted', 'no-results'])(
    'fails closed on %s without fixture substitution', async failure => {
      const spy = jest.spyOn(global, 'fetch');
      if (failure === 'error') spy.mockRejectedValue(new Error('offline'));
      else spy.mockResolvedValue(failure === 'http' ? new Response('', {status:503}) :
        new Response(failure === 'json' ? '<html>' : failure === 'oversized' ? ' '.repeat(4097) :
          JSON.stringify({ kind: failure === 'no-results' ? 'NO_RESULTS' : 'OBSERVATIONS',
            observations: [{occurredAt:'2026-01-01', revisionOrdinal:1, coordinates:[1,2]}] })));
      expect(await readHumanitarianObservations()).toEqual({
        kind:'UNAVAILABLE',absence:'COVERAGE_GAP',observations:[],
      });
    });
  it('does not convert design jurisdictions or claims into runtime observations', () => {
    for (const frame of HUM_FRAME_STATES) {
      const view = humanitarianUnassessedView(frame);
      expect(JSON.stringify(view)).not.toMatch(/Kivu|Sudan|Poland|Rutshuru/);
      expect(view.evidence.standingClaimOnRecord).toBe(false);
      expect(view.revision).toBeNull();
    }
  });
  it('binds the same read into desktop and compact server entries and existing frames', () => {
    for (const [page, screen] of [['page.tsx','HumanitarianScreen'], ['compact/page.tsx','HumanitarianCompactScreen']]) {
      expect(readFileSync(join(__dirname,'../../app/humanitarian',page!), 'utf8')).toContain('retainedRead={retainedRead}');
      const source = readFileSync(join(__dirname,'../../components/humanitarian',screen!+'.tsx'),'utf8');
      expect(source).toContain('humanitarianReadLabel(retainedRead, locale)');
      expect(source).toContain('humanitarianUnassessedView(state.frame)');
    }
  });
});

describe('Humanitarian EN/PL empty-state honesty', () => {
  it('keeps not-assessed distinct from unavailable in both offered languages', () => {
    const unassessed = {kind:'UNAVAILABLE',absence:'NOT_ASSESSED',observations:[]} as const;
    const unavailable = {kind:'UNAVAILABLE',absence:'COVERAGE_GAP',observations:[]} as const;
    expect(humanitarianReadLabel(unassessed,'en')).toContain('Not assessed');
    expect(humanitarianReadLabel(unavailable,'en')).toContain('Coverage gap');
    expect(humanitarianReadLabel(unassessed,'pl')).toContain('Nie oceniono');
    expect(humanitarianReadLabel(unavailable,'pl')).toContain('Luka w pokryciu');
    for (const locale of ['en','pl'] as const) {
      expect(humanitarianReadLabel(unassessed,locale)).not.toEqual(humanitarianReadLabel(unavailable,locale));
    }
  });
});

describe('existing assessment region evidence explanation', () => {
  it.each(['en', 'pl'] as const)('distinguishes unavailable reads from the release gate in %s', locale => {
    const closed = humanitarianReadExplanation({kind:'UNAVAILABLE',absence:'NOT_ASSESSED',observations:[]}, locale);
    const gap = humanitarianReadExplanation({kind:'UNAVAILABLE',absence:'COVERAGE_GAP',observations:[]}, locale);
    expect(closed).not.toEqual(gap);
    expect(closed).toContain(locale === 'pl' ? 'kontekstem' : 'contextual');
    expect(gap).toContain(locale === 'pl' ? 'niedostępny' : 'unavailable');
  });
});
