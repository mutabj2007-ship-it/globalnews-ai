import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  ADMIN_DATA_STATES,
  fromOptionalNumber,
  fromOptionalString,
  isPresented,
} from '@/lib/admin/adminDataState';

/**
 * F1.b — the six data states, and the rule that no screen renders a
 * number it was not given.
 *
 * The hardest assertion here is the last one: no admin screen may
 * contain a bare numeric literal in rendered position. That is what
 * stops the approved artifact's sample figures — 24 532 articles, 18 729
 * users, 412 880 PLN — from creeping back in as "placeholder" content.
 */
const PRIMITIVES = join(__dirname, 'primitives');
const SCREENS = join(__dirname, 'screens');

const primitiveFiles = readdirSync(PRIMITIVES).filter((name) => name.endsWith('.tsx'));
const screenFiles = readdirSync(SCREENS).filter((name) => name.endsWith('.tsx'));

describe('F1.b — the six admin data states', () => {
  it('declares exactly the six approved states', () => {
    expect([...ADMIN_DATA_STATES]).toEqual([
      'real',
      'zero',
      'loading',
      'unavailable',
      'error',
      'notImplemented',
    ]);
  });

  it('AdminStateBlock implements every one of them, with no default branch that could render a value', () => {
    const source = readFileSync(join(PRIMITIVES, 'AdminStateBlock.tsx'), 'utf-8');

    ADMIN_DATA_STATES.forEach((state) => {
      expect(source).toContain(`case '${state}'`);
    });

    expect(source).not.toContain('default:');
  });

  it('children — the real value — are rendered ONLY on the real and zero branches', () => {
    const source = readFileSync(join(PRIMITIVES, 'AdminStateBlock.tsx'), 'utf-8');
    const realBranch = source.slice(
      source.indexOf("case 'real'"),
      source.indexOf("case 'loading'"),
    );

    expect(realBranch).toContain('{children}');
    expect(source.slice(source.indexOf("case 'loading'"))).not.toContain('{children}');
  });

  it('every data-bearing primitive composes AdminStateBlock rather than inventing its own empty state', () => {
    ['KpiCard.tsx'].forEach((name) => {
      expect(readFileSync(join(PRIMITIVES, name), 'utf-8')).toContain('AdminStateBlock');
    });

    // The table implements the same six states inline because it renders
    // skeleton ROWS rather than a single block; it must still branch on
    // every non-presented state rather than showing an empty table.
    const table = readFileSync(join(PRIMITIVES, 'AdminDataTable.tsx'), 'utf-8');
    expect(table).toContain("state === 'loading'");
    expect(table).toContain("state !== 'real' && state !== 'zero'");
    expect(table).toContain('emptyTitle');
    expect(table).toContain('emptyBody');
  });

  describe('an absent number never becomes a zero', () => {
    it('undefined and null resolve to unavailable', () => {
      expect(fromOptionalNumber(undefined).state).toBe('unavailable');
      expect(fromOptionalNumber(null).state).toBe('unavailable');
      expect(fromOptionalNumber(undefined).value).toBeUndefined();
    });

    it('a genuine zero resolves to the zero state, carrying the value 0', () => {
      expect(fromOptionalNumber(0)).toEqual({ state: 'zero', value: 0, asOf: undefined });
    });

    it('a real number resolves to real', () => {
      expect(fromOptionalNumber(42, 'x').state).toBe('real');
      expect(fromOptionalNumber(42, 'x').value).toBe(42);
    });

    it('an empty string is unavailable, not a rendered blank', () => {
      expect(fromOptionalString('').state).toBe('unavailable');
      expect(fromOptionalString(undefined).state).toBe('unavailable');
      expect(fromOptionalString('ok').state).toBe('real');
    });

    it('only real and zero count as presented', () => {
      expect(isPresented('real')).toBe(true);
      expect(isPresented('zero')).toBe(true);
      ['loading', 'unavailable', 'error', 'notImplemented'].forEach((state) => {
        expect(isPresented(state as (typeof ADMIN_DATA_STATES)[number])).toBe(false);
      });
    });
  });

  it('NO admin screen contains a rendered numeric literal — the artifact figures cannot creep back in', () => {
    const offenders: string[] = [];

    screenFiles.forEach((name) => {
      const source = readFileSync(join(SCREENS, name), 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
        // Tailwind arbitrary values and class strings are layout, not data.
        .replace(/className=\{?["'`][\s\S]*?["'`]\}?/g, '')
        .replace(/ratio="[^"]*"/g, '');

      // A JSX text node that STARTS with a digit — >24 532< — would be a
      // rendered figure. Anything inside braces is an expression, and an
      // expression cannot smuggle in a literal the registry did not
      // supply, because AdminStateBlock refuses to render a value on any
      // non-presented state.
      const matches = source.match(/>\s*\d[\d\s,.]*</g);
      if (matches) offenders.push(`${name}: ${matches.join(' | ')}`);
    });

    expect(offenders).toEqual([]);
  });

  it('an unpopulated provider counter renders UNKNOWN rather than a number', () => {
    const operations = readFileSync(join(SCREENS, 'OperationsScreen.tsx'), 'utf-8');

    ['requestCount', 'failureCount', 'lastLatencyMs', 'lastSuccessAt', 'rateLimitState'].forEach(
      (field) => {
        // Whitespace-tolerant: Prettier wraps the longer ternaries.
        const guard = new RegExp(`row\\.${field}\\s*===\\s*undefined\\s*\\?\\s*\\(?\\s*unknown`);
        expect({ field, guarded: guard.test(operations) }).toEqual({ field, guarded: true });
      },
    );

    expect(operations).toContain('t.states.unknown');
  });

  it('a component with no probe renders UNKNOWN and never HEALTHY', () => {
    const health = readFileSync(join(SCREENS, 'SystemHealthScreen.tsx'), 'utf-8');
    expect(health).toContain('STATUS_TONE');
    expect(health).not.toMatch(/=\s*'HEALTHY'/);
  });

  it('every primitive is a client component under the shell boundary', () => {
    primitiveFiles.forEach((name) => {
      expect(readFileSync(join(PRIMITIVES, name), 'utf-8')).toContain("'use client'");
    });
  });
});
