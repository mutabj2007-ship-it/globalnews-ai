import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { INTELLIGENCE_MODULES, isModuleNavigable } from '@/lib/intelligenceModules';
import { accountSignInUrl } from '@/lib/api/accountLinks';
import { HOME_CLICK_CONTRACT, HOME_MOUNTED_FILES } from './homeClickContract';

/**
 * HOME CLICK CONTRACT R1 — the matrix is checked against the code it describes.
 * A row whose evidence disappears, a registry destination that drifts, or a new
 * AI-spending control on Home fails here.
 */

const SRC = join(__dirname, '..', '..');
const read = (file: string): string => readFileSync(join(SRC, file), 'utf-8');
const code = (file: string): string =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

describe('HOME CLICK CONTRACT R1 — every row is backed by the source', () => {
  it('ids are unique', () => {
    const ids = HOME_CLICK_CONTRACT.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(HOME_CLICK_CONTRACT.map((row) => [row.id, row] as const))('%s — evidence present', (_, row) => {
    expect(existsSync(join(SRC, row.evidence.file))).toBe(true);
    expect(read(row.evidence.file)).toContain(row.evidence.contains);
  });

  it('every row declares at least one breakpoint', () => {
    for (const row of HOME_CLICK_CONTRACT) expect(row.breakpoints.length).toBeGreaterThan(0);
  });
});

describe('DESTINATIONS — INTELLIGENCE_MODULES is the one registry', () => {
  const registryRows = HOME_CLICK_CONTRACT.filter(
    (row): row is typeof row & { destination: { module: string } } => typeof row.destination !== 'string',
  );

  it.each(registryRows.map((row) => [row.id, row] as const))('%s resolves through the registry', (_, row) => {
    const entry = INTELLIGENCE_MODULES.find((candidate) => candidate.id === row.destination.module);
    expect(entry).toBeDefined();
    if (row.behavior === 'disabled') {
      expect(isModuleNavigable(entry!)).toBe(false);
    } else {
      expect(isModuleNavigable(entry!)).toBe(true);
    }
  });

  it('hardcoded /map links on Home still equal the registry destination they stand for', () => {
    const map = INTELLIGENCE_MODULES.find((entry) => entry.id === 'country-intelligence');
    expect(map?.destination).toBe('/map');
  });

  it('topic cards and header modules render the registry destination, not literals', () => {
    expect(code('components/home/ExploreByTopic.tsx')).toContain('href={module.destination}');
    expect(code('components/home/BetaHomeHeader.tsx')).toContain('INTELLIGENCE_MODULES');
  });
});

describe('AI COST — no browsing, filtering, navigation or follow control spends', () => {
  it('only the dock Send and the dock deeper-analysis transition carry AI cost', () => {
    const spending = HOME_CLICK_CONTRACT.filter((row) => row.aiCost !== 'none').map((row) => row.id);
    expect(spending.sort()).toEqual(['dock.open-full', 'dock.submit']);
  });

  it.each(HOME_MOUNTED_FILES.map((file) => [file] as const))('%s imports no analysis transport', (file) => {
    const source = code(file);
    expect(source).not.toContain('analyzeNews');
    expect(source).not.toContain('@/lib/api/analysisApi');
  });

  it.each(HOME_MOUNTED_FILES.map((file) => [file] as const))('%s emits no /search?q= or /ask?q= link', (file) => {
    const source = code(file);
    expect(source).not.toMatch(/['"`]\/search\?/);
    expect(source).not.toMatch(/['"`]\/ask\?/);
  });
});

describe('SIGN-IN — the first-party OAuth entry, never the unserved bare path', () => {
  it.each(HOME_MOUNTED_FILES.map((file) => [file] as const))('%s has no bare /auth/google href', (file) => {
    expect(code(file)).not.toMatch(/href=["'`{]*\/auth\/google/);
  });

  it('the Home panel sign-in returns the reader to Home', () => {
    expect(accountSignInUrl('/')).toBe('/api/auth/google?returnTo=%2F');
    const row = HOME_CLICK_CONTRACT.find((candidate) => candidate.id === 'acct.signin-to-follow');
    expect(row?.destination).toBe(accountSignInUrl('/'));
  });
});

describe('DISABLED CONTROLS — disclosed, not decorative', () => {
  it.each(
    HOME_CLICK_CONTRACT.filter((row) => row.behavior === 'disabled').map((row) => [row.id, row] as const),
  )('%s is disclosed as unavailable', (_, row) => {
    expect(row.unavailable).not.toBe('—');
    expect(read(row.evidence.file)).toMatch(/aria-disabled|disabled/);
  });
});
