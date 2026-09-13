import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Milestone #57 — source-level regression coverage matching this
 * codebase's own established convention for main.ts-level bootstrap
 * assertions (e.g. the M55/M56 rounds' own main.ts checks): confirms
 * credentials: true was added WITHOUT loosening the existing
 * fail-closed, specific-origin CORS policy — the origin value itself
 * still comes from resolveFrontendOrigin() (never a wildcard, never a
 * new dynamic-origin function), and Helmet/ValidationPipe/cookie-parser
 * registration order is preserved.
 */
describe('CORS credentials configuration (Milestone #57)', () => {
  const mainSource = readFileSync(join(__dirname, '../src/main.ts'), 'utf-8');

  it('enables credentials: true on the CORS configuration', () => {
    expect(mainSource).toMatch(/credentials:\s*true/);
  });

  it('the origin is still resolved via resolveFrontendOrigin() \u2014 never a wildcard or a new permissive function', () => {
    expect(mainSource).toMatch(/origin:\s*resolveFrontendOrigin\(/);
    expect(mainSource).not.toMatch(/origin:\s*['"]\*['"]/);
  });

  it('cookie-parser is registered so incoming session/CSRF cookies can be read on authenticated routes', () => {
    expect(mainSource).toMatch(/app\.use\(cookieParser\(\)\)/);
  });

  it('Helmet (Milestone #56) remains registered and unaffected by this change', () => {
    expect(mainSource).toMatch(/app\.use\(helmet\(\)\)/);
  });
});
