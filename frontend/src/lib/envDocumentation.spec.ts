import { readFileSync } from 'fs';
import { join } from 'path';

const envExampleSource = readFileSync(join(__dirname, '../../../.env.example'), 'utf-8');

/**
 * Milestone #53 — MVP release-gate remediation. PrismaService's
 * constructor throws immediately if DATABASE_URL is absent, making it
 * a real, mandatory backend startup dependency in every environment —
 * but the committed environment documentation did not previously
 * mention it at all. This test protects the documentation fix.
 *
 * No backend/.env.example file exists in this repository checkout —
 * confirmed by direct inspection before this fix — so the root
 * .env.example (the one committed, real environment-documentation
 * file) is the correct place for this, matching where every other
 * backend-consumed variable (GNEWS_API_KEY, OPENAI_API_KEY,
 * FRONTEND_ORIGIN) is already documented.
 */
describe('DATABASE_URL environment documentation (Milestone #53)', () => {
  it('the committed .env.example documents DATABASE_URL', () => {
    expect(envExampleSource).toMatch(/^DATABASE_URL=/m);
  });

  it('explains that this is a mandatory startup dependency, not an optional convenience \u2014 preventing the confusing raw constructor error a fresh checkout would otherwise hit', () => {
    expect(envExampleSource).toMatch(/REQUIRED for the backend to start/);
    expect(envExampleSource).toMatch(/prisma\.service\.ts/);
  });

  it('uses an obviously fake placeholder value \u2014 never a real hostname, username, or password', () => {
    const line = envExampleSource.match(/^DATABASE_URL=(.*)$/m)?.[1] ?? '';
    expect(line).toMatch(/change_me/);
    expect(line).toMatch(/localhost/);
    expect(line).not.toMatch(/\.com|\.io|\.net|amazonaws|render\.com|supabase|neon\.tech/i);
  });

  it('explicitly instructs that no real connection string should ever be committed', () => {
    expect(envExampleSource).toMatch(/Never commit a real connection string/);
  });
});

/**
 * P-4 - deployment envelope environment documentation.
 *
 * Same mechanism and same file as the Milestone #53 block above: the committed
 * .env.example is this repository's only environment documentation, so a
 * variable that a deployment MUST set, or must deliberately NOT set, is only
 * genuinely documented if it is written down here.
 *
 * Three variables changed status in the deployment envelope change:
 *
 *   SERVER_INTERNAL_API_URL - new. The address Next.js SERVER-side code uses to
 *     reach the backend, distinct from the browser's NEXT_PUBLIC_API_URL. It is
 *     runtime-only and must never be inlined into a browser bundle, which is a
 *     property an operator cannot infer from the variable name alone.
 *
 *   NODE_ENV and POSTGRES_PASSWORD - both lost their silent Compose defaults.
 *     `docker compose` now refuses to render the file when either is unset, so
 *     the documented `cp .env.example .env` path only works if this file
 *     actually supplies them.
 */
describe('deployment envelope environment documentation (P-2 / P-4)', () => {
  describe('SERVER_INTERNAL_API_URL', () => {
    it('the committed .env.example documents SERVER_INTERNAL_API_URL', () => {
      expect(envExampleSource).toMatch(/^SERVER_INTERNAL_API_URL=/m);
    });

    it('documents it as the SERVER-side counterpart to the browser-facing NEXT_PUBLIC_API_URL', () => {
      expect(envExampleSource).toMatch(/SERVER-SIDE base URL/);
      expect(envExampleSource).toMatch(/counterpart to/);
      // Both variables must be documented, or the distinction is meaningless.
      expect(envExampleSource).toMatch(/^NEXT_PUBLIC_API_URL=/m);
    });

    it('states that it is runtime-only and must never reach browser-delivered JavaScript — the property an operator cannot infer from the name', () => {
      expect(envExampleSource).toMatch(/RUNTIME ONLY/);
      expect(envExampleSource).toMatch(/NOT named NEXT_PUBLIC_\*/);
      expect(envExampleSource).toMatch(/never sees it and must never contain it/);
    });

    it('uses the Docker-internal service address as its example value, never localhost', () => {
      const value = envExampleSource.match(/^SERVER_INTERNAL_API_URL=(.*)$/m)?.[1] ?? '';
      expect(value).toBe('http://backend:4000');
      expect(value).not.toMatch(/localhost/);
    });

    it('explicitly states it is never a secret, so no credential is ever placed in it', () => {
      expect(envExampleSource).toMatch(/plain internal base URL, never a secret/);
    });
  });

  describe('variables that lost their silent Compose default', () => {
    it('documents NODE_ENV as required, with no Compose default', () => {
      expect(envExampleSource).toMatch(/^NODE_ENV=/m);
      expect(envExampleSource).toMatch(/REQUIRED\. docker-compose\.yml supplies NO default/);
    });

    it('documents POSTGRES_PASSWORD as required, with no Compose default', () => {
      expect(envExampleSource).toMatch(/^POSTGRES_PASSWORD=/m);
      expect(envExampleSource).toMatch(/POSTGRES_PASSWORD is REQUIRED/);
    });

    it('supplies both values, so the documented `cp .env.example .env` path still renders', () => {
      expect(envExampleSource.match(/^NODE_ENV=(.+)$/m)?.[1]).toBe('development');
      expect(envExampleSource.match(/^POSTGRES_PASSWORD=(.+)$/m)?.[1]).toBe('change_me');
    });

    it('uses an obviously fake placeholder password and instructs that no real one be committed', () => {
      const value = envExampleSource.match(/^POSTGRES_PASSWORD=(.*)$/m)?.[1] ?? '';
      expect(value).toMatch(/change_me/);
      expect(value).not.toMatch(/\.com|\.io|\.net|amazonaws|render\.com|supabase|neon\.tech/i);
      expect(envExampleSource).toMatch(/Never commit a real password/);
    });
  });
});
