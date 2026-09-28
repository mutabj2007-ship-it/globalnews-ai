import { CSRF_COOKIE_NAME, HOST_CSRF_COOKIE_NAME, readCsrfCookieValue } from './sessionHint';

/**
 * ASK R2 INTEGRATION R1 · §14 / SQ-11 — the one CSRF reader prefers the `__Host-` cookie.
 * Implementation-facing: E1 verifies independently.
 */
describe('readCsrfCookieValue — __Host- first, plain name for http development', () => {
  it('names', () => {
    expect(CSRF_COOKIE_NAME).toBe('gna_csrf');
    expect(HOST_CSRF_COOKIE_NAME).toBe('__Host-gna_csrf');
  });

  it('a Secure deployment: the __Host- value is read', () => {
    expect(readCsrfCookieValue('__Host-gna_csrf=real')).toBe('real');
  });

  it('a planted plain-named cookie never shadows the __Host- one, whatever the order', () => {
    expect(readCsrfCookieValue('gna_csrf=planted; __Host-gna_csrf=real')).toBe('real');
    expect(readCsrfCookieValue('__Host-gna_csrf=real; gna_csrf=planted')).toBe('real');
  });

  it('http development: the plain name still works (local sign-in is not broken)', () => {
    expect(readCsrfCookieValue('other=1; gna_csrf=dev')).toBe('dev');
  });

  it('empty or absent is undefined — no header is sent', () => {
    expect(readCsrfCookieValue('gna_csrf=')).toBeUndefined();
    expect(readCsrfCookieValue('__Host-gna_csrf=  ')).toBeUndefined();
    expect(readCsrfCookieValue('')).toBeUndefined();
    expect(readCsrfCookieValue('gna_csrf_other=x')).toBeUndefined();
  });
});
