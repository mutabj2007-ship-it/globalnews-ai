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

/**
 * A-1 — structural assertions below read POSITIONS in the source, and the
 * source comments explaining the A-1 repair necessarily quote the very
 * predicates those assertions look for. Matching a file's own explanation
 * instead of its code is a real way to get a green test for the wrong reason,
 * so every positional check strips comments first. Same helper shape as
 * adminOperationalSurface.spec.ts.
 */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

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

    /**
     * A-1 REPAIR — THIS ASSERTION REPLACES ONE THAT PINNED THE DEFECT.
     *
     * It previously read:
     *     expect(table).toContain("state !== 'real' && state !== 'zero'");
     * alongside a comment claiming the table "implements the same six states
     * inline". It did not: it implemented three (loading, not-presented,
     * presented), and that single predicate was exactly what swallowed
     * `error` into the caller's empty copy. The test therefore guarded the
     * bug it was written to prevent, and passed while doing so.
     *
     * The table still renders its own LOADING branch — skeleton ROWS, not a
     * single block, so the grid keeps its height — but every other
     * non-presented state now goes through the shared renderer.
     */
    const table = readFileSync(join(PRIMITIVES, 'AdminDataTable.tsx'), 'utf-8');
    expect(table).toContain("state === 'loading'");
    expect(table).toContain('AdminStateBlock');
    expect(table).toContain("state === 'error'");
    expect(table).toContain('emptyTitle');
    expect(table).toContain('emptyBody');
  });

  it('A-1 — a failed table read can never reach the copy written for an absent capability', () => {
    const table = stripComments(readFileSync(join(PRIMITIVES, 'AdminDataTable.tsx'), 'utf-8'));

    const errorBranch = table.indexOf("state === 'error'");
    const capabilityBranch = table.indexOf("state !== 'real' && state !== 'zero'");
    const rowsBranch = table.indexOf('rows.length === 0');

    expect(errorBranch).toBeGreaterThan(-1);
    expect(capabilityBranch).toBeGreaterThan(-1);
    expect(rowsBranch).toBeGreaterThan(-1);

    // Ordering IS the guarantee. If the error branch ever moves below either
    // of the other two, a failed fetch starts rendering the caller's wording
    // again — which is precisely how A-1 read as a designed absence.
    expect({ errorBeforeCapability: errorBranch < capabilityBranch }).toEqual({
      errorBeforeCapability: true,
    });
    expect({ errorBeforeRows: errorBranch < rowsBranch }).toEqual({ errorBeforeRows: true });

    // And the error branch itself must not render caller copy. Bounded at the
    // shared `callerCopy` element rather than at the next branch, because that
    // element is declared BETWEEN them and legitimately mentions both props.
    const callerCopyAt = table.indexOf('const callerCopy');
    expect(callerCopyAt).toBeGreaterThan(errorBranch);

    const errorBlock = table.slice(errorBranch, callerCopyAt);
    expect(errorBlock).toContain('AdminStateBlock');
    expect(errorBlock).not.toContain('emptyTitle');
    expect(errorBlock).not.toContain('emptyBody');
  });

  it('A-1 — retry is offered only where a reload exists, and is never a page refresh', () => {
    const table = stripComments(readFileSync(join(PRIMITIVES, 'AdminDataTable.tsx'), 'utf-8'));

    // Optional by design: AdminStateBlock omits the button when no handler is
    // supplied rather than rendering a control that does nothing.
    expect(table).toContain('onRetry?: () => void');
    expect(table).toContain('onRetry={onRetry}');
    expect(table).not.toMatch(/location\.reload|window\.location/);
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
