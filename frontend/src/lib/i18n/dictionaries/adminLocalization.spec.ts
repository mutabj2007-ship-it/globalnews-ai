import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { adminEn } from './adminEn';
import { adminPl } from './adminPl';
import { en } from './en';
import { pl } from './pl';
import { getDictionary } from './index';

/**
 * F1.b — EN/PL parity for the Admin namespace.
 *
 * Two things this must prove. First, structural parity: every key in one
 * language exists in the other, so a Polish administrator never meets an
 * undefined label. Second, that the Polish is REAL — genuinely different
 * text, not English copied across — with one deliberate exception.
 *
 * THE EXCEPTION IS IDENTIFIERS. Screen codes, probe statuses (HEALTHY,
 * UNKNOWN, NOT IMPLEMENTED, DISCONNECTED), window labels (24h, 7d, 30d),
 * format examples (DD.MM.YYYY, 1 234,56) and the brand name are protocol
 * tokens, not prose. Translating UNKNOWN would break the mapping between
 * what the backend reports and what the screen shows. Those keys are
 * listed explicitly below and are allowed — required, in fact — to match.
 */
const ADMIN_COMPONENTS = join(__dirname, '..', '..', '..', 'components', 'admin');
const APP_ADMIN = join(__dirname, '..', '..', '..', 'app', 'admin');

/** Dotted key paths whose value is an identifier and must be identical. */
const IDENTICAL_BY_DESIGN = new Set([
  'brand.name',
  'brand.accent',
  'states.unknown',
  'states.notImplemented',
  'states.unavailable',
  'screens.overview.windows.h24',
  'screens.overview.windows.d7',
  'screens.overview.windows.d30',
  'screens.payments.ksefStatusValue',
  'screens.payments.tabs.ksef',
  'screens.settings.groups.ksef',
  'screens.settings.localisation.adminLanguagesValue',
  'screens.systemHealth.statuses.HEALTHY',
  'screens.systemHealth.statuses.DEGRADED',
  'screens.systemHealth.statuses.FAILING',
  'screens.systemHealth.statuses.UNKNOWN',
  'screens.systemHealth.statuses.NOT_IMPLEMENTED',
]);

function flatten(value: unknown, prefix = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[prefix, value]];
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      flatten(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}

const enPairs = flatten(adminEn);
const plPairs = flatten(adminPl);
const plMap = new Map(plPairs);

function adminSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return adminSourceFiles(full);
    return entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.spec.ts')
      ? [full]
      : [];
  });
}

describe('F1.b — Admin localisation', () => {
  it('carries a substantial namespace, not a token effort', () => {
    expect(enPairs.length).toBeGreaterThan(120);
  });

  it('English and Polish have identical key sets', () => {
    expect(plPairs.map(([key]) => key).sort()).toEqual(enPairs.map(([key]) => key).sort());
  });

  it('no Polish string is empty', () => {
    plPairs.forEach(([key, value]) => {
      expect({ key, empty: value.trim().length === 0 }).toEqual({ key, empty: false });
    });
  });

  it('every prose string genuinely differs between the two languages', () => {
    const identical = enPairs
      .filter(([key, value]) => !IDENTICAL_BY_DESIGN.has(key) && plMap.get(key) === value)
      .map(([key]) => key);

    expect(identical).toEqual([]);
  });

  it('every identifier that must NOT be translated is identical in both languages', () => {
    IDENTICAL_BY_DESIGN.forEach((key) => {
      const enValue = enPairs.find(([candidate]) => candidate === key)?.[1];
      expect({ key, value: plMap.get(key) }).toEqual({ key, value: enValue });
    });
  });

  it('resolves through the SAME getDictionary call as every other section — no second i18n mechanism', () => {
    expect(getDictionary('en').admin).toBe(adminEn);
    expect(getDictionary('pl').admin).toBe(adminPl);
    expect(en.admin).toBe(adminEn);
    expect(pl.admin).toBe(adminPl);
  });

  it('an unimplemented language falls back to the full English admin dictionary', () => {
    expect(getDictionary('sw').admin.screens.audit.noStoreTitle).toBe(
      adminEn.screens.audit.noStoreTitle,
    );
  });

  it('no admin component or page hardcodes user-facing English', () => {
    const offenders: string[] = [];

    [...adminSourceFiles(ADMIN_COMPONENTS), ...adminSourceFiles(APP_ADMIN)].forEach((file) => {
      const source = readFileSync(file, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
        .replace(/className=\{?["'`][\s\S]*?["'`]\}?/g, '')
        .replace(/import[\s\S]*?from\s+'[^']*';/g, '')
        .replace(/aria-current=\{[^}]*\}/g, '');

      // A JSX text node containing two or more Latin words is prose.
      const matches = source.match(/>[A-Za-z][A-Za-z'’]*(?: [A-Za-z'’]+)+</g);
      if (matches) offenders.push(`${file}: ${matches.join(' | ')}`);
    });

    expect(offenders).toEqual([]);
  });
});
