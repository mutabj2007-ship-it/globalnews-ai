/**
 * ════════════════════════════════════════════════════════════════════════════
 * MAIN-CONFLICT-D1-DOMAIN-BIND-R1 — THE BIND, AS LANDED AND AS WIRED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Main's own probes run against a harness of baseline bytes staged at
 * `BIND_ROOT`. Every one of the eight files that harness executes was verified
 * byte-identical on this lineage before landing, so Main's 23/23 carries.
 *
 * WHAT MAIN'S PROBES CANNOT COVER IS THE WIRING, because the wiring did not
 * exist when they were written. The contract is Main's; the three lines that
 * carry its value from the URL to the frozen panel are this lineage's, and they
 * are what this file guards:
 *
 *     MapPageClient   binds, and passes `contextQueue`
 *     GlobalMapShell  accepts it, defaults it to null, forwards it as `queue`
 *     ContextSummaryPanel   already declared, defaulted and gated it
 *
 * A contract that is correct and unreached is not a working surface, and the
 * failure mode of a mis-wire is the exact one this round exists to prevent:
 * Country rendering under a Conflict name.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { bindConflictD1, contextPanelQueueFor } from './conflictDomainBind';
import { domainEntryFromSearchParams } from '@/lib/map/state/mapDomainEntry';
import { getDictionary } from '@/lib/i18n/dictionaries';

const SRC = join(__dirname, '..', '..', '..');
const read = (...p: string[]): string => readFileSync(join(SRC, ...p), 'utf-8');
/* Comments are stripped so prose about a thing is never mistaken for the thing. */
const executable = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const LABELS = getDictionary('en').map.spatial.conflictQueue;
const entry = (q: string) => domainEntryFromSearchParams(new URLSearchParams(q));

describe('the three cases, through the landed contract', () => {
  it('modern shell + domain=conflict -> BOUND, and the queue reaches the panel', () => {
    const outcome = bindConflictD1(entry('domain=conflict'), 'shell', LABELS);
    expect(outcome.kind).toBe('BOUND');

    const queue = contextPanelQueueFor(outcome);
    expect(queue).not.toBeNull();
    expect(queue?.domain).toBe('CONFLICT');

    /*
      §15 — THE HOLDING LINE IS A RESULT, NEVER AN EMPTY STATE. `emptyIsResult`
      is fixed `true` in `attentionQueue.ts` precisely so a domain cannot
      configure the product's paid output back into an absence.
    */
    expect(`emptyIsResult: ${queue?.emptyIsResult}`).toBe('emptyIsResult: true');

    /* The labels come from the dictionary, not from the lib module. */
    expect(queue?.headerLabel).toBe(LABELS.headerLabel);
  });

  it('modern shell + no domain -> NO_DOMAIN, which is Country unchanged', () => {
    const outcome = bindConflictD1(entry(''), 'shell', LABELS);
    expect(outcome.kind).toBe('NO_DOMAIN');
    /* `null` is what the panel's docblock calls the World/Country configuration. */
    expect(contextPanelQueueFor(outcome)).toBeNull();
  });

  it('legacy shell + domain=conflict -> REFUSED, and it FAILS CLOSED', () => {
    const outcome = bindConflictD1(entry('domain=conflict'), 'legacy', LABELS);
    expect(outcome).toEqual({ kind: 'REFUSED', reason: 'D1_WORKSPACE_NOT_MOUNTED' });

    /*
      THE WHOLE POINT OF THE REFUSAL. A caller that forgets to handle it still
      renders Country — what it actually has — rather than Conflict, which it
      does not. `null` is the value that makes forgetting safe.
    */
    expect(contextPanelQueueFor(outcome)).toBeNull();

    /*
      MAIN'S A-3, REPRODUCED: the refusal outcome contains the string CONFLICT
      zero times. A refusal that still carried the domain's identity would be
      Conflict leaking into a surface that refused to mount it.
    */
    const occurrences = JSON.stringify(outcome).split('CONFLICT').length - 1;
    expect(`CONFLICT appears ${occurrences} times in the refusal`)
      .toBe('CONFLICT appears 0 times in the refusal');
  });

  it('the refusal is the DEFAULT path — an unset flag is legacy', () => {
    /*
      Main's A-5. `resolveMapShellVariant(undefined)` is `legacy`, so at the
      landed flag default the bind takes the refusal arm. The rollback boundary
      is a real boundary, not a formality.
    */
    const { resolveMapShellVariant } = jest.requireActual<
      typeof import('@/lib/map/mapShellFlag')
    >('@/lib/map/mapShellFlag');
    expect(resolveMapShellVariant(undefined)).toBe('legacy');
    expect(bindConflictD1(entry('domain=conflict'), resolveMapShellVariant(undefined), LABELS).kind)
      .toBe('REFUSED');
  });

  it('a foreign domain refuses through the SAME door, not a second one', () => {
    /*
      The other five `SpecialistDomainId` members are reserved identities with
      no accepted D1 presentation. Binding one would claim it.
    */
    for (const q of ['domain=economy', 'domain=humanitarian', 'domain=politics']) {
      const parsed = entry(q);
      if (parsed === null) continue;
      const outcome = bindConflictD1(parsed, 'shell', LABELS);
      expect(`${q}: ${outcome.kind}`).toBe(`${q}: REFUSED`);
    }
  });
});

describe('the wiring carries the value, and carries nothing else', () => {
  const client = executable(read('components', 'map', 'MapPageClient.tsx'));
  const shell = executable(read('components', 'map', 'shell', 'GlobalMapShell.tsx'));
  const panel = executable(read('components', 'map', 'shell', 'ContextSummaryPanel.tsx'));

  it('MapPageClient binds once and passes the result down', () => {
    expect(client).toContain('bindConflictD1(domainEntry, mapVariant, t.spatial.conflictQueue)');
    expect(client).toContain('contextQueue={contextPanelQueueFor(d1)}');
  });

  it('NO BRANCH ON d1.kind CHOOSES A PANEL — Main forbids it, by name', () => {
    /*
      *"Do not add a branch on `d1.kind` to choose a panel."* The helper already
      returns null for both non-BOUND outcomes; a branch here would be a second
      place where the refusal could be got wrong.
    */
    expect(`d1.kind branch present: ${/d1\.kind/.test(client)}`).toBe('d1.kind branch present: false');
    /* POSITIVE CONTROL — the scan does catch such a branch when one exists. */
    expect(/d1\.kind/.test("if (d1.kind === 'BOUND') return <ConflictPanel />;")).toBe(true);
  });

  it('GlobalMapShell defaults to null and forwards it unchanged', () => {
    expect(shell).toContain('contextQueue = null');
    expect(shell).toContain('queue={contextQueue}');
    /*
      AND THE SHELL DOES NOT BIND. Which domain was asked for is a URL fact, and
      this component must not read the URL — the same rule it already states for
      the camera. If it ever imported the bind, it would be deciding rather than
      rendering.
    */
    expect(`shell imports the bind: ${shell.includes('conflictDomainBind')}`)
      .toBe('shell imports the bind: false');
  });

  it('a geography selection under Conflict cannot swap the rail to Country Intelligence', () => {
    /*
      Country/city selections are scopes. The accepted Conflict contract only
      swaps the attention queue for a selected CONFLICT SUBJECT, and no such
      runtime subject exists yet. This guard prevents the measured Alpha defect
      where selecting Sudan/Poland/Rwanda under domain=conflict exposed the
      generic EvidenceSelectionCard and its Load Country Intelligence action.
    */
    expect(shell).toContain(
      "contextQueue !== null && selection !== null && selection.kind !== 'REGION'",
    );
    expect(shell).toContain('selection === null || keepSpecialistQueueForGeography');

    /* Positive control: the generic Country card still exists for /map. */
    expect(shell).toContain('<EvidenceSelectionCard');
  });

  it('the panel was not modified — it already declared, defaulted and gated the prop', () => {
    /* Main's D-1, re-measured here rather than trusted from the README. */
    expect(panel).toMatch(/readonly queue\?: AttentionQueue \| null;/);
    expect(panel).toMatch(/queue = null,/);
    expect(panel).toMatch(/if \(queue !== null\)/);
  });

  it('no layer, no registration, no items — the three things §7 forbids', () => {
    const bind = executable(read('lib', 'map', 'd1', 'conflictDomainBind.ts'));
    for (const forbidden of ['registerSpecialistDomain', 'registeredDomains']) {
      expect(`${forbidden}: ${bind.includes(forbidden) || client.includes(forbidden)}`)
        .toBe(`${forbidden}: false`);
    }
    /*
      NO ITEMS. There is no producer, and an item without an `attentionRank`
      would render the unordered state rather than a list — so the queue this
      bind builds carries none.
    */
    const queue = contextPanelQueueFor(bindConflictD1(entry('domain=conflict'), 'shell', LABELS));
    expect(queue?.items ?? []).toEqual([]);
  });

  it('the flag itself is untouched — it is the rollback boundary', () => {
    /*
      *"Do not touch NEXT_PUBLIC_MAP_SHELL."* This round READ the Alpha value to
      decide what it was shipping into; it did not set one. The literal appears
      only where it already did — the flag module reads it, and the Dockerfile
      declares the build arg.
    */
    expect(`client writes the flag: ${/NEXT_PUBLIC_MAP_SHELL\s*=/.test(client)}`)
      .toBe('client writes the flag: false');
  });
});

describe('the copy says what the product actually did', () => {
  it('the holding line is a result, and never an empty state', () => {
    for (const locale of ['en', 'pl'] as const) {
      const labels = getDictionary(locale).map.spatial.conflictQueue;
      expect(labels.holdingLabel.length).toBeGreaterThan(0);
      for (const forbidden of ['no data', 'brak danych', 'nothing yet', 'coming soon']) {
        expect(`${locale} holding contains "${forbidden}": ${labels.holdingLabel.toLowerCase().includes(forbidden)}`)
          .toBe(`${locale} holding contains "${forbidden}": false`);
      }
    }
  });

  it('orderedBy does NOT name a ranking rule the product did not apply', () => {
    /*
      §6, and it is the sharpest of the three. `MAIN-CONFLICT-RUNTIME-CONTRACT-R1`
      refused MCR-15 (`attentionRank`) — no producer exists — so naming
      "severity, then change recency" here would cite a rule nothing executed.
    */
    /*
      ── THE FIRST VERSION OF THIS GUARD WAS WRONG, AND IN AN INSTRUCTIVE WAY ──

      It banned the substring `rank`, and fired on the English string *"no
      upstream RANKING has run for this domain"* — a sentence that DENIES
      ordering. A blunt substring cannot tell a claim from its negation, and a
      guard that forces true copy to be reworded is worse than no guard: it
      trains the next reader to weaken it.

      What §6 actually forbids is NAMING A RULE. So the ban is on the named
      criteria — the refused MCR-15 rule is "severity, then change recency" —
      and on an `ordered by <criterion>` construction. Saying that nothing ran
      is exactly what this string is for.
    */
    const NAMES_A_RULE = /\b(severity|recency|dotkliwo|aktualno)/i;
    const ORDERED_BY_SOMETHING = /\border(?:ed)?\s+by\s+(?!no\b)\w/i;

    for (const locale of ['en', 'pl'] as const) {
      const { orderedBy } = getDictionary(locale).map.spatial.conflictQueue;
      expect(orderedBy.length).toBeGreaterThan(0);
      expect(`${locale} names a ranking criterion: ${NAMES_A_RULE.test(orderedBy)}`)
        .toBe(`${locale} names a ranking criterion: false`);
      expect(`${locale} claims an ordering was applied: ${ORDERED_BY_SOMETHING.test(orderedBy)}`)
        .toBe(`${locale} claims an ordering was applied: false`);
    }

    /*
      POSITIVE CONTROLS — the guard must catch the sentence the refused MCR-15
      rule would have produced, or it is asserting nothing.
    */
    expect(NAMES_A_RULE.test('Ordered by severity, then change recency.')).toBe(true);
    expect(ORDERED_BY_SOMETHING.test('Ordered by severity, then change recency.')).toBe(true);
    expect(NAMES_A_RULE.test('Uporządkowane według dotkliwości.')).toBe(true);
    /* and it must NOT fire on a denial, which is the defect this replaced */
    expect(ORDERED_BY_SOMETHING.test('Not ordered — no upstream ranking has run.')).toBe(false);
  });

  it('EN and PL both exist and differ — no locale fell back to the other', () => {
    const en = getDictionary('en').map.spatial.conflictQueue;
    const pl = getDictionary('pl').map.spatial.conflictQueue;
    for (const key of ['headerLabel', 'holdingLabel', 'orderedBy'] as const) {
      expect(`${key} differs: ${en[key] !== pl[key]}`).toBe(`${key} differs: true`);
    }
  });
});
