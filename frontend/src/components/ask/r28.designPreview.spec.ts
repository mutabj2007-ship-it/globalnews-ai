/* CTO R28 — the Alpha-only design preview of the 23 unbuilt R3 presets. */
const fetchSpy = jest.fn();
const accountFetch = jest.fn();
jest.mock('@/lib/api/accountFetch', () => ({ accountFetch: (...a: unknown[]) => accountFetch(...a) }));

// eslint-disable-next-line import/first
import { createElement } from 'react';
// eslint-disable-next-line import/first
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
// eslint-disable-next-line import/first
import type { DisplayLocale } from '@globalnews-ai/shared';
// eslint-disable-next-line import/first
import { AskDesignPreview } from './AskDesignPreview';
// eslint-disable-next-line import/first
import { designPreviewAvailable } from '@/lib/ask/designPreviewGate';
// eslint-disable-next-line import/first
import { R28_PREVIEW_EN, r28PreviewStringsFellBack } from '@/lib/ask/r28PreviewStrings';

const render = (locale: DisplayLocale): ReactTestRenderer => {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(createElement(AskDesignPreview, { locale }));
  });
  return r;
};
const byData = (r: ReactTestRenderer, v: string): ReactTestInstance[] =>
  r.root.findAll((n) => n.props['data-ask'] === v && typeof n.type === 'string');
const textOf = (node: ReactTestInstance): string =>
  node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');

/* The 23 presets the R3 matrix left unbuilt (ASK-R3-RELEASE/01): every one must be drawn here. */
const PRESETS = [
  'D10-map-region', 'D10-map-list', 'D10-marker', 'D10-map-place', 'D11-route', 'D11-route-edit', 'D11-place',
  'D14-schedule',
  'J02-active', 'J02-next', 'J03-results', 'J03-detail', 'J04-source', 'J04-handoff', 'J05-follow', 'J05-updates', 'J05-change',
  'P02-slow', 'P02-cancelled', 'P02-retry', 'P02-reduced', 'P02-keyboard', 'P02-single',
];

beforeEach(() => {
  fetchSpy.mockReset();
  accountFetch.mockReset();
  (globalThis as { fetch?: unknown }).fetch = fetchSpy;
});

describe('R28 · Ask design preview (Alpha only, labelled, non-actionable)', () => {
  it('the gate: a 404 on the standalone (Production) root, available on the platform root (Alpha)', () => {
    expect(designPreviewAvailable({})).toBe(false);
    expect(designPreviewAvailable({ GNA_PUBLIC_ROOT: 'standalone' })).toBe(false);
    expect(designPreviewAvailable({ GNA_PUBLIC_ROOT: 'platform' })).toBe(true);
  });

  it('a page-level "not live" banner is shown', () => {
    const r = render('en' as DisplayLocale);
    const banner = byData(r, 'preview-banner');
    expect(banner).toHaveLength(1);
    expect(textOf(banner[0])).toContain('not live');
  });

  it('every section (map, schedule, jobs, progress) carries its own "Preview: not live" badge and a reason', () => {
    const r = render('en' as DisplayLocale);
    const sections = byData(r, 'preview-section');
    expect(sections.map((s) => s.props['data-preview-section'])).toEqual(['map', 'schedule', 'jobs', 'progress']);
    for (const s of sections) {
      expect(s.findAll((n) => n.props['data-ask'] === 'preview-badge').map(textOf)).toEqual([R28_PREVIEW_EN.badge]);
      expect(textOf(s.findAll((n) => n.props['data-ask'] === 'preview-reason')[0])).toMatch(/^Not live: /);
    }
  });

  it('all 23 unbuilt R3 presets are drawn', () => {
    const r = render('en' as DisplayLocale);
    const drawn = new Set(
      r.root
        .findAll((n) => typeof n.props['data-preset'] === 'string' && typeof n.type === 'string')
        .flatMap((n) => String(n.props['data-preset']).split(' ')),
    );
    for (const p of PRESETS) expect(drawn.has(p)).toBe(true);
    expect(drawn.size).toBe(PRESETS.length);
  });

  it('nothing is actionable: every button is disabled, there is no link, form, input or image', () => {
    const r = render('en' as DisplayLocale);
    const buttons = r.root.findAll((n) => n.type === 'button');
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) {
      expect(b.props.disabled).toBe(true);
      expect(b.props.onClick).toBeUndefined();
    }
    for (const tag of ['a', 'form', 'input', 'select', 'textarea', 'img']) {
      expect(r.root.findAll((n) => n.type === tag)).toHaveLength(0);
    }
  });

  it('rendering makes no network or account call', () => {
    render('en' as DisplayLocale);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(accountFetch).not.toHaveBeenCalled();
  });

  it('no real employer, publisher, place or URL: samples only', () => {
    const r = render('en' as DisplayLocale);
    const text = textOf(r.root);
    expect(text).not.toMatch(/https?:\/\//);
    for (const real of ['Kigali', 'Nairobi', 'Kinshasa', 'Reuters', 'BBC', 'LinkedIn', 'Indeed', 'Google', 'BWIZA', 'Rwanda', 'Kenya', 'Congo']) {
      expect(text).not.toContain(real);
    }
    expect(text).toContain('Sample');
    expect(text).toContain('Example employer');
  });

  it('the page follows the reader locale direction (Arabic is RTL), copy falls back to English as declared', () => {
    const ar = render('ar' as DisplayLocale);
    expect(byData(ar, 'design-preview')[0].props.dir).toBe('rtl');
    const en = render('en' as DisplayLocale);
    expect(byData(en, 'design-preview')[0].props.dir).toBe('ltr');
    expect(r28PreviewStringsFellBack('ar' as DisplayLocale)).toBe(true);
    expect(r28PreviewStringsFellBack('en' as DisplayLocale)).toBe(false);
  });
});
