import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PoliticsEsReadModelV1 } from '@globalnews-ai/shared';
import { EarlySignalModelView, EarlySignalPanel, EarlySignalStatusLine } from './EarlySignalPanel';
import { PoliticsScreen } from './PoliticsScreen';
import { PoliticsCompactScreen } from './PoliticsCompactScreen';
import { POLITICS_EARLY_SIGNAL_PUBLIC_READ, publicReadOf } from '@/lib/politics/earlySignalRead';
import STATES from '@/lib/politics/__fixtures__/es-states.v1.e9b77ce.json';

/*
  MASTER CTO R66 · #90 — the Politics early-signal frontend against contract politics-early-signal/v1.
  The eight models are the Politics OFFLINE ENGINE's own output at e9b77ce over its STATE_FIXTURES
  (synthetic, test/dev only), not hand-written UI data. Rules: Politics' 10-FE-CONTRACT-FOR-MAIN.md.
*/
const models = STATES as unknown as Record<string, PoliticsEsReadModelV1>;
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
const view = (key: string, locale = 'en') =>
  renderToStaticMarkup(createElement(EarlySignalModelView, { locale: locale as never, model: models[key]! }));
const emptyRead = { observations: [], absence: null } as never;

let fetchSpy: jest.SpyInstance;
beforeEach(() => {
  fetchSpy = jest.spyOn(globalThis, 'fetch' as never).mockImplementation((() => {
    throw new Error('no network expected');
  }) as never);
});
afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});

describe('R66 · the reader page: public read is DISABLED (code literal); nothing synthetic is shown', () => {
  it('the public read is the DISABLED literal of the backend adapter', () => {
    expect(POLITICS_EARLY_SIGNAL_PUBLIC_READ).toEqual({ contractVersion: 'politics-early-signal/v1', status: 'DISABLED', reason: 'RELEASE_GATES_NOT_MET' });
    expect(Object.isFrozen(POLITICS_EARLY_SIGNAL_PUBLIC_READ)).toBe(true);
  });

  it.each([
    ['desktop', PoliticsScreen],
    ['compact', PoliticsCompactScreen],
  ])('%s Politics screen: one honest line in the context list, no model, no fixture, no open control', (_l, Screen) => {
    const html = renderToStaticMarkup(createElement(Screen as never, { locale: 'en', read: emptyRead }));
    expect(html).toContain('data-es="public-state"');
    expect(text(html)).toContain('Early signals are not available yet. No source is cleared for this use, and the release checks have not been completed.');
    expect(html).not.toContain('data-es="model"');
    expect(html).not.toContain('data-es="open"');
    expect(html).not.toMatch(/SYNTHETIC|syn:pub/);
  });

  it('a synthetic model is refused for a public read, whatever hands it over', () => {
    for (const model of Object.values(models).filter((m) => m.dataOrigin === 'SYNTHETIC_FIXTURE')) {
      expect(publicReadOf(model)).toEqual({ contractVersion: 'politics-early-signal/v1', status: 'REFUSED', reason: 'SYNTHETIC_DATA_NEVER_PUBLIC' });
    }
    const html = renderToStaticMarkup(createElement(EarlySignalPanel, { locale: 'en', read: publicReadOf(models.EVIDENCE!) }));
    expect(html).not.toContain('data-es="model"');
    expect(text(html)).toContain('This view can only show reviewed, rights-cleared reporting.');
  });

  it('only an OK read offers the control that opens the full view', () => {
    const ok = { contractVersion: 'politics-early-signal/v1', status: 'OK', model: models.ABSENCE_NO_MATCH! } as const;
    expect(renderToStaticMarkup(createElement(EarlySignalStatusLine, { locale: 'en', read: ok, onOpen: () => undefined }))).toContain('data-es="open"');
  });
});

describe('R66 · the eight named states, from the Politics engine (render rules)', () => {
  it('the fixture set is exactly the contract\'s eight states', () => {
    expect(Object.keys(models).sort()).toEqual(['ABSENCE_NO_MATCH', 'CORRECTED', 'DISPUTED', 'EVIDENCE', 'NOT_CHECKED', 'NO_CHANGE', 'PROVIDER_FAILURE', 'RIGHTS_WITHHELD'].sort());
  });
  it('EVIDENCE: independence counted as chains; an observed effect; a next check that is not a schedule', () => {
    const t = text(view('EVIDENCE'));
    expect(t).toContain('Reported by 2 independent sources');
    expect(t).toContain('An effect is reported by independent sources');
    expect(t).toMatch(/Worth re-checking after .+ for /);
    expect(t).toContain('Last checked');
  });
  it('ABSENCE_NO_MATCH: a completed check with no match is never "nothing happened"', () => {
    expect(text(view('ABSENCE_NO_MATCH'))).toContain('The check completed and found no matching reports. This is not a statement that nothing happened.');
  });
  it('RIGHTS_WITHHELD: withheld items are counted and named, never treated as absent', () => {
    const t = text(view('RIGHTS_WITHHELD'));
    expect(t).toContain('2 items not available to us');
    expect(t).toContain('Reports were found, but their wording is not available to us under current source rights.');
    expect(t).not.toContain('no matching reports');
  });
  it('NOT_CHECKED: "Not checked yet" and no invented time', () => {
    const t = text(view('NOT_CHECKED'));
    expect(t).toContain('Not checked yet');
    expect(t).toContain('No check has run, so nothing can be said yet.');
    expect(t).not.toContain('Last checked');
  });
  it('NO_CHANGE: "No material change since <last completed check>"', () => {
    expect(text(view('NO_CHANGE'))).toMatch(/No material change since Jan 10, 2026/);
  });
  it('PROVIDER_FAILURE: "Last checked" stays the previous completed check; the failed attempt is named separately', () => {
    const t = text(view('PROVIDER_FAILURE'));
    expect(t).toMatch(/Last checked Jan 9, 2026/);
    expect(t).toMatch(/Last attempt Jan 10, 2026.*could not be completed/);
    expect(t).toContain('The latest check could not be completed.');
  });
  it('DISPUTED: both attributed accounts side by side, no verdict', () => {
    const html = view('DISPUTED');
    expect(html.match(/data-es="disputed-account"/g)).toHaveLength(2);
    expect(text(html)).toContain('Accounts differ (human-reviewed)');
  });
  it('CORRECTED: the correction is kept in the history (append-only) and needs human review', () => {
    const html = view('CORRECTED');
    expect(text(html)).toContain('Corrected by source');
    expect(html).toContain('data-es-claim-status="CORRECTED"');
    expect(html).toContain('data-es-claim-status="CURRENT"');
    expect(text(html)).toContain('Needs human review before any wider use');
  });
});

describe('R66 · never-render rules, over every state and both authored locales', () => {
  const FORBIDDEN = [
    /\bconfirmed\b/i, /\bverified\b/i, /\bbreaking\b/i, /new signal/i, /all quiet/i, /up to date/i, /first report/i,
    /%/, /countdown/i, /we will check/i, /monitor/i, /probabilit/i, /likelihood/i, /forecast/i,
  ];
  it.each(Object.keys(STATES))('%s (en): no forbidden wording and no raw engine code', (key) => {
    const t = text(view(key));
    for (const re of FORBIDDEN) expect(t).not.toMatch(re);
    expect(t).not.toMatch(/\b[A-Z]{2,}_[A-Z_]{3,}\b/);
    expect(t).not.toContain('not described yet');
  });
  it.each(Object.keys(STATES))('%s (pl): Polish copy, codes disclosed as English, no raw code', (key) => {
    const t = text(view(key, 'pl'));
    expect(t).not.toMatch(/\b[A-Z]{2,}_[A-Z_]{3,}\b/);
    if (models[key]!.developments.some((d) => d.impact.hypotheses.length > 0)) {
      expect(t).toContain('Opisy możliwego wpływu i warunków ponownego sprawdzenia są na razie po angielsku.');
    }
  });
  it('a locale without authored copy falls back to English and says so', () => {
    expect(text(view('EVIDENCE', 'fr'))).toContain('Early signals are shown in English until this language is reviewed.');
  });
});

describe('R66 · fixtures are test/dev only', () => {
  it('the development preview route is not found under any non-development build', async () => {
    const { default: Page } = await import('@/app/politics-visual-preview/early-signal-states/page');
    await expect(Page()).rejects.toThrow(/NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK/);
  });
  it('no runtime file imports the fixture models', () => {
    const { readdirSync, readFileSync, statSync } = jest.requireActual('fs') as typeof import('fs');
    const { join } = jest.requireActual('path') as typeof import('path');
    const root = join(__dirname, '..', '..');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && !/\.spec\.tsx?$/.test(name) && readFileSync(p, 'utf8').includes('es-states.v1.e9b77ce.json')) offenders.push(p);
      }
    };
    walk(root);
    /* the dev page names the file only as a disk path read under `next dev`; it does not import it */
    expect(offenders.map((p) => p.replace(/\\/g, '/').split('/src/')[1])).toEqual(['app/politics-visual-preview/early-signal-states/page.tsx']);
    expect(readFileSync(join(root, 'app/politics-visual-preview/early-signal-states/page.tsx'), 'utf8')).not.toMatch(/import .*es-states/);
  });
});
