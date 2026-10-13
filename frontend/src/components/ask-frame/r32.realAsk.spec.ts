import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { evidencePlacesOf } from '@/lib/ask/askEvidencePlaces';
import { askR32Strings } from '@/lib/ask/askR32Strings';
import { AskEvidencePlaces } from './AskEvidencePlaces';
import { AskR2TurnView } from './AskR2TurnView';

/*
  MASTER CTO R32 / R33 — the approved experience inside the REAL /ask (not /ask/preview):
  places of the cited reports inside the answer (country level, no map), the job sheet reachable
  from a job-context answer, the before / latest comparison inside the followed check and My
  updates, and the static design gallery retired. Nothing here fetches on render.
*/
const SRC = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(SRC, ...p), 'utf8');
const byAsk = (root: ReactTestInstance, id: string) =>
  root.findAll((n) => n.props['data-ask'] === id && typeof n.type === 'string');
const textOf = (node: ReactTestInstance): string =>
  node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');

const src = (articleId: string) => ({ articleId, publisher: 'P', title: 't', url: 'https://p.example/x', publishedAt: '2026-10-12T08:00:00Z' });
const art = (id: string, countryCode?: string) => ({ id, ...(countryCode === undefined ? {} : { countryCode }) });

let fetchSpy: jest.SpyInstance;
beforeEach(() => {
  fetchSpy = jest.spyOn(globalThis, 'fetch' as never).mockImplementation((() => {
    throw new Error('no network expected');
  }) as never);
});
afterEach(() => fetchSpy.mockRestore());

describe('R32 · places of the cited reports (pure)', () => {
  it('groups THIS answer’s cited reports by recorded country, most-cited first', () => {
    const view = evidencePlacesOf(
      [src('a'), src('b'), src('c'), src('d')],
      [art('a', 'RW'), art('b', 'KE'), art('c', 'RW'), art('d', 'UG'), art('not-cited', 'TZ')],
      'en',
    )!;
    expect(view.places.map((p) => [p.iso3, p.reports])).toEqual([['RWA', 2], ['KEN', 1], ['UGA', 1]]);
    expect(view.notEstablished).toBe(0);
  });
  it('a report with no country, an unknown code, or a DR Congo / Republic of the Congo identity is "not established"', () => {
    const view = evidencePlacesOf(
      [src('a'), src('b'), src('c'), src('d'), src('e')],
      [art('a'), art('b', 'ZZ'), art('c', 'CD'), art('d', 'CG'), art('e', 'RW')],
      'en',
    )!;
    expect(view.places.map((p) => p.iso3)).toEqual(['RWA']);
    expect(view.notEstablished).toBe(4);
  });
  it('a cited source whose article is absent is not established; no cited report → nothing to place', () => {
    expect(evidencePlacesOf([src('missing')], [], 'en')!.notEstablished).toBe(1);
    expect(evidencePlacesOf([], [art('a', 'RW')], 'en')).toBeNull();
  });
  it('names the country in the reader’s locale', () => {
    expect(evidencePlacesOf([src('a')], [art('a', 'DE')], 'pl')!.places[0].name).toBe('Niemcy');
  });
});

const payloadWith = (sources: unknown[], articles: unknown[]) =>
  ({ analysis: { articles, analysis: { sources } } }) as never;

describe('R32 · places inside the answer (rendered)', () => {
  it('lists places with counts, the not-established line and the basis; "Ask about" stages the place draft only', () => {
    const onStageDraft = jest.fn();
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(
        createElement(AskEvidencePlaces, {
          payload: payloadWith([src('a'), src('b'), src('c')], [art('a', 'RW'), art('b', 'RW'), art('c')]),
          locale: 'en' as DisplayLocale,
          onStageDraft,
        }),
      );
    });
    const rows = byAsk(r.root, 'evidence-place');
    expect(rows.map(textOf)).toEqual(['Rwanda2 reportsAsk about Rwanda']);
    expect(textOf(byAsk(r.root, 'evidence-place-unestablished')[0])).toBe('Location not established1 report');
    expect(textOf(byAsk(r.root, 'evidence-places')[0])).toContain('Not checked on a map');
    act(() => byAsk(r.root, 'evidence-place-ask')[0].props.onClick());
    expect(onStageDraft).toHaveBeenCalledWith('What are the latest developments in Rwanda?');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it('a display-only answer lists places without the action; no cited report renders nothing', () => {
    const html = renderToStaticMarkup(
      createElement(AskEvidencePlaces, { payload: payloadWith([src('a')], [art('a', 'KE')]), locale: 'en' as DisplayLocale }),
    );
    expect(html).toContain('Kenya');
    expect(html).not.toContain('evidence-place-ask');
    expect(
      renderToStaticMarkup(createElement(AskEvidencePlaces, { payload: payloadWith([], []), locale: 'en' as DisplayLocale })),
    ).toBe('');
  });
  it('the answer view renders it inside the turn, before the toolbar, and never offers the action on a display-only turn', () => {
    const view = read('components', 'ask-frame', 'AskR2TurnView.tsx');
    expect(view).toMatch(/<AskEvidencePlaces payload=\{payload\} locale=\{locale\} onStageDraft=\{displayOnly \? undefined : onStageDraft\} \/>/);
    expect(view.indexOf('<AskEvidencePlaces')).toBeLessThan(view.indexOf('<AskAnswerToolbar'));
    expect(view).not.toMatch(/<svg|maplibre|leaflet/i);
  });
  it.each(['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar'])('%s carries every R32 string', (locale) => {
    const s = askR32Strings(locale);
    for (const value of Object.values(s)) {
      const text = typeof value === 'function' ? (value as (...a: unknown[]) => string)('X', 'Y') : value;
      expect(String(text).length).toBeGreaterThan(3);
    }
  });
});

describe('R32 · jobs inside the real Ask', () => {
  const JOB_TURN = {
    schema: 'ask-r2-result/1',
    route: { questionClass: 'CURRENT_REPORTING', terminalState: 'EXECUTABLE' },
    answer: { state: 'INSUFFICIENT', basis: 'NO_REQUIRED_EVIDENCE_OBTAINED', missingRoles: ['REPORTING'] },
    analysis: null,
    background: null,
    chips: { kind: 'NONE' },
    continuation: { answeredAs: 'Should I move to Kigali for work?', kind: 'JOB_CONTEXT' },
  };
  const render = (props: Record<string, unknown>) =>
    renderToStaticMarkup(
      createElement(AskR2TurnView as never, {
        turn: { question: 'And for nurses?', payload: JOB_TURN },
        locale: 'en',
        context: undefined,
        ...props,
      } as never),
    );
  it('a job-context answer offers the job sheet (R38: "Ask about jobs and careers"); without the handler, nothing', () => {
    expect(render({ onOpenJobs: () => undefined })).toMatch(/data-ask="job-entry"[^>]*>Ask about jobs and careers</);
    expect(render({})).not.toContain('data-ask="job-entry"');
  });
  it('focus returns to the entry that opened the sheet (the G3 cue or the answer’s job entry)', () => {
    expect(read('components', 'ask-frame', 'AskFrameScreen.tsx')).toContain(
      `'[data-ask="cue-g3"], [data-ask="job-entry"]'`,
    );
  });
});

describe('R32 · before / latest inside the followed check and My updates', () => {
  it('the Ask check offers "See what changed" only after the check is recorded, and reads only on request', () => {
    const check = read('components', 'ask-frame', 'AskFollowCheck.tsx');
    expect(check).toMatch(/data-ask="follow-compare-toggle"/);
    expect(check).toMatch(/\{comparing && \(\s*<div data-ask="follow-compare">\s*<AskCheckComparison briefingId=\{followId\} check=\{recorded\}/);
  });
  it('My updates shows the comparison inline only when the latest check recorded a real pair', () => {
    const updates = read('components', 'ask', 'MyUpdatesClient.tsx');
    expect(updates).toMatch(/const full = selectCheck\(detail, LATEST_CHECK\);\s*return full !== null && recordStatus\(full\) === null/);
    expect(updates).toMatch(/data-ask="followed-compare"/);
  });
});

describe('R32 · the static design gallery is retired', () => {
  it('/ask/preview and its gallery are gone from the application', () => {
    for (const p of [
      ['app', 'ask', 'preview', 'page.tsx'],
      ['components', 'ask', 'AskDesignPreview.tsx'],
      ['lib', 'ask', 'designPreviewGate.ts'],
      ['lib', 'ask', 'r28PreviewStrings.ts'],
    ]) {
      expect(existsSync(join(SRC, ...p))).toBe(false);
    }
  });
});
