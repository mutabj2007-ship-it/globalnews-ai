import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * F1.b — the design's tag-D values must not exist anywhere in the
 * shipped codebase.
 *
 * The approved package is explicit: every figure in the artifact is
 * illustrative, and none of it may ship as fact. This sweep covers the
 * whole admin surface — components, lib, routes and BOTH dictionaries —
 * because a sample figure smuggled into a translation string is just as
 * false as one in a component.
 */
const FRONTEND_SRC = join(__dirname, '..', '..');

const FORBIDDEN: ReadonlyArray<[string, string]> = [
  ['5252445566', 'sample NIP'],
  ['9581234567', 'sample NIP'],
  ['6771122334', 'sample NIP'],
  ['DE811907980', 'sample EU VAT ID'],
  ['SE556677889901', 'sample EU VAT ID'],
  ['FV/2026', 'sample invoice series'],
  ['KOR/2026', 'sample correction series'],
  ['A1B2C3', 'sample KSeF reference'],
  ['77D0E1', 'sample KSeF reference'],
  ['GN-2026-', 'sample ticket reference'],
  ['evt_01J9K7RQ2M8F', 'sample audit event id'],
  ['203.0.113.44', 'sample IP address'],
  ['d.kowal', 'invented administrator'],
  ['m.lis', 'invented administrator'],
  ['a.kern', 'invented administrator'],
  ['j.iwan', 'invented administrator'],
  ['k.nowak', 'invented user'],
  ['j.smith', 'invented user'],
  ['a.dubois', 'invented user'],
  ['m.weber', 'invented user'],
  ['Nowak Media', 'invented company'],
  ['Baltic Press', 'invented company'],
  ['Redaktion Nord', 'invented company'],
  ['Nordic Wire', 'invented company'],
  ['Kraków Analytics', 'invented company'],
  ['24 532', 'sample article count'],
  ['18 729', 'sample user count'],
  ['44 108', 'sample session count'],
  ['412 880', 'sample revenue'],
  ['335 675', 'sample revenue'],
  ['77 205', 'sample VAT total'],
  ['61 402', 'sample VAT total'],
  ['4 812', 'sample subscription count'],
  ['1 532', 'sample source count'],
  ['p95 340', 'sample latency'],
  ['p95 210', 'sample latency'],
  ['AI VERIFIED', 'withdrawn accuracy claim'],
  ['FACT CHECKED', 'withdrawn accuracy claim'],
  ['cus_88', 'sample customer id'],
  ['txn_9F41', 'sample transaction id'],
  ['sub_7741', 'sample subscription id'],
  ['usr_41290', 'sample user id'],
  ['usr_20411', 'sample user id'],
];

function sourceFiles(dir: string = FRONTEND_SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('F1.b — no Claude Design sample data ships', () => {
  const files = sourceFiles().filter((file) => !file.endsWith('adminNoSampleData.spec.ts'));

  it('sweeps the whole frontend source tree', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  /**
   * Comments are stripped before the sweep. A doc comment that NAMES a
   * withdrawn claim in order to explain why it stays withdrawn — as
   * OperationsScreen does for "AI VERIFIED" — is the opposite of
   * smuggling it back in, and this spec should not punish it. Anything
   * inside a string literal or rendered markup is still caught.
   */
  const stripped = new Map(
    files.map((file) => [
      file,
      readFileSync(file, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1'),
    ]),
  );

  FORBIDDEN.forEach(([needle, why]) => {
    it(`contains no ${why}: "${needle}"`, () => {
      const offenders = files.filter((file) => (stripped.get(file) ?? '').includes(needle));
      expect(offenders).toEqual([]);
    });
  });

  it('the admin dictionaries carry no digit-led figure in either language', () => {
    ['adminEn.ts', 'adminPl.ts'].forEach((name) => {
      const source = readFileSync(join(FRONTEND_SRC, 'lib', 'i18n', 'dictionaries', name), 'utf-8');
      const strings = source.match(/'[^']{2,}'/g) ?? [];

      strings.forEach((raw) => {
        const value = raw.replace(/'/g, '');
        // A number is allowed only where it is a format EXAMPLE
        // (1 234,56 / DD.MM.YYYY) or a protocol token (24H, 7D).
        if (/^\d[\d\s,.]*$/.test(value)) {
          expect(['1 234,56']).toContain(value);
        }
      });
    });
  });
});
