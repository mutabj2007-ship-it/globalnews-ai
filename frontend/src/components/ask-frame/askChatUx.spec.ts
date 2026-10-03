import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { enterSends } from './AskParts';
import { askR2Strings } from '@/lib/ask/askR2Strings';

/**
 * TRUST & CONVERSATIONAL EXPERIENCE R1 · Tranche 2B — standalone chat UX.
 *
 *   Enter       sends on a physical keyboard (fine pointer); Shift+Enter, IME composition and
 *               touch keyboards keep a new line; an empty box or a question in flight sends nothing.
 *   Retry       a failed Send keeps the question in the box and says so (retry = press Ask).
 *   Reading     the view follows the conversation only while the reader is at its end; otherwise
 *               a "New answer below" control appears instead of a forced scroll.
 *   Copy        the visible question, answer and source links to the clipboard — no network.
 */
const read = (file: string) => readFileSync(join(__dirname, file), 'utf8');
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');

describe('Enter to send', () => {
  const setPointer = (fine: boolean) => {
    (globalThis as unknown as { window: unknown }).window = {
      matchMedia: (q: string) => ({ matches: q === '(pointer: fine)' && fine }),
    };
  };
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('a fine pointer (desktop keyboard) sends; a touch device keeps Enter as a new line', () => {
    setPointer(true);
    expect(enterSends()).toBe(true);
    setPointer(false);
    expect(enterSends()).toBe(false);
  });

  it('never sends on Shift+Enter, mid-composition, empty or in flight', () => {
    const parts = code(read('AskParts.tsx'));
    expect(parts).toMatch(
      /event\.key !== 'Enter' \|\| event\.shiftKey \|\| event\.nativeEvent\.isComposing/,
    );
    expect(parts).toMatch(/if \(ready\) event\.currentTarget\.form\?\.requestSubmit\(\)/);
    expect(parts).toMatch(/const ready = !pending && value\.trim\(\)\.length > 0/);
  });
});

describe('a failed Send keeps the draft', () => {
  it('restores the question and shows the retry line', () => {
    const screen = code(read('AskFrameScreen.tsx'));
    expect(screen).toMatch(
      /outcome === 'failed'\) \{\s*setQuestion\(draft\);\s*setRetryKept\(true\);/,
    );
    expect(screen).toContain('data-ask="retry-kept"');
    expect(askR2Strings('en').retryKept).toMatch(/still in the box/);
    expect(askR2Strings('pl').retryKept).toMatch(/nadal jest w polu/);
  });
});

describe('reading position is preserved', () => {
  it('follows only at the end (or right after the reader asks); otherwise announces', () => {
    const screen = code(read('AskFrameScreen.tsx'));
    expect(screen).toMatch(/if \(atEnd\.current \|\| followNext\.current\)/);
    expect(screen).toMatch(/setNewBelow\(true\)/);
    expect(screen).toContain('data-ask="new-answer"');
    expect(screen).not.toMatch(
      /if \(reader\.current && !empty\) reader\.current\.scrollTop = reader\.current\.scrollHeight;/,
    );
  });
});

describe('copy is local only', () => {
  it('writes to the clipboard and reaches no API', () => {
    const copy = code(read('AskTurnCopy.tsx'));
    expect(copy).toContain('navigator.clipboard.writeText');
    expect(copy).not.toMatch(/fetch\(|askV2Api|navigator\.share|sendBeacon/);
  });
});

describe('TRUST R1 — mixed answer: recent reporting is listed, labelled and local', () => {
  it('states "listed, not analysed", says absence/unavailability, and reaches no API', () => {
    const view = code(read('AskRecentReporting.tsx'));
    expect(view).toContain('Listed, not analysed');
    expect(view).toContain('That is not evidence that nothing is happening');
    expect(view).toContain('could not be checked');
    expect(view).not.toMatch(/fetch\(|askV2Api\.|useEffect/);
    /* CTO checkpoint 3 §13 — a listed report is never numbered as a citation of the answer */
    expect(view).not.toMatch(/data-citation|data-ask="citation"/);
    const turn = code(read('AskR2TurnView.tsx'));
    expect(turn).toMatch(/payload\.analysis === null && payload\.recentReporting != null/);
  });
});
