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
    /*
      ── RESTATED AGAIN BY THE PRODUCTION DRIVER, AND HERE IS WHY ────────────

      NISR PRODUCTIONIZATION R1 ruling C required the landed safe-fetch POLICY to gain
      a driver, and a driver is by definition the thing that opens the socket. So there
      is now exactly one file in this module that constructs an HTTP client, and
      `node:https` appearing in it is the round’s deliverable rather than a violation.

      LOOSENING THE PATTERN WOULD HAVE THROWN THE CONTROL AWAY. What the rule protects
      is unchanged: "a SECOND retrieval path inside this module would bypass every step
      of the accepted safe-fetch order of operations while looking like part of an
      approved capability". So the rule is now NARROWER than before, not weaker — it
      names the ONE file permitted to hold a client, and every other file in the module
      must still be free of one. A second driver fails here.

      And the permitted file is not trusted on its word: `safe-wire-fetch.node.spec.ts`
      C-P13 asserts, by source inspection, that it re-implements NO policy — no scheme
      literal, no denylist, no private-range arithmetic, no cap arithmetic, no hop
      comparison — so the one file that may reach the network is the one file that may
      decide nothing.
    */
    const THE_ONE_DRIVER = 'safe-wire-fetch.node.ts';
    expect(files.some(([n]) => n === THE_ONE_DRIVER)).toBe(true);

    for (const [name, src] of files) {
      if (name === THE_ONE_DRIVER) continue;
      if (name.endsWith('.spec.ts')) continue; // see the note on spec files below
      expect([
        name,
        /axios|HttpService|node:https?|require\(['"]https?['"]\)|https?\.request\(|new XMLHttpRequest/i.test(
          src,
        ),
      ]).toEqual([name, false]);
    }
  });

  it('and the ONE driver reaches the network only through the landed adjudicators', () => {
    /* The other half of the narrowed rule. A driver that opened a socket without
       obeying the policy would satisfy the exclusion above and defeat its purpose. */
    const driver = files.find(([n]) => n === 'safe-wire-fetch.node.ts');
    expect(driver).toBeDefined();
    const src = driver![1];
    for (const adjudicator of ['assertUrlIsFetchable', 'classifyResolvedSet', 'adjudicateRedirect', 'adjudicateContentLength', 'credentialHeadersFor', 'finalUrlFor']) {
      expect([adjudicator, src.includes(adjudicator)]).toEqual([adjudicator, true]);
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
    /*
      SPEC FILES ARE EXCLUDED, AND THE REASON IS GENERAL RATHER THAN CONVENIENT: a suite
      that asserts the ABSENCE of a pattern necessarily CONTAINS that pattern, as a
      string or a regex literal. `safe-wire-fetch.node.spec.ts` carries
      `/setInterval|setTimeout\(|cron|schedule/i` precisely to prove the driver has no
      scheduler in it — and scanning that assertion reported it as a scheduler.

      This is the same exclusion the edition-annotation rule below already makes, for
      the same reason. The rule still binds on every production file in the module.
    */
    for (const [name, src] of files) {
      if (name.endsWith('.spec.ts')) continue;
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
  /*
    ── THE THIRD TIME THIS FILE READ THE WORKING TREE, AND THE LAST ───────────

    These four assertions were built on `git diff HEAD` plus untracked files — the
    WHOLE working tree, whoever put it there. That is not "this capability's
    changes"; it is "everything currently uncommitted in this checkout", and the two
    are the same thing only while nobody else is working.

    It held until the Humanitarian R3 convergence landed twenty frontend files in a
    different lane. This suite then failed, reporting that the SNAPSHOT STORE had
    acquired a frontend surface. It had not. The store was not involved at all.

    That is a false report, and a false report from a boundary guard is worse than no
    guard: the next person to see it fires will assume it is noise, and one day it
    will not be.

    The lineage form is used instead — the same correction the shared/ containment
    rule below already carries.

    ── AND THEN THE LINEAGE FORM WAS WRONG TOO, FOR A DIFFERENT REASON ───────

    "Every path touched by every commit that touched this capability" is not the same
    as "every path this capability touched". The Humanitarian GX-14 convergence
    committed twenty frontend files AND a one-line correction to this very spec, in one
    commit. That commit therefore entered the capability's history, dragged the whole
    frontend in with it, and this assertion fired again — still naming the snapshot
    store for something another lane did.

    The distinction that was missing is SINGLE-LANE vs CROSS-LANE. A commit whose
    changes are confined to this capability is this capability acting. A commit that
    spans lanes is a convergence, and attributing its other lane's files here is the
    same false report in a third costume.

    So the scan is over single-lane commits only. What that gives up is stated plainly:
    a cross-lane commit could now hide a Map edit from this check. What it gains is that
    the check stops crying wolf — and SR-21, the property the frontend rule was a PROXY
    for, is asserted DIRECTLY further down by the route/controller/resolver scan, which
    no commit shape can evade.
  */
  const CAPABILITY_PREFIXES = [
    'shared/src/official-data/',
    'backend/src/modules/official-data/',
    'backend/prisma/',
  ];

  const isCapabilityPath = (f: string): boolean =>
    CAPABILITY_PREFIXES.some((p) => f.startsWith(p)) || f === 'shared/src/index.ts';

  const capabilityCommits = git(
    'log',
    '--format=%H',
    '--',
    'shared/src/official-data',
    'backend/src/modules/official-data',
  )
    .trim()
    .split('\n')
    .filter((sha) => sha !== '');

  const filesOf = (sha: string): string[] =>
    git('show', '--name-only', '--format=', sha)
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s !== '');

  /** Commits whose every changed path lies inside this capability. */
  const singleLaneCommits = capabilityCommits.filter((sha) => filesOf(sha).every(isCapabilityPath));

  const changed = [...new Set(singleLaneCommits.flatMap(filesOf))];

  it('scans a non-empty SINGLE-LANE commit set (positive control)', () => {
    /*
      Without this, every assertion below is satisfied by an empty list — which is
      exactly what would happen if the path filter were ever mistyped. A guard that
      passes because it looked at nothing is the failure mode these four exist to
      avoid, so it is checked rather than assumed.
    */
    expect(capabilityCommits.length).toBeGreaterThan(0);
    // The one that matters: excluding cross-lane commits must not empty the set.
    expect(singleLaneCommits.length).toBeGreaterThan(0);
    expect(changed.length).toBeGreaterThan(0);
  });

  it('no commit in this capability touches a Map file', () => {
    expect(changed.filter((f) => /\/map\/|MapPage|GlobalMapShell/.test(f))).toEqual([]);
  });

  it('no commit in this capability touches a Support file', () => {
    expect(changed.filter((f) => /\/support\/|SupportScreen|supportEn|supportPl/.test(f))).toEqual(
      [],
    );
  });

  it('no commit in this capability touches a news or analysis provider file', () => {
    expect(
      changed.filter((f) => /modules\/news\/|modules\/analysis\/|modules\/signals\//.test(f)),
    ).toEqual([]);
  });

  it('no commit in this capability touches a frontend file at all', () => {
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
