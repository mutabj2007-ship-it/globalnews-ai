import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { composerKeyAction, enterSends } from './AskParts';
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

  /*
    CENTERED COMPOSER R1 — MOVED, NOT RELAXED.

    This assertion used to be a regex over the inline `onKeyDown` body. The guard it pinned
    (`key !== 'Enter' || shiftKey || isComposing`, then `if (ready) requestSubmit()`) is now
    the pure `composerKeyAction`, so the SAME property is asserted here as BEHAVIOUR instead
    of as source text — strictly stronger, and it no longer breaks when the handler is
    reformatted. The composer still delegates to it, which the line below pins, and the
    `ready` definition is pinned exactly as before.
  */
  it('never sends on Shift+Enter, mid-composition, empty or in flight', () => {
    const base = { key: 'Enter', shiftKey: false, isComposing: false, enterSends: true } as const;
    expect(composerKeyAction({ ...base, ready: true })).toBe('SUBMIT');
    expect(composerKeyAction({ ...base, shiftKey: true, ready: true })).toBe('DEFAULT');
    expect(composerKeyAction({ ...base, isComposing: true, ready: true })).toBe('DEFAULT');
    expect(composerKeyAction({ ...base, enterSends: false, ready: true })).toBe('DEFAULT');
    /* Empty box, or a question already in flight: the keystroke is swallowed, nothing sent. */
    expect(composerKeyAction({ ...base, ready: false })).toBe('SUPPRESS');
    expect(composerKeyAction({ ...base, key: 'a', ready: true })).toBe('DEFAULT');

    const parts = code(read('AskParts.tsx'));
    expect(parts).toMatch(/const action = composerKeyAction\(\{/);
    expect(parts).toMatch(/if \(action === 'SUBMIT'\) event\.currentTarget\.form\?\.requestSubmit\(\)/);
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
    /*
      R4 · PHASE B — THESE THREE SENTENCES MOVED, AND WHY THEY MOVED IS THE POINT.

      They were asserted against this COMPONENT's source because that is where they lived: a
      module-private `Record<AskR2Locale, …>` of ten keys, six of them templates. A private
      const is unreachable by every localization mechanism the product has — no overlay can
      replace it, no coverage report can count it, no missing-key test can fail on it — so a
      French reader would have been shown "Listed, not analysed" in English however complete
      the catalogues became. The keys are now in `lib/ask/askSurfaceStrings.ts`, verbatim,
      and reach this component through the one shell resolver.

      So the assertion follows the copy rather than being deleted: the same three sentences
      are still pinned, in the file that now owns them, and the component is additionally
      asserted to hold NO copy of its own.
    */
    const catalogue = code(
      readFileSync(join(__dirname, '..', '..', 'lib', 'ask', 'askSurfaceStrings.ts'), 'utf8'),
    );
    expect(catalogue).toContain('Listed, not analysed');
    expect(catalogue).toContain('That is not evidence that nothing is happening');
    expect(catalogue).toContain('could not be checked');
    /* And the Polish is still there too — moving copy must not drop a locale. */
    expect(catalogue).toContain('Lista bez analizy');
    /* The component now holds no catalogue of its own, which is what made the old assertion
       possible in the first place. */
    expect(view).not.toMatch(/Record<AskR2Locale|=== 'pl' \?/);
    expect(view).toContain('askShellStrings(locale).askRecentReportingStrings');
    expect(view).not.toMatch(/fetch\(|askV2Api\.|useEffect/);
    /* CTO checkpoint 3 §13 — a listed report is never numbered as a citation of the answer */
    expect(view).not.toMatch(/data-citation|data-ask="citation"/);
    const turn = code(read('AskR2TurnView.tsx'));
    expect(turn).toMatch(/payload\.analysis === null && payload\.recentReporting != null/);
  });
});

describe('TRUST R1 (checkpoint 5) — reading position while an answer is pending', () => {
  it('scrolling away from the end stops following, so an arriving answer does not yank the reader', () => {
    const screen = code(read('AskFrameScreen.tsx'));
    /* the scroll handler clears the follow-on-send flag whenever the reader leaves the end */
    expect(screen).toMatch(
      /if \(atEnd\.current\) setNewBelow\(false\);\s*else followNext\.current = false;/,
    );
    /* and an arrival while not following shows the new-answer affordance instead of scrolling */
    expect(screen).toMatch(
      /if \(atEnd\.current \|\| followNext\.current\) \{[\s\S]*?\} else \{\s*setNewBelow\(true\);/,
    );
  });
});

describe('TRUST R1 (checkpoint 5) — a dropped connection on the first guest send is a failed send', () => {
  it('is not reported as a guest limit: it takes the failed path (draft kept + retry line)', () => {
    const hook = code(read('../../lib/ask/useAskR2Conversation.ts'));
    expect(hook).toMatch(
      /if \(!created\.ok\) \{\s*if \(created\.reason === 'NETWORK'\) \{[\s\S]*?return 'failed';\s*\}/,
    );
  });
});

describe('CTO checkpoint 5 §5 — a composed cross-country continuation is disclosed', () => {
  it('the turn shows the question actually answered, beneath the reader’s own words', () => {
    const turn = code(read('AskR2TurnView.tsx'));
    expect(turn).toMatch(
      /* ASK R2 — the reader's words render through AskSubmittedQuestion (a long question is a compact preview) */
      /<AskSubmittedQuestion\s+question=\{turn\.question\}[\s\S]*?\/>\s*(?:\{\}\s*)?\{payload\.continuation != null && \(/,
    );
    expect(turn).toContain('{payload.continuation.answeredAs}');
  });
});

describe('CTO P0 — advice is labelled as general guidance, never as current sourced research', () => {
  it('a guidance answer shows the guidance note, and a mixed one lists what needs current evidence', () => {
    const turn = code(read('AskR2TurnView.tsx'));
    /* R3 — advice and decision support each carry their own label; a partial answer (the stable
       part of a mixed question) keeps the plain model-background label */
    expect(turn).toContain("guidanceKind === 'DECISION_SUPPORT'");
    expect(turn).toContain('s.r3.decisionNoteTitle');
    expect(turn).toContain('s.guidanceNoteTitle');
    expect(turn).toContain('s.referenceNoteTitle');
    expect(turn).toContain('data-ask="guidance-current-gap"');
    expect(turn).toContain('payload.guidance.currentEvidenceNeeded.map(');
  });

  it('R3 §6 a partial answer says the current part could not be verified, in plain words (EN / PL)', () => {
    const turn = code(read('AskR2TurnView.tsx'));
    expect(turn).toContain('s.r3.partialCurrent[payload.guidance.currentPart]');
    const strings = read('../../lib/ask/askR2Strings.ts');
    expect(strings).toContain('The current part could not be verified right now.');
    expect(strings).toContain('Bieżącej części nie udało się teraz zweryfikować.');
  });

  it('R3 §14 a relationship answer names both sides; §12 "best for what?" offers objectives', () => {
    const turn = code(read('AskR2TurnView.tsx'));
    expect(turn).toContain('data-ask="relationship"');
    expect(turn).toContain('view.clarification.lead ?? s.whichOne');
    const view = read('../../lib/ask/askR2View.ts');
    expect(view).toContain("basis === 'DECISION_OBJECTIVE_MISSING'");
    expect(view).toContain("basis === 'CONSTRAINT_NOTED'");
  });

  it('the EN and PL guidance copy says it is not current sourced research', () => {
    const strings = read('../../lib/ask/askR2Strings.ts');
    expect(strings).toContain('not current sourced research');
    expect(strings).toContain('nie bieżąca analiza źródeł');
  });
});

describe('CTO P0 · Defect E — the companion block is titled by the reader’s task', () => {
  it('a travel answer reads "Current travel notices" (EN) / "Bieżące komunikaty dla podróżnych" (PL); older answers keep the generic title', () => {
    const view = read('AskRecentReporting.tsx');
    /*
      R4 · PHASE B — the per-task titles moved with the rest of this component's private
      catalogue into `lib/ask/askSurfaceStrings.ts` (see the longer note above). Both
      languages are still pinned, in the file that now owns them; the SELECTION rule — which
      is what Defect E was actually about — is still pinned here, in the component that
      performs it.
    */
    const catalogue = readFileSync(
      join(__dirname, '..', '..', 'lib', 'ask', 'askSurfaceStrings.ts'),
      'utf8',
    );
    expect(catalogue).toContain('Current travel notices');
    expect(catalogue).toContain('Bieżące komunikaty dla podróżnych');
    expect(code(view)).toContain(
      'reporting.topic === undefined ? t.title : t.topic[reporting.topic]',
    );
    expect(code(view)).toContain('data-ask-recent-topic={reporting.topic}');
  });
});
