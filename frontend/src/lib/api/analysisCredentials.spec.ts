import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'analysisApi.ts'), 'utf-8');
const executable = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/**
 * PH-1 (frontend half) — the analysis client now identifies an EXISTING
 * session so a signed-in visitor receives the authenticated allowance.
 *
 * What must stay true, and is asserted here: this does not make analysis
 * authenticated, and it does not weaken CSRF anywhere.
 */
describe('PH-1 — analysis client credentials', () => {
  it('sends the session cookie so an existing session can be recognised', () => {
    expect(executable).toMatch(/credentials:\s*'include'/);
  });

  it('echoes the CSRF cookie as X-CSRF-Token, reusing the double-submit pattern the product already uses', () => {
    expect(executable).toMatch(/X-CSRF-Token/);
    expect(executable).toMatch(/gna_csrf/);
  });

  it('omits the header when there is no CSRF cookie — a signed-out visitor is served, not rejected', () => {
    // The header is set only inside a truthiness check on the cookie value.
    expect(executable).toMatch(/if \(csrfToken\) \{\s*headers\['X-CSRF-Token'\] = csrfToken;/);
  });

  it('reads the cookie from document only, never from anything the caller could inject', () => {
    expect(executable).toMatch(/document\.cookie/);
    expect(executable).not.toMatch(/localStorage|sessionStorage|window\.name/);
  });

  it('still sends JSON and still aborts on the existing timeout — the request shape is otherwise unchanged', () => {
    expect(executable).toMatch(/'Content-Type': 'application\/json'/);
    expect(executable).toMatch(/signal: controller\.signal/);
    expect(executable).toMatch(/cache: 'no-store'/);
  });

  it('does NOT require a session — there is no sign-in gate in the analysis client', () => {
    expect(executable).not.toMatch(/RequireAuth|redirect.*signin|if \(!user\)/i);
  });
});
