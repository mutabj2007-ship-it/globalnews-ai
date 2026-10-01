import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateReturnDestination } from '../auth/return-destination.util';

/**
 * STAGE B — OAuth continuation for Discuss / Alert / Compare.
 *
 * DECISION: NO NEW RETURN DESTINATION. Every Stage B task starts on Home ('/'), which is
 * already allow-listed, so the reader returns to '/' and the pending task (kind + article
 * identity + the unsent draft) is restored from a short-lived same-tab record in the
 * browser — never from the URL. The allow-list, the HMAC-signed flow state and the
 * same-origin exit check are untouched; this spec pins that.
 */
const EXACT = ['/', '/history', '/support', '/map', '/search', '/workspace', '/my-intelligence', '/ask'];

describe('Stage B OAuth continuation — the allow-list is unchanged and closed', () => {
  it('exactly the pre-Stage-B destinations are accepted', () => {
    for (const d of EXACT) expect(validateReturnDestination(d)).toBe(d);
  });

  it.each([
    '/discussion',
    '/discussion/articles/abc',
    '/alerts',
    '/alerts/inbox',
    '/compare',
    '/?discuss=1',
    '/?draft=hello',
    '/#discuss',
    '/ask?q=what',
    '//evil.example',
    '/\\evil.example',
    '/%2F%2Fevil.example',
    'https://evil.example/',
    'javascript:alert(1)',
    '/../admin',
    '/my-intelligence/../../evil',
    ' /',
    '/\u0000',
  ])('refuses %j (no Stage B destination, no open redirect, no state in the URL)', (candidate) => {
    expect(validateReturnDestination(candidate)).toBeNull();
  });

  it('the backend source declares no Stage B destination', () => {
    const source = readFileSync(join(__dirname, '..', 'auth', 'return-destination.util.ts'), 'utf8');
    expect(source).not.toMatch(/'\/(discussion|alerts|compare)/);
  });
});
