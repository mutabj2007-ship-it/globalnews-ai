import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { askContextKey } from './askContextRef';
import {
  ASK_BINDABLE_MODULES,
  askModuleHref,
  askModuleRef,
  dashboardModuleContext,
} from './askModuleRef';

/**
 * UNIFIED INTELLIGENCE BINDING R2F — dashboard records enter the ONE Ask as references
 * (module + stable key). Bound: Conflict, Imihigo, Economy, Market. NOT_BINDABLE_YET: Energy,
 * Politics, Elections, Humanitarian (no governed contributor) — no launcher, no reference.
 */

const SRC = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
const KEY = 'ucdp-ged:12345';

describe('askModuleRef — references only, bindable modules only', () => {
  it('the four bound modules build { kind, module, observationKey } and nothing else', () => {
    for (const mod of ASK_BINDABLE_MODULES) {
      expect(askModuleRef(mod, KEY)).toEqual({ kind: 'MODULE', module: mod, observationKey: KEY });
    }
    expect([...ASK_BINDABLE_MODULES].sort()).toEqual(['CONFLICT', 'ECONOMY', 'IMIHIGO', 'MARKET']);
  });

  it.each(['ENERGY', 'POLITICS', 'ELECTIONS', 'HUMANITARIAN', 'conflict', '', undefined])(
    'module %p is not bindable → no reference',
    (mod) => {
      expect(askModuleRef(mod, KEY)).toBeUndefined();
    },
  );

  it('a malformed key is never sent', () => {
    expect(askModuleRef('CONFLICT', '')).toBeUndefined();
    expect(askModuleRef('CONFLICT', 'a\nb')).toBeUndefined();
    expect(askModuleRef('CONFLICT', 'k'.repeat(301))).toBeUndefined();
    expect(askModuleRef('CONFLICT', 42)).toBeUndefined();
  });
});

describe('the /ask arrival and the launcher href', () => {
  it('round-trips: href → arrival gives the same reference; the label is display only', () => {
    const href = askModuleHref('MARKET', 'TED:123-2026', 'TED · 123-2026', '/market')!;
    expect(href.startsWith('/ask?')).toBe(true);
    const params = new URLSearchParams(href.slice('/ask?'.length));
    expect(params.get('q')).toBeNull();
    expect(params.get('return')).toBe('/market');
    const arrival = dashboardModuleContext(params)!;
    expect(arrival.ref).toEqual({
      kind: 'MODULE',
      module: 'MARKET',
      observationKey: 'TED:123-2026',
    });
    expect(arrival.label).toBe('TED · 123-2026');
    expect(Object.keys(arrival.ref).sort()).toEqual(['kind', 'module', 'observationKey']);
  });

  it('a crafted arrival naming an unbound module or a bad key yields no context', () => {
    expect(
      dashboardModuleContext(new URLSearchParams({ module: 'ENERGY', observationKey: KEY })),
    ).toBeUndefined();
    expect(dashboardModuleContext(new URLSearchParams({ module: 'CONFLICT' }))).toBeUndefined();
    expect(dashboardModuleContext(new URLSearchParams('q=Why%3F'))).toBeUndefined();
  });

  it('labels are bounded and stripped of control characters; unsafe return paths are dropped', () => {
    const arrival = dashboardModuleContext(
      new URLSearchParams({
        module: 'CONFLICT',
        observationKey: KEY,
        moduleLabel: `a\u0007b${'x'.repeat(300)}`,
      }),
    )!;
    expect(arrival.label.length).toBeLessThanOrEqual(120);
    expect(arrival.label).not.toMatch(/[\u0000-\u001f]/);
    const href = askModuleHref('CONFLICT', KEY, 'x', '//evil.example')!;
    expect(new URLSearchParams(href.slice(5)).get('return')).toBeNull();
    expect(askModuleHref('ENERGY' as never, KEY, 'x')).toBeUndefined();
  });

  it('the change identity separates records', () => {
    const a = askContextKey(askModuleRef('CONFLICT', 'k1'));
    expect(a).toBe('MODULE:CONFLICT:k1');
    expect(askContextKey(askModuleRef('CONFLICT', 'k2'))).not.toBe(a);
    expect(askContextKey(askModuleRef('MARKET', 'k1'))).not.toBe(a);
  });
});

describe('wiring — the screen sends what it shows; launchers only where a contributor exists', () => {
  it('/ask sends the record reference while its chip is shown, else the story/country context', () => {
    const screen = read('components/ask-frame/AskFrameScreen.tsx');
    expect(screen).toContain('dashboardModuleContext(new URLSearchParams(urlKey))');
    expect(screen).toContain(
      'r2.submit(draft, moduleContext?.ref ?? askContextRefOf(context, undefined))',
    );
    expect(screen).toContain('data-ask-context-kind="MODULE"');
  });

  it('the launcher is a plain link: no request, no compute on render or click', () => {
    const link = read('components/ask/AskAboutRecordLink.tsx');
    expect(link).not.toMatch(/fetch\(|askV2Api|useEffect|onClick/);
    expect(link).toContain('askModuleHref(');
  });

  it.each([
    ['components/conflict/ConflictDashboard.tsx', 'CONFLICT'],
    ['components/market/MktNoticeCard.tsx', 'MARKET'],
    ['components/delivery/ImihigoScreen.tsx', 'IMIHIGO'],
    ['components/economy/EconomyScreen.tsx', 'ECONOMY'],
  ])('%s offers "Ask about this record" for %s', (file, mod) => {
    expect(read(file)).toContain(`module="${mod}"`);
  });

  it('Energy, Politics, Elections and Humanitarian surfaces offer no record launcher', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        return statSync(p).isDirectory() ? walk(p) : [p];
      });
    for (const dir of [
      'components/energy',
      'components/politics',
      'components/elections',
      'components/humanitarian',
    ]) {
      let files: string[] = [];
      try {
        files = walk(join(SRC, dir));
      } catch {
        continue;
      }
      for (const file of files)
        expect(readFileSync(file, 'utf8')).not.toContain('AskAboutRecordLink');
    }
  });
});
