import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { getDictionary } from '@/lib/i18n/dictionaries';
import {
  MI_AI_ACTION_OFF,
  MI_AI_ACTION_ON,
  MI_LOCAL_ACTION,
  MI_SELECTION_BAR,
  MI_SELECTION_MODE_CONTROL,
} from './miPresentation';
import type { FixtureStory } from './devFixtures';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MY INTELLIGENCE — COLOR / ACTION-AWARENESS R1
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   cyan   navigating / selecting / local, free controls
 *   sand   an AI compute action (and the warm "selection mode" awareness)
 *   violet a tier boundary — none exists here, so none is drawn
 *   mint   an ACTIVE Watch — Watch is inactive, so none is drawn
 *
 * Colour is never the only signal: every AI action also carries the governed
 * lightning mark, the AI tag and an accessible name that says "AI action".
 */

/*
  SELECT SAND-AWARENESS — the real client, with only the transport and the
  data hook replaced, so "pressing Select sends nothing" is measured on the
  product's own handler rather than asserted about a component in isolation.
*/
jest.mock('@/lib/api/analysisApi', () => ({ analyzeNews: jest.fn() }));
jest.mock('@/components/search/SearchPageClient', () => ({ resolveAnalysisErrorMessage: () => 'error' }));
jest.mock('next/link', () => {
  const react = jest.requireActual('react');
  return { __esModule: true, default: ({ href, children }: { href: string; children: unknown }) => react.createElement('a', { href }, children) };
});
jest.mock('./useMyIntelligenceData', () => {
  const stories = [0, 1].map((i) => ({
    articleRef: `${'cd'.repeat(31)}0${i}`,
    id: `z${i}`,
    url: `https://example.com/sample/select-${i}`,
    title: `Select story ${i}`,
    sourceName: 'Example Wire',
    publishedAt: '2026-09-26T08:00:00.000Z',
    countryCode: 'PL',
    category: 'Economy',
    savedAt: '2026-09-26T09:00:00.000Z',
  }));
  const data = {
    isLoading: false, isSignedIn: true, userEmail: null, userName: 'Reader', previousSeenAt: null, isFirstVisit: false,
    boundarySource: 'live', boundaryFailed: false, newSince: [], newSinceCount: 0, newSinceSource: 'live',
    saved: stories, savedSource: 'live', forYou: [], forYouSource: 'live', follows: [], followsSource: 'live',
    recent: [], recentSource: 'live', usesFixtures: false, hasError: false, isDegraded: false,
    savedRefs: new Set(stories.map((s) => s.url)), toggleSaved: () => undefined, retry: () => undefined,
    interests: [], interestsLoaded: true, forYouFiltered: false, forYouMatchCount: 0, forYouBroad: [],
    saveInterests: async () => true, isSavingInterests: false,
  };
  return { useMyIntelligenceData: () => data };
});

/* A minimal browser window for the rail's scroll measurement. */
const target = new EventTarget();
Object.assign(globalThis, { window: Object.assign(target, { innerHeight: 844, innerWidth: 390 }) });

// eslint-disable-next-line @typescript-eslint/no-var-requires
const selection = require('./MiSelection') as typeof import('./MiSelection');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const views = require('./MiStoryViews') as typeof import('./MiStoryViews');

const DIR = __dirname;
const read = (file: string): string => readFileSync(join(DIR, file), 'utf8');

let renderer: ReactTestRenderer;
function mount(element: ReturnType<typeof createElement>): void {
  act(() => {
    renderer = create(element);
  });
}
afterEach(() => act(() => renderer?.unmount()));

const text = (node: ReactTestInstance): string =>
  node.children.map((child) => (typeof child === 'string' ? child : text(child))).join('');
const all = (predicate: (node: ReactTestInstance) => boolean): ReactTestInstance[] =>
  renderer.root.findAll((node) => typeof node.type === 'string' && predicate(node));
const byData = (key: string, value?: string): ReactTestInstance[] =>
  all((node) => (value === undefined ? key in node.props : node.props[key] === value));
const hasLightning = (node: ReactTestInstance): boolean =>
  node.findAll((n) => n.type === 'path' && String(n.props.d).startsWith('M13 2 4 14h6')).length > 0;

/* ── contrast, WCAG 2.x relative luminance ─────────────────────────────── */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('§1 colour semantics — the existing sand family, no new palette', () => {
  it('selection-mode, AI-action and rail tokens reuse exactly the frozen sand values', () => {
    for (const token of [MI_SELECTION_MODE_CONTROL, MI_AI_ACTION_ON, MI_SELECTION_BAR]) {
      expect(token).toMatch(/#6a5634/);
    }
    expect(MI_SELECTION_MODE_CONTROL).toContain('bg-[#2e2618]');
    expect(MI_SELECTION_MODE_CONTROL).toContain('text-[#D9B98A]');
    expect(MI_AI_ACTION_ON).toContain('bg-[#2e2618]');
    expect(MI_AI_ACTION_ON).toContain('text-[#D9B98A]');
    expect(MI_LOCAL_ACTION).toContain('#5abff5');
  });

  it('no mint, no tier violet, no gold/lemon yellow, and no violet action icons on the selection surface', () => {
    /* The selection components, plus every token value they draw with (the token file's own
       documentation names the forbidden colours on purpose, so its comments are not scanned). */
    const source = [
      read('MiSelection.tsx'),
      MI_SELECTION_MODE_CONTROL,
      MI_AI_ACTION_ON,
      MI_AI_ACTION_OFF,
      MI_LOCAL_ACTION,
      MI_SELECTION_BAR,
    ].join('\n');
    expect(source).not.toMatch(/#5BE3A8/i);
    expect(source).not.toMatch(/#8C86EE/i);
    expect(read('MiSelection.tsx')).not.toMatch(/#a78bfa/i);
    for (const yellow of ['#ffd700', '#ffff00', '#facc15', '#fde047', '#eab308']) {
      expect(source.toLowerCase()).not.toContain(yellow);
    }
  });

  it('dark-mode contrast: every enabled text/surface pair clears WCAG AA (4.5:1)', () => {
    const pairs: Array<[string, string, string]> = [
      ['sand text on sand surface (Done, AI actions)', '#D9B98A', '#2e2618'],
      ['sand cost note on the rail', '#D9B98A', '#04111f'],
      ['white count on the rail', '#ffffff', '#04111f'],
      ['guidance on the rail', '#cfe2f2', '#04111f'],
      ['cyan Clear on the rail', '#5abff5', '#04111f'],
    ];
    for (const [label, fg, bg] of pairs) {
      expect(`${label}: ${contrast(fg, bg) >= 4.5}`).toBe(`${label}: true`);
    }
    /* Unavailable actions are dimmer by design, and still legible (≥3:1). */
    expect(contrast('#7d725f', '#17130c')).toBeGreaterThanOrEqual(3);
  });
});

describe('§3 the selection-mode control replaces the isolated Done', () => {
  const toggle = (props: Record<string, unknown>) =>
    mount(createElement(selection.SelectionModeToggle, { language: 'en', selecting: true, selectedCount: 2, onToggle: () => undefined, variant: 'wide', ...props } as never));

  it('wide: "Selection mode · Done", warm sand, 2px border, bold, ≥44px, with the state in its name', () => {
    toggle({});
    const button = byData('data-mi-control', 'selection-mode-done')[0];
    expect(text(button)).toBe('Selection mode · Done');
    expect(button.props.className).toContain(MI_SELECTION_MODE_CONTROL);
    expect(button.props.className).toContain('border-2');
    expect(button.props.className).toContain('font-bold');
    expect(button.props.className).toContain('min-h-[44px]');
    expect(button.props['aria-pressed']).toBe(true);
    expect(button.props['aria-label']).toBe('2 stories selected. Selection mode active. Done — leave selection mode');
  });

  it('phone: a stacked "2 selected / Done"', () => {
    toggle({ variant: 'phone' });
    expect(text(byData('data-mi-control', 'selection-mode-done')[0])).toBe('2 selectedDone');
  });

  it('Done exits a mode and spends nothing: no lightning mark and no AI tag', () => {
    toggle({});
    const button = byData('data-mi-control', 'selection-mode-done')[0];
    expect(hasLightning(button)).toBe(false);
    expect(text(button)).not.toContain('AI');
  });

  it('SELECT SAND-AWARENESS — "Select stories" uses the sand selection-control family: 2px, bold, ≥44px', () => {
    toggle({ selecting: false });
    const button = byData('data-mi-control', 'select')[0];
    expect(text(button)).toBe('Select stories');
    expect(button.props.className).toContain(MI_SELECTION_MODE_CONTROL);
    expect(button.props.className).toContain('border-2');
    expect(button.props.className).toContain('bg-[#2e2618]');
    expect(button.props.className).toContain('text-[#D9B98A]');
    expect(button.props.className).toContain('font-bold');
    expect(button.props.className).toContain('min-h-[44px]');
    /* Hover and focus deepen the SAME sand; the focus ring is sand, not a new colour. */
    expect(button.props.className).toContain('hover:bg-[#3a3020]');
    expect(button.props.className).toContain('focus-visible:border-[#8a7045]');
    expect(button.props.className).toContain('focus-visible:ring-[#D9B98A]');
    expect(button.props['aria-label']).toBe('Select stories. Enter selection mode. Selecting is free.');
    expect(button.props['aria-pressed']).toBe(false);
  });

  it('SELECT SAND-AWARENESS — Select is not a compute action: no lightning, no AI badge, no price', () => {
    toggle({ selecting: false });
    const button = byData('data-mi-control', 'select')[0];
    expect(hasLightning(button)).toBe(false);
    expect(text(button)).not.toMatch(/\bAI\b/);
    expect(`${text(button)} ${button.props['aria-label']}`).not.toMatch(/[$€£]|credit|price|kredyt|cena/i);
  });

  it('SELECT SAND-AWARENESS — one control changing state: the same element and treatment in both states', () => {
    toggle({ selecting: false, variant: 'wide' });
    const idle = byData('data-mi-control', 'select')[0].props.className;
    act(() => renderer.update(createElement(selection.SelectionModeToggle, { language: 'en', selecting: true, selectedCount: 2, onToggle: () => undefined, variant: 'wide' })));
    const active = byData('data-mi-control', 'selection-mode-done')[0].props.className;
    expect(active).toBe(idle);
  });

  it('SELECT SAND-AWARENESS — pressing Select (phone and wide) on the real client makes zero analysis requests and zero fetches', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { analyzeNews } = require('@/lib/api/analysisApi') as { analyzeNews: jest.Mock };
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MyIntelligenceClient } = require('./MyIntelligenceClient') as typeof import('./MyIntelligenceClient');
    const fetchSpy = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchSpy as unknown as typeof fetch;
    analyzeNews.mockReset();
    mount(createElement(MyIntelligenceClient, { language: 'en' }));
    for (const variantIndex of [0, 1]) {
      const select = byData('data-mi-control', 'select')[variantIndex];
      act(() => select.props.onClick());
      expect(byData('data-mi-control', 'selection-mode-done').length).toBeGreaterThan(0);
      act(() => byData('data-mi-control', 'selection-mode-done')[variantIndex].props.onClick());
    }
    expect(analyzeNews).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });

  it('phone keeps the compact "Select"; PL wide reads "Zaznacz artykuły"', () => {
    toggle({ selecting: false, variant: 'phone' });
    expect(text(byData('data-mi-control', 'select')[0])).toBe('Select');
    act(() => renderer.update(createElement(selection.SelectionModeToggle, { language: 'pl', selecting: false, selectedCount: 0, onToggle: () => undefined, variant: 'wide' })));
    const pl = byData('data-mi-control', 'select')[0];
    expect(text(pl)).toBe('Zaznacz artykuły');
    expect(pl.props['aria-label']).toBe('Zaznacz artykuły. Włącz tryb zaznaczania. Zaznaczanie jest bezpłatne.');
  });

  it('PL: "Tryb zaznaczania · Gotowe"', () => {
    toggle({ language: 'pl' });
    expect(text(byData('data-mi-control', 'selection-mode-done')[0])).toBe('Tryb zaznaczania · Gotowe');
  });
});

describe('§4/§5 the rail: how many, what next, what costs compute — and which actions are AI', () => {
  const rail = (count: number, language: 'en' | 'pl' = 'en') =>
    mount(createElement(selection.SelectionRail, { language, selectedCount: count, onClear: () => undefined, onAction: () => undefined }));

  it.each([
    [1, '1 story selected'],
    [2, '2 stories selected'],
    [8, '8 stories selected'],
  ])('%i selected → "%s", the guidance and the cost note are all present', (count, label) => {
    rail(count);
    expect(text(byData('data-mi-selected-count')[0])).toBe(label);
    const all6 = text(renderer.root.findByProps({ 'data-mi-selection-rail': '' }));
    expect(all6).toContain('Selection mode');
    expect(all6).toContain('Choose what to do next');
    expect(text(byData('data-mi-cost-note')[0])).toBe('AI actions use compute. Selecting, filtering and clearing are free.');
  });

  it('PL copy', () => {
    rail(2, 'pl');
    expect(text(byData('data-mi-selected-count')[0])).toBe('Zaznaczone artykuły: 2');
    expect(text(byData('data-mi-cost-note')[0])).toBe(
      'Działania AI zużywają moc obliczeniową. Zaznaczanie, filtrowanie i czyszczenie są bezpłatne.',
    );
  });

  it('all six actions are AI actions: sand, lightning, AI tag and an accessible name saying so', () => {
    rail(2);
    const actions = byData('data-mi-action-kind', 'ai');
    expect(actions.map((a) => a.props['data-mi-action'])).toEqual(['compare', 'summarize', 'askAbout', 'explain', 'whatChanged', 'briefing']);
    for (const action of actions) {
      expect(action.props.className).toContain(MI_AI_ACTION_ON);
      expect(hasLightning(action)).toBe(true);
      expect(text(action)).toContain('AI');
      expect(action.props['aria-label']).toMatch(/— AI action\. Uses compute and asks you to confirm before it runs\./);
      expect(action.props.className).toContain('focus-visible:ring-2');
    }
  });

  it('with 1 selected, the two-story actions are visibly unavailable but still identified as AI', () => {
    rail(1);
    const off = byData('data-mi-action-kind', 'ai').filter((a) => a.props.disabled);
    expect(off.map((a) => a.props['data-mi-action'])).toEqual(['compare', 'explain', 'briefing']);
    for (const action of off) {
      expect(action.props.className).toContain(MI_AI_ACTION_OFF);
      expect(action.props['aria-label']).toContain('Select at least 2');
    }
  });

  it('Clear is a free, local control: cyan, no sand, no AI tag, no lightning', () => {
    rail(2);
    const clear = byData('data-mi-control', 'clear')[0];
    expect(clear.props.className).toContain(MI_LOCAL_ACTION);
    expect(clear.props.className).not.toContain('#2e2618');
    expect(text(clear)).toBe('Clear');
    expect(hasLightning(clear)).toBe(false);
  });

  it('at the start, a continuation cue (fade + "Show more actions") says more actions exist', () => {
    rail(2);
    expect(renderer.root.findByProps({ 'data-mi-rail-position': 'start' })).toBeTruthy();
    const more = byData('data-mi-control', 'more-actions')[0];
    expect(more.props['aria-label']).toBe('Show more actions');
  });

  it('the rail sits above the bottom navigation, never over it, and hides on desktop', () => {
    rail(2);
    const region = renderer.root.findByProps({ 'data-mi-selection-rail': '' });
    expect(region.props.className).toContain('bottom-[calc(56px+env(safe-area-inset-bottom))]');
    expect(region.props.className).toContain('lg:hidden');
    expect(region.props.className).toContain('border-t-2');
  });
});

describe('§11 desktop panel: same semantics, stacked, one set of controls', () => {
  it('names the mode and count and gives every action the AI treatment', () => {
    mount(createElement(selection.SelectionPanel, { language: 'en', selectedCount: 8, onClear: () => undefined, onAction: () => undefined }));
    const panel = renderer.root.findByProps({ 'data-mi-selection-panel': '' });
    expect(panel.props.className).toContain('hidden p-4 lg:block');
    expect(text(byData('data-mi-selected-count')[0])).toBe('8 stories selected');
    expect(byData('data-mi-action-kind', 'ai')).toHaveLength(6);
    expect(byData('data-mi-control', 'more-actions')).toHaveLength(0);
  });
});

describe('§8 first-use note: informational, no price, no credits, no storage', () => {
  it('says what selection unlocks and that AI runs only on confirmation', () => {
    mount(createElement(selection.SelectionIntro, { language: 'en', visible: true, onDismiss: () => undefined }));
    const note = text(renderer.root.findByProps({ 'data-mi-selection-intro': '' }));
    expect(note).toContain('Selected stories unlock intelligence actions.');
    expect(note).toContain('AI runs only when you confirm an AI action.');
    expect(note).not.toMatch(/[$€£]|\bcredit|\bbalance|\bprice/i);
  });

  it('renders nothing when not visible, and is not a modal', () => {
    mount(createElement(selection.SelectionIntro, { language: 'en', visible: false, onDismiss: () => undefined }));
    expect(renderer.toJSON()).toBeNull();
    expect(read('MiSelection.tsx')).not.toMatch(/localStorage|sessionStorage/);
  });
});

describe('§12 accessibility: the selection state is announced', () => {
  it.each([
    [0, 'Selection mode active. No stories selected yet.'],
    [1, '1 story selected. Selection mode active.'],
    [2, '2 stories selected. Selection mode active.'],
  ])('%i → "%s"', (count, expected) => {
    mount(createElement(selection.SelectionStatus, { language: 'en', selecting: true, selectedCount: count }));
    const status = renderer.root.findByProps({ 'data-mi-selection-status': '' });
    expect(status.props.role).toBe('status');
    expect(text(status)).toBe(expected);
  });
});

describe('compute boundary: only the explicit Run reaches analysis, and only through runSelectionAction', () => {
  it('no component calls the analysis transport or fetch directly', () => {
    for (const file of ['MyIntelligenceClient.tsx', 'MiSelection.tsx', 'MiStoryViews.tsx']) {
      const source = read(file);
      expect(`${file}: ${/analyzeNews|fetch\(/.test(source)}`).toBe(`${file}: false`);
    }
  });

  it('COMPUTE-ACTION CLOSURE R1 — runSelectionAction is called exactly once, inside the Run handler', () => {
    const client = read('MyIntelligenceClient.tsx');
    expect(client.match(/runSelectionAction\(/g) ?? []).toHaveLength(1);
    const handler = client.slice(client.indexOf('const onConfirm = useCallback('));
    expect(handler.indexOf('runSelectionAction(')).toBeGreaterThan(-1);
    expect(handler.indexOf('runSelectionAction(')).toBeLessThan(handler.indexOf('\n  );'));
    for (const file of ['MiSelection.tsx', 'MiStoryViews.tsx']) {
      expect(read(file)).not.toContain('runSelectionAction');
    }
  });
});

describe('§9 story images: the story’s own image, or an honest fallback', () => {
  const story = (imageUrl?: string): FixtureStory =>
    ({
      id: 's1',
      url: 'https://example.com/sample/a',
      title: 'A saved story',
      sourceName: 'Example Wire',
      publishedAt: '2026-09-26T08:00:00.000Z',
      countryCode: 'PL',
      category: 'Economy',
      ...(imageUrl !== undefined ? { imageUrl } : {}),
    }) as FixtureStory;

  it('only an absolute http(s) URL on the story is used', () => {
    expect(views.storyImageSrc(story('https://example.com/a.jpg'))).toBe('https://example.com/a.jpg');
    expect(views.storyImageSrc(story('http://example.com/a.jpg'))).toBe('http://example.com/a.jpg');
    for (const bad of ['', '   ', 'javascript:alert(1)', '/relative.jpg', 'data:image/png;base64,AAAA', 'not a url']) {
      expect(views.storyImageSrc(story(bad))).toBeUndefined();
    }
    expect(views.storyImageSrc(story())).toBeUndefined();
  });

  const common = { language: 'en' as const, isSaved: true, onToggleSaved: () => undefined, selecting: false, isSelected: false, onToggleSelected: () => undefined };

  it.each([
    ['phone row', 'SavedRow'],
    ['desktop card', 'SavedCard'],
  ] as const)('%s: a valid imageUrl renders the image over the designed fallback', (_label, component) => {
    const View = views[component] as unknown as (props: Record<string, unknown>) => JSX.Element;
    mount(createElement(View, { ...common, story: story('https://example.com/a.jpg') }));
    const slot = byData('data-mi-story-image', 'present')[0];
    const img = slot.findByType('img');
    expect(img.props.src).toBe('https://example.com/a.jpg');
    expect(img.props.alt).toBe('');
    expect(img.props.onError).toBe(views.hideFailedStoryImage);
    /* The fallback stays underneath, so a failed image reveals it rather than a broken glyph. */
    expect(text(slot)).toContain(getDictionary('en').myIntelligence.saved.noImage);
  });

  it.each([
    ['phone row', 'SavedRow'],
    ['desktop card', 'SavedCard'],
  ] as const)('%s: no image → the designed fallback, and no <img> at all', (_label, component) => {
    const View = views[component] as unknown as (props: Record<string, unknown>) => JSX.Element;
    mount(createElement(View, { ...common, story: story() }));
    const slot = byData('data-mi-story-image', 'missing')[0];
    expect(slot.findAllByType('img')).toHaveLength(0);
    expect(text(slot)).toBe(getDictionary('en').myIntelligence.saved.noImage);
  });

  it('DENSITY R1 — the card image is a fixed compact thumbnail (76 / 96 / 104px), never a collapsing overlay', () => {
    const View = views.SavedCard as unknown as (props: Record<string, unknown>) => JSX.Element;
    mount(createElement(View, { ...common, story: story('https://example.com/a.jpg') }));
    const slot = byData('data-mi-story-image', 'present')[0];
    for (const size of ['h-[76px] w-[76px]', 'md:h-[96px] md:w-[96px]', 'xl:h-[104px] xl:w-[104px]']) {
      expect(slot.props.className).toContain(size);
    }
    expect(slot.props.className).not.toMatch(/\babsolute\b/);
    /* No full-width hero media on an ordinary My Intelligence card. */
    expect(slot.props.className).not.toMatch(/h-\[132px\]|aspect-\[16\/9\]/);
  });

  it('a failed image is hidden, revealing the fallback', () => {
    const style: Record<string, string> = {};
    views.hideFailedStoryImage({ currentTarget: { style } } as never);
    expect(style.display).toBe('none');
  });
});
