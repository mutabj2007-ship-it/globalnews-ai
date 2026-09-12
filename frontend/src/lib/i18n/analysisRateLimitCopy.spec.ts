import { readFileSync } from 'fs';
import { join } from 'path';
import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * PH-1 — THE ANALYSIS RATE-LIMIT MESSAGE MUST MATCH THE LIMITS THAT PRODUCE IT.
 *
 * A DEDICATED FILE, DELIBERATELY. F owns the append region at the end of
 * `dictionaries/index.spec.ts`; nothing here touches it.
 *
 * ── THE DEFECT THIS FILE EXISTS TO PREVENT COMING BACK ────────────────────
 *
 * The released copy said "Please wait a moment and try again." A moment is a
 * few seconds. The anonymous analysis window is FIFTEEN MINUTES. A reader who
 * believed that message would retry, fail, retry, fail, and reasonably
 * conclude the product was broken.
 *
 * ── AND WHY THE FIX IS A RANGE, NOT A NUMBER ──────────────────────────────
 *
 * TWO independent limits guard `POST /analysis`, and the frontend cannot tell
 * which one refused:
 *
 *   analysis.controller.ts        @Throttle({ limit: 5, ttl: 60000 })   1 minute
 *   analysis-rate-limit.guard.ts  ANALYSIS_WINDOW_MS = 15 * 60_000      15 minutes
 *   analysisApi.ts:40             if (status === 429) return 'rate-limited';
 *
 * One string is shown for both. "Wait 15 minutes" would be wrong whenever the
 * one-minute throttle fired; "wait a moment" is wrong whenever the fifteen-
 * minute window did. So the copy states the RANGE and names neither as the
 * answer.
 *
 * ── THE NUMBERS ARE READ FROM THE GUARD, NOT COPIED FROM IT ───────────────
 *
 * This spec reads the backend guard and the controller as TEXT and derives the
 * real windows. If someone changes ANALYSIS_WINDOW_MS or the throttle ttl, the
 * copy stops matching the system and this fails — which is the only way a
 * user-facing number stays true over time. The backend files are never
 * imported, never executed and never modified.
 */
const REPO = join(__dirname, '..', '..', '..', '..');

const guardSource = readFileSync(
  join(REPO, 'backend', 'src', 'modules', 'analysis', 'security', 'analysis-rate-limit.guard.ts'),
  'utf-8',
);
const controllerSource = readFileSync(
  join(REPO, 'backend', 'src', 'modules', 'analysis', 'controller', 'analysis.controller.ts'),
  'utf-8',
);
const apiSource = readFileSync(join(__dirname, '..', 'api', 'analysisApi.ts'), 'utf-8');
const searchClientSource = readFileSync(
  join(__dirname, '..', '..', 'components', 'search', 'SearchPageClient.tsx'),
  'utf-8',
);

const en = getDictionary('en').analysisErrorRateLimited;
const pl = getDictionary('pl').analysisErrorRateLimited;

describe('PH-1 — the two limits this one message has to cover', () => {
  it('reads a 15-minute window and a 5-request anonymous ceiling from the guard itself', () => {
    expect(guardSource).toMatch(/export const ANALYSIS_WINDOW_MS = 15 \* 60_000;/);
    expect(guardSource).toMatch(/export const ANONYMOUS_LIMIT_PER_WINDOW = 5;/);
  });

  it('reads a SECOND, one-minute throttle from the controller', () => {
    expect(controllerSource).toMatch(/@Throttle\(\{ default: \{ limit: 5, ttl: 60000 \} \}\)/);
  });

  it('confirms the frontend cannot distinguish them — every 429 becomes one string', () => {
    expect(apiSource).toMatch(/if \(status === 429\) return 'rate-limited';/);
    expect(searchClientSource).toMatch(/'rate-limited': dictionary\.analysisErrorRateLimited/);
  });
});

describe('PH-1 — the copy no longer implies recovery in seconds', () => {
  it('has dropped the released "wait a moment" wording in both languages', () => {
    expect(en).not.toContain('Please wait a moment');
    expect(en.toLowerCase()).not.toContain('a moment');
    expect(pl.toLowerCase()).not.toContain('odczekaj chwil');
    expect(pl.toLowerCase()).not.toContain('chwilę i spróbuj');
  });

  it('never suggests seconds, and never says "shortly" or "soon"', () => {
    for (const copy of [en.toLowerCase(), pl.toLowerCase()]) {
      for (const word of ['second', 'sekund', 'shortly', 'soon', 'za chwil', 'natychmiast']) {
        expect(copy).not.toContain(word);
      }
    }
  });
});

describe('PH-1 — and does not promise a single fixed wait either', () => {
  it('states BOTH bounds rather than naming one of them as the answer', () => {
    // The long bound, in minutes, exactly as the guard defines it.
    expect(en).toContain('15');
    expect(pl).toContain('15');
    // And the short one, so a reader refused by the 1-minute throttle is not
    // told to go away for a quarter of an hour.
    expect(en.toLowerCase()).toContain('a minute');
    expect(pl.toLowerCase()).toContain('minuty');
  });

  it('hedges the figure rather than guaranteeing it', () => {
    expect(en.toLowerCase()).toContain('about');
    expect(pl.toLowerCase()).toContain('około');
    // A bare imperative with one number is precisely what must not come back.
    expect(en).not.toMatch(/wait 15 minutes|try again in 15 minutes/i);
    expect(pl).not.toMatch(/odczekaj 15 minut|spróbuj ponownie za 15 minut/i);
  });

  it('explains WHY the wait varies, so the range does not read as vagueness', () => {
    expect(en.toLowerCase()).toContain('which limit');
    expect(pl.toLowerCase()).toContain('który limit');
  });

  it('points at the remedy the backend itself offers — the authenticated ceiling is higher', () => {
    expect(guardSource).toMatch(/export const AUTHENTICATED_LIMIT_PER_WINDOW = 30;/);
    expect(en.toLowerCase()).toContain('signing in');
    expect(pl.toLowerCase()).toContain('zalogowanie');
  });
});

describe('PH-1 — localization hygiene', () => {
  it('is present, non-empty and really translated in both languages', () => {
    expect(en.length).toBeGreaterThan(0);
    expect(pl.length).toBeGreaterThan(0);
    expect(pl).not.toBe(en);
  });

  it('blames the reader for nothing and claims nothing about the fault', () => {
    for (const copy of [en.toLowerCase(), pl.toLowerCase()]) {
      for (const word of ['abuse', 'blocked', 'banned', 'suspicious', 'zablokowan', 'naduży']) {
        expect(copy).not.toContain(word);
      }
    }
  });

  it('sells nothing — the higher ceiling is an account property, not a plan', () => {
    for (const copy of [en.toLowerCase(), pl.toLowerCase()]) {
      for (const word of ['upgrade', 'premium', 'subscription', 'abonament', 'plan p']) {
        expect(copy).not.toContain(word);
      }
    }
  });
});
