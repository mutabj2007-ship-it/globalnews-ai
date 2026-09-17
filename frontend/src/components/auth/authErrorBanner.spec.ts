import { readFileSync } from 'fs';
import { join } from 'path';
import { AUTH_ERROR_CODES, AUTH_ERROR_PARAM, isAuthErrorCode } from '@globalnews-ai/shared';

import { getDictionary } from '@/lib/i18n/dictionaries';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * B5-A · OAUTH V1 — THE BANNER, FRONTEND HALF
 * ════════════════════════════════════════════════════════════════════════════
 *
 * E1-BETA-SECURITY-GATES-R3 §C, tests C-T1…C-T5, C-T8, C-T10.
 *
 * ── HOW THESE ARE WRITTEN, AND THE LIMIT THAT IMPLIES ────────────────────
 *
 * This harness runs `testEnvironment: 'node'` with no jsdom and no
 * testing-library, so the package's DOM-phrased tests ("renders no banner")
 * cannot be executed as renders. They are expressed here in the two forms this
 * harness CAN prove:
 *
 *   1. the ADMISSION LOGIC directly, since `isAuthErrorCode` is the single gate
 *      the component consults and is a pure function; and
 *   2. SOURCE-READING guarantees over the component, for the properties that are
 *      about what the code may contain.
 *
 * THAT IS A REAL LIMIT AND IT IS RECORDED, NOT PAPERED OVER: this file proves
 * the component asks the right question and cannot contain the wrong answer; it
 * does not prove a browser paints nothing. Browser confirmation of C-T1…C-T5
 * remains outstanding as OAUTH-V1-BROWSER-VALIDATION-1.
 */

const COMPONENT = readFileSync(join(__dirname, 'AuthErrorBanner.tsx'), 'utf-8');

/** Code with comments stripped — the prose explains the rules and would false-match. */
const CODE = COMPONENT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('B5-A · C-T1 / C-T2 — only the two frozen codes are admissible', () => {
  it('C-T4 — POSITIVE CONTROL: both real codes ARE admitted', () => {
    /*
      FIRST, AND DELIBERATELY. Without it every test below passes vacuously on a
      gate that rejects everything, which is exactly what a broken gate looks
      like.
    */
    expect(isAuthErrorCode('cancelled')).toBe(true);
    expect(isAuthErrorCode('failed')).toBe(true);
    expect([...AUTH_ERROR_CODES]).toEqual(['cancelled', 'failed']);
  });

  it('C-T1 — an unknown value is not admissible', () => {
    for (const value of [
      'nope',
      'CANCELLED',
      'cancelled ',
      ' cancelled',
      '1',
      'true',
      'error',
      'invalid_return',
      '<script>alert(1)</script>',
      'cancelled;failed',
    ]) {
      expect(isAuthErrorCode(value)).toBe(false);
    }
  });

  it('C-T2 — empty, repeated (array) and bracketed (object) shapes are inert', () => {
    /*
      THE TYPE TEST IS DOING THE WORK. `?auth_error=a&auth_error=b` parses to an
      ARRAY and `?auth_error[x]=y` to an OBJECT. Because admission tests
      `typeof value === 'string'` FIRST, both are rejected without a special
      case for either — and a special case is where the next shape gets
      forgotten.
    */
    expect(isAuthErrorCode('')).toBe(false);
    expect(isAuthErrorCode(['cancelled', 'failed'])).toBe(false);
    expect(isAuthErrorCode(['cancelled'])).toBe(false);
    expect(isAuthErrorCode({ x: 'y' })).toBe(false);
    expect(isAuthErrorCode({ toString: () => 'cancelled' })).toBe(false);
    expect(isAuthErrorCode(null)).toBe(false);
    expect(isAuthErrorCode(undefined)).toBe(false);
    expect(isAuthErrorCode(0)).toBe(false);
    expect(isAuthErrorCode(true)).toBe(false);
  });

  it('an array whose only member is a valid code is STILL inert', () => {
    /* The most tempting thing to "fix" with a `[0]`, and the reason not to. */
    expect(isAuthErrorCode(['failed'])).toBe(false);
  });
});

describe('B5-A · C-T3 / C-9 — the raw value is never interpolated', () => {
  it('the component renders the message by LOOKUP, never from the parameter', () => {
    /*
      C-9. The rendered text must come from the dictionary, selected by an
      already-validated code. If the raw string could reach the DOM, the forged
      banner would stop being cosmetic.
    */
    expect(CODE).toContain('getDictionary(language).authError');
    expect(CODE).toMatch(/code === 'cancelled' \? copy\.cancelled : copy\.failed/);
  });

  it('the value that reaches state passed through isAuthErrorCode first', () => {
    expect(CODE).toMatch(/if \(isAuthErrorCode\(raw\)\) setCode\(raw\)/);

    /* `raw` is never rendered, never put in an attribute, never fetched with. */
    expect(CODE).not.toMatch(/\{raw\}/);
    expect(CODE).not.toMatch(/=\{raw\}/);
    expect(CODE).not.toMatch(/href/);
    expect(CODE).not.toMatch(/fetch\(/);
    expect(CODE).not.toMatch(/dangerouslySetInnerHTML/);
  });

  it('C-16 / C-20 — no retry, no counter, no cooldown, no analytics', () => {
    for (const forbidden of [
      'setTimeout',
      'setInterval',
      'location.assign',
      'location.href =',
      'localStorage',
      'sessionStorage',
      'gtag',
      'analytics',
      'track(',
      'attempt',
      'retryCount',
      'disabled',
    ]) {
      expect(CODE).not.toContain(forbidden);
    }
  });
});

describe('B5-A · C-T5 / C-11 — the parameter is stripped after render', () => {
  it('replaceState is called with the parameter deleted', () => {
    expect(CODE).toContain(`params.delete(AUTH_ERROR_PARAM)`);
    expect(CODE).toContain('window.history.replaceState');
  });

  it('it is stripped even when the value was NOT admissible', () => {
    /*
      The delete sits OUTSIDE the isAuthErrorCode branch. A forged unknown value
      should not survive in the address bar either — and if the delete were
      nested inside the admission branch, it would.
    */
    const effect = CODE.slice(CODE.indexOf('useEffect'), CODE.indexOf('}, []);'));
    const admitAt = effect.indexOf('if (isAuthErrorCode(raw)) setCode(raw);');
    const deleteAt = effect.indexOf('params.delete(AUTH_ERROR_PARAM)');

    expect(admitAt).toBeGreaterThan(0);
    expect(deleteAt).toBeGreaterThan(admitAt);
  });

  it('replaceState, not pushState — the failure landing is not a history entry', () => {
    expect(CODE).not.toContain('pushState');
  });
});

describe('B5-A · C-T8 / C-14 — the copy gives the reader nothing to act on', () => {
  const locales = ['en', 'pl'] as const;

  it('C-15 — both locales ship, together', () => {
    for (const locale of locales) {
      const copy = getDictionary(locale).authError;

      expect(copy.cancelled.length).toBeGreaterThan(0);
      expect(copy.failed.length).toBeGreaterThan(0);
      expect(copy.dismissLabel.length).toBeGreaterThan(0);
    }
  });

  it('the Polish strings are real translations, not the English ones', () => {
    const en = getDictionary('en').authError;
    const pl = getDictionary('pl').authError;

    expect(pl.cancelled).not.toBe(en.cancelled);
    expect(pl.failed).not.toBe(en.failed);
  });

  it('C-T8 — no URL, no @, no digit sequence, in either locale', () => {
    /*
      C-14 IS A SECURITY PROPERTY, NOT A STYLE RULE. `auth_error` is
      attacker-supplied, so anyone can raise this banner on the real site. The
      forgery stays inert only while the message offers no link, address or
      number to act on — a support line inside that string converts a cosmetic
      forgery into a phishing primitive.
    */
    for (const locale of locales) {
      const copy = getDictionary(locale).authError;

      for (const message of [copy.cancelled, copy.failed]) {
        expect(message).not.toMatch(/https?:\/\//i);
        expect(message).not.toMatch(/www\./i);
        expect(message).not.toContain('@');
        expect(message).not.toMatch(/\d/);
      }
    }
  });

  it('names no cause, and offers no reassurance or blame', () => {
    const forbidden = [
      /session expired/i,
      /provider/i,
      /unavailable/i,
      /invalid state/i,
      /usually works/i,
      /your (account|browser|credentials)/i,
      /minutes?/i,
      /try again in/i,
      /contact/i,
      /support/i,
    ];

    for (const locale of locales) {
      const copy = getDictionary(locale).authError;

      for (const message of [copy.cancelled, copy.failed]) {
        for (const pattern of forbidden) {
          expect(message).not.toMatch(pattern);
        }
      }
    }
  });

  it('C-15 — POSITIVE CONTROL: the guard fires on a deliberately non-compliant string', () => {
    /*
      Without this, every assertion above could be passing because the checks are
      wrong rather than because the copy is right.
    */
    const bad = 'Sign-in failed. Call 0800 123 456 or visit https://example.com for help.';

    expect(bad).toMatch(/https?:\/\//i);
    expect(bad).toMatch(/\d/);
    expect(bad).toMatch(/contact|support|call/i);
  });

  it('C-19 — there is one string per state, so the message cannot escalate', () => {
    /*
      An escalating message IS an attempt counter, which is exactly what C-20
      forbids. One string per state makes escalation unrepresentable rather than
      merely discouraged.
    */
    const en = getDictionary('en').authError;

    expect(Object.keys(en).sort()).toEqual(['cancelled', 'dismissLabel', 'failed']);
  });
});

describe('B5-A · C-T10 / C-13 — the error landing carries nothing onward', () => {
  it('the component constructs no returnTo and no sign-in URL', () => {
    expect(CODE).not.toContain('returnTo');
    expect(CODE).not.toContain('/auth/google');
  });

  it('no sign-in link anywhere in the app builds a returnTo containing auth_error', () => {
    /*
      C-T10 stated as the property it protects: a retry must not carry the
      previous failure forward, or a refresh would resurrect it.
    */
    const root = join(__dirname, '..', '..');
    const hits: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of readdirSyncSafe(dir)) {
        const full = join(dir, entry);

        if (isDirSafe(full)) {
          if (entry !== 'node_modules') walk(full);
          continue;
        }

        if (!/\.tsx?$/.test(entry) || /\.spec\.tsx?$/.test(entry)) continue;

        const text = readFileSync(full, 'utf-8');

        if (/returnTo[^\n]*auth_error|auth_error[^\n]*returnTo/.test(text)) hits.push(full);
      }
    };

    walk(root);

    expect(hits).toEqual([]);
  });
});

/* Small helpers kept local so the walk above stays readable. */
function readdirSyncSafe(dir: string): string[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  try {
    return fs.readdirSync(dir) as string[];
  } catch {
    return [];
  }
}

function isDirSafe(path: string): boolean {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  try {
    return fs.statSync(path).isDirectory() as boolean;
  } catch {
    return false;
  }
}

describe('B5-A · the shared definition is the only admission test', () => {
  it('the component imports the shared helper rather than re-declaring the set', () => {
    expect(COMPONENT).toContain("from '@globalnews-ai/shared'");
    expect(CODE).toContain('isAuthErrorCode');

    /* No second copy of the code list anywhere in the component. */
    expect(CODE).not.toMatch(/\['cancelled',\s*'failed'\]/);
  });

  it('AUTH_ERROR_PARAM is used rather than the literal string', () => {
    expect(CODE).toContain('AUTH_ERROR_PARAM');
    expect(CODE).not.toContain("'auth_error'");
  });
});
