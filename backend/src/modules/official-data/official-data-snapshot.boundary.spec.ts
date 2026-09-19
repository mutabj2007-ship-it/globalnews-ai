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

  it('constructs no HTTP client anywhere in the module', () => {
    /*
      ── RESTATED BY THE CANONICAL ADMISSION WORK, AND HERE IS WHY ───────────

      It read "nothing here fetches", matched with /\bfetch\(/. That was exactly right
      while this module was a STORE — handed bytes, never going to get them.

      The module now also contains the CANONICAL TRANSPORT PORT, whose entire job is to
      be the one place official-data reaches a network. Its port method is CALLED
      `fetch`, so the old pattern matched a method name and reported a boundary violation
      that had not happened.

      Loosening the regex to let `fetch` through would have thrown the control away. So
      the rule is restated as the thing it was protecting, which has not changed: NO HTTP
      CLIENT IS IMPORTED OR CONSTRUCTED HERE. A second retrieval path inside this module
      would bypass every step of the accepted safe-fetch order of operations while
      looking like part of an approved capability — and building one requires a client.
    */
    for (const [name, src] of files) {
      expect([
        name,
        /axios|HttpService|node:https?|require\(['"]https?['"]\)|https?\.request\(|new XMLHttpRequest/i.test(
          src,
        ),
      ]).toEqual([name, false]);
    }
  });

  it('and the transport reaches the network ONLY through an injected function', () => {
    /*
      The other half, and the half that makes the rule above more than a naming
      convention. The transport is allowed to be the network SEAM; it is not allowed to
      BE the network. It holds an injected `WireFetch` and can do nothing that function
      does not do for it — so this package still contains no path to a real request,
      which is what "no provider activation" means structurally rather than as a promise.
    */
    const transport = files.find(([n]) => n === 'official-data-transport.node.ts');
    expect(transport).toBeDefined();

    const src = transport![1];

    expect(/type WireFetch =/.test(src)).toBe(true);
    expect(/private readonly wireFetch: WireFetch/.test(src)).toBe(true);

    // The only call it makes is to the injected function — never to a global `fetch`.
    expect(/this\.wireFetch\(/.test(src)).toBe(true);
    expect(/(?:await|=|return)\s+fetch\(/.test(src)).toBe(false);
    expect(/globalThis\.fetch/.test(src)).toBe(false);
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
    /*
      THIS PINNED AN EXACT FILE LIST, AND THAT WAS THE SAME MISTAKE TWICE OVER.

      The list froze the two files the module happened to contain when it was written, so
      adding the canonical transport and the Market binding — both squarely inside this
      module's remit — failed a control whose actual job is to prove THE SCAN IS LOOKING
      AT SOMETHING. The shared/ boundary assertion in this same suite was corrected for
      precisely this reason one revision earlier; the lesson evidently needed applying
      here too.

      Restated as the property: the scanned product set is non-empty and still contains
      the files the rules above are about. A future file is covered automatically, which
      is what a boundary control is for — it should make new code prove itself, not
      require permission to exist.
    */
    const product = files.filter(([n]) => !n.endsWith('.spec.ts')).map(([n]) => n);

    expect(product.length).toBeGreaterThanOrEqual(2);
    for (const required of [
      'official-data-snapshot.store.ts',
      'official-data-snapshot.prisma-port.ts',
    ]) {
      expect([required, product.includes(required)]).toEqual([required, true]);
    }
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
    ── THIS ASSERTION HAS BEEN WRONG TWICE, IN THE SAME WAY ──────────────────

    It began as "the only shared/ change is the contract and its barrel line",
    checked against `git diff HEAD`. That was true while the work was uncommitted and
    false the moment it was committed: a test that passes only before you commit is a
    test that fails for everyone afterwards, for no reason anybody can act on.

    So it was restated against the commit that introduced the capability — and named
    that commit by the two exact paths it happened to touch. R2 then added a THIRD
    shared file, `official-data/snapshot-admission.ts`, and the assertion failed on a
    change that is entirely within its own remit. Pinning the file LIST was the same
    error in a new coat: it froze an accident of R1 instead of the rule.

    What the assertion is actually for is a containment rule, and that is durable:

        every shared/ file this capability touches is either the barrel line or lives
        under shared/src/official-data/ — the store never reaches into another
        module's contract to make room for itself.

    Stated that way it holds for R1, holds for R2, and still means something in R3.
    It is also checked across the WHOLE lineage rather than the newest commit, so a
    future revision cannot slip sprawl in behind an older one.
  */
  it('no commit in this capability reaches outside its own shared/ contract surface', () => {
    const lineage = git('log', '--format=%H', '--', 'shared/src/official-data/snapshot.ts')
      .trim()
      .split('\n')
      .filter((sha) => sha !== '');

    // Before the capability is committed there is nothing to check, and saying so is
    // better than pretending to have checked.
    if (lineage.length === 0) return;

    for (const sha of lineage) {
      const sharedChanges = git('show', '--name-only', '--format=', sha)
        .split('\n')
        .map((s) => s.trim())
        .filter((f) => f.startsWith('shared/'))
        .sort();

      const strayed = sharedChanges.filter(
        (f) => f !== 'shared/src/index.ts' && !f.startsWith('shared/src/official-data/'),
      );

      expect([sha, strayed]).toEqual([sha, []]);
    }
  });

  it('and the barrel gained export lines only — it lost none', () => {
    /*
      The containment rule above permits touching the barrel. This says what touching
      it is allowed to mean: adding exports. A REMOVED barrel line is how a change
      that looks local silently breaks an unrelated consumer, and it is the one edit
      to that file this capability has no business making.
    */
    const lineage = git('log', '--format=%H', '--', 'shared/src/official-data/snapshot.ts')
      .trim()
      .split('\n')
      .filter((sha) => sha !== '');

    for (const sha of lineage) {
      const removed = git('show', '--format=', '--unified=0', sha, '--', 'shared/src/index.ts')
        .split('\n')
        .filter((l) => l.startsWith('-') && !l.startsWith('---'));

      expect([sha, removed]).toEqual([sha, []]);
    }
  });
});
