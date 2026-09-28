import { createElement } from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { analyzeNews } from '@/lib/api/analysisApi';
import { resetAnalysisConsentForTests } from '@/lib/analysis/analysisComputeConsent';
import {
  computeComposerGeometry,
  estimateComposerContentHeight,
} from '@/components/ui/AdaptiveTextarea';
import { SEARCH_COMPOSER_GEOMETRY } from './searchComposerGeometry';
import { SearchPageClient } from './SearchPageClient';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * SEARCH COMPOSER 1000-CHARACTER GEOMETRY R1
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 1000 characters is a normal case. The geometry below is the component's OWN
 * arithmetic (the pure helpers resize() calls), evaluated at each device width
 * and visible-viewport height the ruling names, with the software keyboard open
 * and closed. The request counts are measured on the mounted /search client.
 */

/* ── the geometry matrix ─────────────────────────────────────────────────── */

const LINE = 24; // text-sm leading-6
const PADDING = 24; // py-3
const KEYBOARD_MARGIN = 20; // AdaptiveTextarea keepInsideVisualViewport margin

/**
 * clientWidth of the Search textarea (content + padding; 1px borders excluded)
 * inside the page's `max-w-5xl px-4 sm:px-6 lg:px-8` wrapper, beside the
 * Analyze button (px-4 → sm:px-6) across `gap-2 sm:gap-3`.
 */
const clientWidthAt = (viewportWidth: number) => {
  const gutter = viewportWidth >= 1024 ? 64 : viewportWidth >= 640 ? 48 : 32;
  const content = Math.min(viewportWidth, 1024) - gutter;
  const button = viewportWidth >= 640 ? 104 : 88;
  const gap = viewportWidth >= 640 ? 12 : 8;
  return content - button - gap - 2;
};
const ONE_LINE = LINE + PADDING + 2;

/**
 * [label, viewport width, visible height (keyboard closed), visible height (keyboard open)]
 * Keyboard-open heights are the visual viewport left above a typical software
 * keyboard; desktop/tablet have no software keyboard in this matrix.
 */
const DEVICES = [
  ['360px phone', 360, 640, 292],
  ['375px phone', 375, 667, 300],
  ['390px phone', 390, 844, 400],
  ['430px phone', 430, 932, 450],
  ['tablet', 820, 1180, 1180],
  ['desktop', 1440, 900, 900],
] as const;

interface ComposerConfig {
  readonly minHeight: number;
  readonly maxHeight: number;
  readonly maxViewportFraction: number;
}

const geometryFor = (
  value: string,
  width: number,
  visibleHeight: number,
  config: ComposerConfig = SEARCH_COMPOSER_GEOMETRY,
) =>
  computeComposerGeometry({
    visibleHeight,
    ...config,
    contentHeight: estimateComposerContentHeight({
      value,
      clientWidth: clientWidthAt(width),
      lineHeight: LINE,
      padding: PADDING,
    }),
  });

const EN_1000 = 'How will the new European rules on artificial intelligence change what news platforms must disclose? '
  .repeat(12)
  .slice(0, 1000);
const PL_1000 = 'Jak nowe unijne przepisy o sztucznej inteligencji zmienią obowiązki platform informacyjnych wobec czytelników? '
  .repeat(10)
  .slice(0, 1000);
const PARAGRAPHS_1000 = Array.from({ length: 8 }, (_, i) => `Paragraph ${i + 1}: ${'context '.repeat(14)}`)
  .join('\n\n')
  .slice(0, 1000);
const TOKEN_1000 = 'x'.repeat(1000);
const URL_1000 = `https://example.com/search?q=${'a%20b&c=d'.repeat(120)}`.slice(0, 1000);

describe('the root cause, measured', () => {
  const BEFORE = { minHeight: 48, maxHeight: 460, maxViewportFraction: 0.56 } as const;

  it('before: 1000 characters pushed the composer to 56% of a phone screen, 338px on tablet, 386px on desktop', () => {
    expect(geometryFor(EN_1000, 360, 640, BEFORE).height).toBe(Math.floor(640 * 0.56));
    expect(geometryFor(EN_1000, 820, 1180, BEFORE).height).toBe(338);
    expect(geometryFor(PARAGRAPHS_1000, 1440, 900, BEFORE).height).toBe(386);
  });

  it('after: the same questions stop at a readable ceiling', () => {
    expect(geometryFor(EN_1000, 360, 640).height).toBe(Math.floor(640 * 0.34));
    expect(geometryFor(EN_1000, 820, 1180).height).toBe(SEARCH_COMPOSER_GEOMETRY.maxHeight);
    expect(geometryFor(PARAGRAPHS_1000, 1440, 900).height).toBe(SEARCH_COMPOSER_GEOMETRY.maxHeight);
  });
});

describe.each(DEVICES)('%s', (_label, width, visible, keyboardVisible) => {
  it.each([
    ['EN, typed or pasted', EN_1000],
    ['PL', PL_1000],
    ['multiple paragraphs', PARAGRAPHS_1000],
    ['one uninterrupted token', TOKEN_1000],
    ['a long URL', URL_1000],
  ])('1000 characters (%s): bounded, internally scrollable, readable', (_, value) => {
    expect(value).toHaveLength(1000);
    for (const height of [visible, keyboardVisible]) {
      const g = geometryFor(value, width, height);
      expect(g.height).toBeLessThanOrEqual(SEARCH_COMPOSER_GEOMETRY.maxHeight);
      expect(g.height).toBeLessThanOrEqual(g.ceiling);
      /* Either it all fits (no scroll) or it stops AT the ceiling and scrolls internally. */
      expect(g.overflowY === 'hidden' || g.height === g.ceiling).toBe(true);
      /* Never a one-line strip: at least three lines of text stay visible. */
      expect(g.height).toBeGreaterThanOrEqual(3 * LINE + PADDING);
      /* The text and the Analyze control (bottom-aligned beside it) fit the visible viewport. */
      expect(g.height + KEYBOARD_MARGIN).toBeLessThan(height);
    }
  });

  it('empty is compact; a medium question grows naturally with no internal scroll', () => {
    expect(geometryFor('', width, visible)).toMatchObject({ height: ONE_LINE, overflowY: 'hidden' });
    const medium = geometryFor('Why is inflation high in Poland and what are the main drivers this year?', width, visible);
    expect(medium.overflowY).toBe('hidden');
    expect(medium.height).toBeLessThan(medium.ceiling);
  });

  it('deleting 1000 → 0 shrinks monotonically back to the compact height', () => {
    let previous = Infinity;
    for (let length = 1000; length >= 0; length -= 50) {
      const { height } = geometryFor(EN_1000.slice(0, length), width, visible);
      expect(height).toBeLessThanOrEqual(previous);
      previous = height;
    }
    expect(previous).toBe(ONE_LINE);
  });
});

describe('what the composer must never do', () => {
  const adaptive = readFileSync(join(__dirname, '../ui/AdaptiveTextarea.tsx'), 'utf8');
  const client = readFileSync(join(__dirname, 'SearchPageClient.tsx'), 'utf8');

  it('never scrolls horizontally and hides the native scrollbar', () => {
    expect(adaptive).toContain("node.style.overflowX = 'hidden'");
    expect(adaptive).toContain("node.style.overflowWrap = 'anywhere'");
    expect(adaptive).toContain("node.style.scrollbarWidth = 'none'");
  });

  it('the shared defaults and every other caller are untouched', () => {
    expect(adaptive).toContain('maxHeight = 280');
    expect(adaptive).toContain('maxViewportFraction = 0.38');
    expect(readFileSync(join(__dirname, '../ask/AskAiDock.tsx'), 'utf8')).toContain('maxHeight={420}');
    /* ASK R2 CLAUDE DESIGN RECONCILIATION R1 — /ask's ceiling is D25 04's (220 desktop / 140 phone). */
    expect(readFileSync(join(__dirname, '../ask-frame/AskFrameScreen.tsx'), 'utf8')).toContain('maxHeight={compact ? 140 : 220}');
    expect(readFileSync(join(__dirname, '../home/HeroAskField.tsx'), 'utf8')).toContain('maxHeight={280}');
  });

  it('keeps maxLength=1000 and puts Analyze beside the composer at every width', () => {
    expect(client).toContain('maxLength={1000}');
    expect(client).toContain('className="mt-6 flex flex-row items-end gap-2 sm:gap-3"');
    expect(client).not.toContain('flex flex-col items-stretch gap-3 sm:flex-row sm:items-end');
  });

  it('the composer has no network path: resize / scroll / input can never start an analysis', () => {
    expect(adaptive).not.toMatch(/analysisApi|analyzeNews|fetch\(/);
  });
});

/* ── request counts on the mounted /search client ───────────────────────── */

jest.mock('@/lib/api/analysisApi', () => {
  class AnalysisApiError extends Error {}
  return { analyzeNews: jest.fn(), AnalysisApiError };
});

let currentParams = new URLSearchParams();
const router = { push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), back: jest.fn() };
jest.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => currentParams,
}));
jest.mock('@/lib/i18n/languages', () => ({
  ...jest.requireActual('@/lib/i18n/languages'),
  resolveInitialLanguage: () => 'en',
}));
jest.mock('@/components/search/LoadingStages', () => ({ LoadingStages: () => 'loading' }));
jest.mock('@/components/analysis-frame/AnalysisFrameSurface', () => ({ AnalysisFrameSurface: () => 'frame' }));
jest.mock('@/components/analysis-frame/ZeroReportRecovery', () => ({ ZeroReportRecovery: () => 'recovery' }));
jest.mock('@/components/analysis-frame/analysisFrameState', () => ({
  resolveFrameEvidence: () => ({ evidenceSurvives: true, state: 'ok' }),
}));

const transport = jest.mocked(analyzeNews);
let renderer: ReactTestRenderer;

const render = (search: string, mount = false) => {
  currentParams = new URLSearchParams(search);
  act(() => {
    const element = createElement(SearchPageClient, { initialLanguage: 'en' });
    if (mount) renderer = create(element);
    else renderer.update(element);
  });
};
const field = () => renderer.root.findByProps({ id: 'search-workspace-question' });
const type = (value: string) => act(() => field().props.onChange({ target: { value } }));
const submit = () => act(() => renderer.root.findByProps({ role: 'search' }).props.onSubmit({ preventDefault() {} }));

beforeEach(() => {
  transport.mockReset();
  transport.mockReturnValue(new Promise(() => undefined));
  router.push.mockReset();
  resetAnalysisConsentForTests();
});
afterEach(() => act(() => renderer?.unmount()));

describe('compute invariants with a 1000-character question', () => {
  it('typing 1000 characters one by one = 0; pasting 1000 at once = 0; editing unsubmitted = 0', () => {
    render('', true);
    for (let i = 1; i <= 1000; i += 1) type(EN_1000.slice(0, i));
    type('');
    type(PL_1000);
    type(`${PL_1000.slice(0, 500)}${EN_1000.slice(0, 500)}`);
    expect(field().props.value).toHaveLength(1000);
    expect(transport).toHaveBeenCalledTimes(0);
  });

  it('first explicit Send = exactly 1; a second explicit question = exactly +1', () => {
    render('', true);
    type(EN_1000);
    submit();
    expect(transport).toHaveBeenCalledTimes(0);
    const first = router.push.mock.calls[0][0] as string;
    render(first.slice('/search?'.length));
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][0]).toBe(EN_1000.trim());

    render('');
    type(PL_1000);
    submit();
    const second = router.push.mock.calls[1][0] as string;
    render(second.slice('/search?'.length));
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('Enter submits (governed behaviour); Shift+Enter inserts a newline and submits nothing', () => {
    render('', true);
    type(EN_1000);
    const requestSubmit = jest.fn();
    const keyEvent = (shiftKey: boolean) => ({
      key: 'Enter',
      shiftKey,
      preventDefault: jest.fn(),
      currentTarget: { form: { requestSubmit } },
    });
    const shift = keyEvent(true);
    act(() => field().props.onKeyDown(shift));
    expect(shift.preventDefault).not.toHaveBeenCalled();
    expect(requestSubmit).not.toHaveBeenCalled();

    const plain = keyEvent(false);
    act(() => field().props.onKeyDown(plain));
    expect(plain.preventDefault).toHaveBeenCalled();
    expect(requestSubmit).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledTimes(0);
  });
});
