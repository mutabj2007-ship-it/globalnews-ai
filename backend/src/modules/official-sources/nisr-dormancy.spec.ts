/**
 * ════════════════════════════════════════════════════════════════════════════
 * NISR STAYS DORMANT — AND THIS RUNS IN CI, NOT ONLY IN THE MANUAL HARNESS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * This round landed a parser, a media row, a registry row and a numeric path for a source
 * that must not fetch anything. The manual harness checks the gate before it runs, which
 * is necessary and is not sufficient: the harness only runs when a human runs it, and the
 * property that matters is what holds WHEN NOBODY IS LOOKING.
 *
 * So the dormancy facts are asserted here, in the repository suite, where they are checked
 * on every change rather than on every rehearsal.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { installedNisrCpiTextLayerExtractorId, resolveParserBinding } from '@globalnews-ai/shared';

import { assertNisrDocumentProducerIsRunnable } from '../official-data/official-data.boot';

import { OFFICIAL_SOURCES } from './official-source-registry';

const BACKEND = join(__dirname, '..', '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('rw-nisr is registered and dormant', () => {
  const entry = OFFICIAL_SOURCES.find((s) => s.id === 'rw-nisr');

  it('is registered, and registration is not activation', () => {
    expect(entry).toBeDefined();
    expect(entry!.enabled).toBe(false);
    expect(entry!.ingestionMethod).toBe('none');
  });

  it('appears in no enabled-source list, so no scheduler can reach it', () => {
    const enabled = OFFICIAL_SOURCES.filter((s) => s.enabled).map((s) => s.id);
    expect(enabled).not.toContain('rw-nisr');
  });

  it('landing a parser did not enable anything — the registry row is not a switch', () => {
    /* The binding exists and resolves. That says what MAY read those bytes if they ever
       arrive through a governed fetch; it causes no fetch, and nothing in `src/` starts
       one. */
    expect(resolveParserBinding('rw-nisr', 'cpi-monthly-en', 'application/pdf')).not.toBeNull();
    expect(entry!.enabled).toBe(false);
  });
});

describe('nothing in the production tree can reach the network harness', () => {
  const sources = walk(join(BACKEND, 'src'));

  it('no file under src/ imports anything from tooling/', () => {
    const offenders = sources.filter((f) => {
      const text = readFileSync(f, 'utf8');
      return /from\s+['"][^'"]*\/tooling\//.test(text) || /require\(\s*['"][^'"]*\/tooling\//.test(text);
    });
    expect(offenders).toEqual([]);
  });

  it('tooling/ is excluded from the production build by an EXISTING rule', () => {
    /* Not by an exemption written to accommodate the harness: `tooling/**` was already
       in this list, and "add an exclude for my file" is the version of this fix that
       quietly weakens the config. */
    const build = readFileSync(join(BACKEND, 'tsconfig.build.json'), 'utf8');
    expect(build).toContain('tooling');
  });

  it('the harness is not a spec, so the repository suite never collects it', () => {
    const toolingDir = join(BACKEND, 'tooling', 'nisr-rehearsal');
    const files = readdirSync(toolingDir).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((f) => f.endsWith('.spec.ts'))).toEqual([]);
  });
});

describe('the decoder refuses by default, so a forgotten wiring reads nothing', () => {
  it('has no text-layer extractor installed in an ordinary runtime', () => {
    /* THE SAFE DIRECTION. A deployment that never installs an extractor reads no NISR
       figures; it does not read them badly. The harness installs one for its own run and
       this suite never does. */
    expect(installedNisrCpiTextLayerExtractorId()).toBe('nisr.cpi.no-extractor-installed');
  });

  it('refuses an artifact rather than guessing, with nothing installed', () => {
    const binding = resolveParserBinding('rw-nisr', 'cpi-monthly-en', 'application/pdf')!;
    const out = binding.decode(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.refusalKey).toBe('PARSE_FAILED');
    expect(out.detail).toContain('NISR_PDF_NO_TEXT_LAYER');
  });
});

/*
 ════════════════════════════════════════════════════════════════════════════
 STRENGTHENED FOR THE FOUR THINGS THIS ROUND ADDED
 ════════════════════════════════════════════════════════════════════════════

 The block above was written when the only new thing was a PARSER, and it says so:
 *"landing a parser did not enable anything"*. Since then NISR gained a production
 text extractor, a production wire driver, a boot gate and a read route — and each of
 those is a thing that could activate it, so each gets an assertion that it has not.

 A tripwire that still only watches the parser would pass while a scheduler, a driver
 registration or a read route quietly started fetching.
*/

const codeOnly = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

/** Every `.ts` under `src/`, comment-stripped, excluding suites. */
const PRODUCTION_SOURCES: ReadonlyArray<[string, string]> = walk(join(BACKEND, 'src'))
  .filter((f) => !f.endsWith('.spec.ts'))
  .map((f) => [f.slice(join(BACKEND, 'src').length + 1).replace(/\\/g, '/'), codeOnly(readFileSync(f, 'utf8'))]);

describe('NO SCHEDULER — nothing recurring can reach an official source', () => {
  it('scans a non-empty production tree (positive control)', () => {
    expect(PRODUCTION_SOURCES.length).toBeGreaterThan(100);
    expect(PRODUCTION_SOURCES.some(([n]) => n.includes('official-data'))).toBe(true);
  });

  it('no official-data, official-sources or economy file declares a schedule', () => {
    /*
      COMMENT-STRIPPED, because these files DISCUSS the absence of a scheduler at
      length. A guard that read the prose would fail on the sentence promising the
      property it is checking for — a mistake already made and corrected twice in
      this repository.
    */
    const offenders: string[] = [];
    for (const [name, code] of PRODUCTION_SOURCES) {
      if (!/^modules\/(official-data|official-sources|economy)\//.test(name)) continue;
      for (const rx of [/@Cron\b/, /@Interval\b/, /@Timeout\b/, /ScheduleModule/, /setInterval\s*\(/, /cron\.schedule/]) {
        if (rx.test(code)) offenders.push(`${name} :: ${rx.source}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('MUTATION CONTROL — the sweep fires on a decorated method', () => {
    expect(/@Cron\b/.test(codeOnly('@Cron("0 * * * *") fetchIt() {}'))).toBe(true);
    /* and NOT on prose about one */
    expect(/@Cron\b/.test(codeOnly('/* there is no @Cron here */ const x = 1;'))).toBe(false);
  });
});

describe('NO TRANSPORT — the production wire driver has no runtime call site', () => {
  /*
    `makeSafeWireFetch` is the ONE thing in this repository that can open a socket to a
    governed host. It exists because the one-shot proof needs it. What must hold while
    NISR is dormant is that NOTHING IN THE RUNNING APPLICATION CALLS IT — declaring it
    is not wiring it, and this is where that distinction is checked.
  */
  it('is called from nowhere under src/ — the definition is its only mention', () => {
    const callers = PRODUCTION_SOURCES.filter(
      ([name, code]) => name !== 'modules/official-data/safe-wire-fetch.node.ts' && /makeSafeWireFetch\s*\(/.test(code),
    ).map(([name]) => name);
    expect(callers).toEqual([]);
  });

  it('is registered with no Nest module, so DI cannot hand it to anything', () => {
    const registered = PRODUCTION_SOURCES.filter(
      ([name, code]) => /@Module\s*\(/.test(code) && /(makeSafeWireFetch|SafeWireFetch|WireFetch)/.test(code),
    ).map(([name]) => name);
    expect(registered).toEqual([]);
  });
});

describe('NO EXTRACTOR — the global install seam is composition-root-only', () => {
  /*
    B-7: the extractor is installed by the BOOT GATE and by nothing else, and the gate
    installs it if and only if the registry says the source is enabled. The read route
    deliberately does NOT use the global seam — it constructs its own decoder — so a
    read cannot leave an extractor installed behind it.
  */
  it('is NAMED in exactly one production file, and that file is the boot gate', () => {
    /*
      NAMED, not called. The gate passes the seam as an `install` property on an
      injectable wiring object, so the call site reads through that object and a
      call-shaped pattern found nothing — reporting a clean bill for a rule it had not
      checked. Matching the IDENTIFIER is the stronger claim in any case: no other
      production file may so much as reference the seam.
    */
    const installers = PRODUCTION_SOURCES.filter(([, code]) =>
      /\binstallNisrCpiTextLayerExtractor\b/.test(code),
    ).map(([name]) => name);
    expect(installers).toEqual(['modules/official-data/official-data.boot.ts']);
  });

  it('the gate reports the registry as DORMANT, and refuses to make it runnable', () => {
    expect(assertNisrDocumentProducerIsRunnable(OFFICIAL_SOURCES)).toBe('DORMANT_NOT_RUNNABLE');
  });

  it('the gate runs BEFORE the application is created, not after', () => {
    /*
      ORDER IS THE WHOLE POINT. A gate that ran after `NestFactory.create` would let a
      misconfigured deployment come up, serve, and only then complain — and item 2 is
      explicit that a deployment misconfiguration must not become permanent
      PARSE_FAILED evidence against NISR artifacts. Refusing to boot is how that is
      avoided.
    */
    const main = codeOnly(readFileSync(join(BACKEND, 'src', 'main.ts'), 'utf8'));
    const gate = main.indexOf('assertNisrDocumentProducerIsRunnable()');
    const create = main.indexOf('NestFactory.create');
    expect(gate).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(create);
  });
});

describe('THE READ ROUTE IS A READ — registering it activated nothing', () => {
  /*
    The Economy read opens bytes the snapshot store already retained. It is the first
    thing in this repository to serve a real NISR figure to a browser, so it is exactly
    the place a transport would arrive unnoticed.
  */
  const ECONOMY_GRAPH = [
    'modules/economy/economy.module.ts',
    'modules/economy/economy.controller.ts',
    'modules/economy/economy-observation.read.ts',
    'modules/official-data/nisr/nisr-cpi-retained.reader.ts',
  ];

  it('every file named above exists — the list is not stale (positive control)', () => {
    for (const name of ECONOMY_GRAPH) {
      expect([name, PRODUCTION_SOURCES.some(([n]) => n === name)]).toEqual([name, true]);
    }
  });

  it('carries no transport, no URL and no fetch', () => {
    const offenders: string[] = [];
    for (const name of ECONOMY_GRAPH) {
      const code = PRODUCTION_SOURCES.find(([n]) => n === name)?.[1] ?? '';
      for (const rx of [/\bfetch\s*\(/, /node:https?/, /axios/, /https?:\/\//, /WireFetch/, /Scheduler|@Cron/]) {
        if (rx.test(code)) offenders.push(`${name} :: ${rx.source}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('and the source it reads is STILL disabled — serving a figure is not activation', () => {
    expect(OFFICIAL_SOURCES.find((s) => s.id === 'rw-nisr')!.enabled).toBe(false);
  });
});
