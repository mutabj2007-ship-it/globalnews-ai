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
