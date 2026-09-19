import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE BOUNDARY — THIS CAPABILITY CHANGES NOTHING THAT ALREADY WORKS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The brief asks for one thing to be proven explicitly: that adding a snapshot
 * store does not alter the Map or Support provider boundaries. Those boundaries
 * were expensive to establish — Map R2-A made passive navigation provider-free,
 * and Support R2-1…R2-3 made the live surface unable to reach its own fixtures —
 * and a new module that quietly touched either would be the worst kind of
 * regression, because nothing in the snapshot tests would notice.
 *
 * So the proof is structural rather than incidental: this suite reads the module
 * and the git diff, not the behaviour, and it fails if the module grows an
 * import, a fetch, a route or a scheduler.
 */

const REPO = join(__dirname, '..', '..', '..', '..');
const MODULE_DIR = __dirname;
const SELF = 'official-data-snapshot.boundary.spec.ts';

/** Comment-stripped: a forbidding guard must read code, never prose about it. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

function moduleSources(): Array<[string, string]> {
  return readdirSync(MODULE_DIR)
    .filter((f) => f.endsWith('.ts') && f !== SELF)
    .map((f) => [f, code(readFileSync(join(MODULE_DIR, f), 'utf8'))] as [string, string]);
}

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: REPO, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
}

describe('the snapshot module reaches into no other domain', () => {
  const files = moduleSources();

  it('scans a non-empty file set (positive control)', () => {
    expect(files.length).toBeGreaterThanOrEqual(3);
    expect(files.some(([n]) => n === SELF)).toBe(false);
  });

  it.each(['map', 'support', 'news', 'analysis', 'signals', 'situation', 'geo', 'auth'])(
    'imports nothing from the %s domain',
    (domain) => {
      for (const [name, src] of files) {
        const pattern = new RegExp(`from\\s+'[^']*\\b${domain}\\b[^']*'`, 'i');
        expect([name, domain, pattern.test(src)]).toEqual([name, domain, false]);
      }
    },
  );

  it('opens no evidence pipeline of its own — nothing here fetches', () => {
    /*
      THE STORE IS HANDED BYTES; IT DOES NOT GO AND GET THEM. Every fetch that
      feeds it passes the accepted safe-fetch order of operations first, and a
      second retrieval path inside the store would bypass every one of those
      controls while looking like part of an approved capability.
    */
    for (const [name, src] of files) {
      expect([name, /\bfetch\(|axios|HttpService|https?\.request|node:https/i.test(src)]).toEqual([
        name,
        false,
      ]);
    }
  });

  it('reads no secret and activates no provider', () => {
    /*
      SCOPED TO PRODUCT SOURCE, AND THE EXCLUSION IS DELIBERATE RATHER THAN
      CONVENIENT. `official-data-snapshot.store.spec.ts` contains the words
      `secret`, `token` and `apikey` BECAUSE IT IS THE TEST THAT FORBIDS THEM —
      it feeds each one to the store and asserts the refusal. A scan that fired
      on its own enforcement is the failure mode the Economy implementation
      boundary already hit and documented; the fix there was the same, and the
      positive control above is what keeps the remaining set non-empty.

      Every file that ships behaviour is still scanned.
    */
    for (const [name, src] of files) {
      if (name.endsWith('.spec.ts')) continue;
      expect([name, /process\.env|apiKey|API_KEY|\bsecret\b|bearer/i.test(src)]).toEqual([
        name,
        false,
      ]);
    }
  });

  it('and the product source being scanned is not empty (positive control)', () => {
    const product = files.filter(([n]) => !n.endsWith('.spec.ts')).map(([n]) => n);

    expect(product.sort()).toEqual([
      'official-data-snapshot.prisma-port.ts',
      'official-data-snapshot.store.ts',
    ]);
  });

  it('schedules nothing — there is still no scheduler in this backend', () => {
    for (const [name, src] of files) {
      expect([
        name,
        /@Cron|@Interval|ScheduleModule|setInterval|node-cron|bullmq?/i.test(src),
      ]).toEqual([name, false]);
    }
  });

  it('exposes no route, controller or resolver — SR-21', () => {
    for (const [name, src] of files) {
      expect([name, /@Controller|@Get\(|@Post\(|@Put\(|@Delete\(|createRouter/i.test(src)]).toEqual(
        [name, false],
      );
    }
  });

  it('never interprets an edition annotation — SR-13', () => {
    // Which edition is newer is provider knowledge. A platform module that
    // compared UPDATE_DATA or OBS_COUNT would be substituting the default the
    // contract refuses to supply.
    for (const [name, src] of files) {
      if (name.endsWith('.spec.ts')) continue;
      expect([name, /UPDATE_DATA|OBS_COUNT|OBS_PERIOD/i.test(src)]).toEqual([name, false]);
    }
  });
});

describe('this change alters no existing provider boundary', () => {
  /**
   * The diff against the commit this work started from. If a future edit inside
   * this capability touches Map, Support, news or the analysis pipeline, this
   * fails and names the file — which is the whole point of asserting it here
   * rather than remembering it in a report.
   */
  const changed = git('diff', '--name-only', 'HEAD')
    .split('\n')
    .concat(git('ls-files', '--others', '--exclude-standard').split('\n'))
    .map((s) => s.trim())
    .filter((s) => s !== '');

  it('the working tree touches no Map file', () => {
    expect(changed.filter((f) => /\/map\/|MapPage|GlobalMapShell/.test(f))).toEqual([]);
  });

  it('the working tree touches no Support file', () => {
    expect(changed.filter((f) => /\/support\/|SupportScreen|supportEn|supportPl/.test(f))).toEqual(
      [],
    );
  });

  it('the working tree touches no news or analysis provider file', () => {
    expect(
      changed.filter((f) => /modules\/news\/|modules\/analysis\/|modules\/signals\//.test(f)),
    ).toEqual([]);
  });

  it('the working tree touches no frontend file at all', () => {
    // This capability is backend and shared only. A frontend change here would
    // mean the store had acquired a surface, which SR-21 forbids.
    expect(changed.filter((f) => f.startsWith('frontend/'))).toEqual([]);
  });

  /*
    ── ORIGINALLY THIS ASSERTED THE WORKING TREE, AND THAT WAS A MISTAKE ──────

    It read: "the only shared/ change is the contract and its barrel line", against
    `git diff HEAD`. True while the work was uncommitted, and FALSE the moment it was
    committed — a test that passes only before you commit is a test that fails for
    everyone afterwards, for no reason anybody can act on.

    What the assertion was actually FOR is durable, so it is restated against the
    commit that introduced this capability rather than against whatever happens to be
    uncommitted right now: the snapshot store touched two shared files and no more.
  */
  it('and the commit that introduced this capability touched exactly two shared files', () => {
    const introducing = git(
      'log',
      '--format=%H',
      '-1',
      '--',
      'shared/src/official-data/snapshot.ts',
    )
      .trim()
      .split('\n')[0];

    // Before the capability is committed there is nothing to check, and saying so is
    // better than pretending to have checked.
    if (introducing === undefined || introducing === '') return;

    const sharedChanges = git('show', '--name-only', '--format=', introducing)
      .split('\n')
      .map((s) => s.trim())
      .filter((f) => f.startsWith('shared/'))
      .sort();

    expect(sharedChanges).toEqual(['shared/src/index.ts', 'shared/src/official-data/snapshot.ts']);
  });
});

describe('the official-source registry is still empty by design', () => {
  it('a store exists, and it still has nothing allowlisted to retrieve from', () => {
    /*
      P-2 landing does not activate a provider. The registry that names
      allowlisted providers is untouched and still empty by the M64.1 ruling, so
      a store constructed from it refuses every retrieval — which is the correct
      state until SNAP-R-1 and P-3 are closed.
    */
    const registry = readFileSync(
      join(REPO, 'backend', 'src', 'modules', 'official-sources', 'official-source-registry.ts'),
      'utf8',
    );

    expect(registry).toMatch(/starts empty and stays empty/);
    expect(registry).toMatch(/export const OFFICIAL_SOURCES: OfficialSourceEntry\[\] = \[\];/);
  });
});
