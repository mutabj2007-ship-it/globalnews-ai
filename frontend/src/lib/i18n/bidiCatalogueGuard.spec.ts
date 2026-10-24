import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

/*
  E1-BIDI-1 (E1 ADDENDUM-23, adopted from Claude L) — no U+200E, U+200F, U+202A–202E, U+2066–2069 or
  U+061C in any reader-facing source. Directional isolation belongs in MARKUP, never in the data: an
  invisible control character can reorder a rights, provenance or status disclaimer so that what was
  reviewed and what a reader sees are no longer the same string.

  The guard covers every non-spec .ts/.tsx under frontend/src and shared/src (specs may plant control
  characters as test inputs). It has a positive control that must fail it.

  ONE pinned exception, pending E1's ruling: askGreetingStrings.ts wraps the reader's OWN display name in
  FSI/PDI (U+2068/U+2069) — a deliberate R76 defence that stops a name containing direction controls from
  reordering the greeting around it. That isolates UNTRUSTED INPUT rather than carrying data, so it is
  raised with E1 rather than removed silently. It is pinned to exactly one line so it cannot spread.
*/
const BIDI_CONTROL = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\u061C]/u;
const FRONTEND_SRC = resolve(__dirname, '../..');
const SHARED_SRC = resolve(__dirname, '../../../../shared/src');
const PINNED_EXCEPTIONS: Readonly<Record<string, number>> = {
  'frontend/src/lib/ask/askGreetingStrings.ts': 1,
};

function hits(root: string, label: string): Map<string, number> {
  const found = new Map<string, number>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(name) && !/\.spec\.tsx?$/.test(name)) {
        const lines = readFileSync(path, 'utf8')
          .split('\n')
          .filter((line) => BIDI_CONTROL.test(line)).length;
        if (lines > 0) found.set(`${label}/${relative(root, path).split('\\').join('/')}`, lines);
      }
    }
  };
  walk(root);
  return found;
}

describe('E1-BIDI-1 · no direction-control character in reader-facing source', () => {
  it('positive control: the guard finds a planted control character (written as an escape)', () => {
    expect(BIDI_CONTROL.test(`ok${String.fromCharCode(0x202e)}gnp.exe`)).toBe(true);
    expect(BIDI_CONTROL.test('clean ASCII and العربية')).toBe(false);
  });

  it('no non-spec source under frontend/src or shared/src carries one, except the pinned R76 name isolation', () => {
    const all = new Map([...hits(FRONTEND_SRC, 'frontend/src'), ...hits(SHARED_SRC, 'shared/src')]);
    const unexpected = [...all].filter(([file, n]) => PINNED_EXCEPTIONS[file] !== n);
    expect(unexpected).toEqual([]);
    for (const [file, n] of Object.entries(PINNED_EXCEPTIONS)) expect(all.get(file)).toBe(n);
  });
});
