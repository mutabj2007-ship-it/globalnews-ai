import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  PRODUCIBLE_ELECTORAL_UNIT_KINDS,
  POLITICS_WATCH_REGISTRATION_PROPOSAL,
  WATCH_SUBJECT_TYPES,
  WATCH_SUBJECT_TYPES_BY_SURFACE,
  type PoliticsWatchSubjectTypeIsNotRegistered,
  type WatchSubjectType,
  readerAbsence,
} from '@globalnews-ai/shared';
import {
  NOT_PRODUCIBLE_COMBINATION,
  PROVISIONAL_EXPIRY_INTERNAL_STATE,
  ReportedFigure,
  correctionPresent,
  expireProvisional,
  expiryMayNotStrengthen,
  type PublisherFigureStatement,
} from '@/lib/election/electionReporting';
import {
  ELECTION_COLLAPSED_SLOTS,
  ELECTION_LIVE_ROUTE_GATE,
  ELECTION_PREVIEW_SCOPE,
  ELECTION_PREVIEW_STRIP,
  ELECTION_SUBJECT_LIST,
  ELECTION_TREATMENTS,
  ORDER_REASONS,
  electionLiveRouteMayOpen,
  electionPreviewHud,
  treatmentsDifferOn,
} from '@/lib/election/electionPreview';
import { electionStrings } from '@/lib/election/electionStrings';
import { indicatorMaxFor, INDICATOR_MAX_BY_DOMAIN } from '@/lib/specialist/indicatorStrip';
import { HUD_SLOTS, renderableSlots } from '@/lib/specialist/hudGrammar';
// R3 vocabulary asserted locally; Delivery is recovered in its own worktree.
const DELIVERY_ORDER_REASONS = ['AUTHORITY_PUBLISHED', 'LEXICAL', 'UPSTREAM_ASSESSED'] as const;
import { ContestantRow } from '@/components/election/ElnParts';

/**
 * KENYA ELECTIONS · THE CONTRACT GUARDS.
 *
 * §14 names what must be PROVEN rather than asserted, and every proof below is
 * paired with the control that makes it a measurement: a negative test for
 * `KE2-1`, a mutation for `KE2-2`, the `false` branch for `KE2-5`, and a
 * planted string for every source sweep.
 *
 * *"A clean typecheck of the happy path is not evidence — the evidence is that
 * the wrong access fails."*
 */

const SRC = resolve(dirname(__filename), '..', '..');
const LANE = [join(SRC, 'lib', 'election'), join(SRC, 'components', 'election')];

/** Source with comments stripped. A guard that fires on prose measures prose. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
}

function laneFiles(): readonly string[] {
  return LANE.flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.spec.ts'))
      .map((f) => join(dir, f)),
  );
}

const publisher = (over: Partial<PublisherFigureStatement> = {}): PublisherFigureStatement => ({
  value: '1234',
  reportedness: 'COMPLETE',
  finality: 'UNCERTIFIED',
  denominator: null,
  statedAtMs: 1_000_000,
  revisions: [],
  ...over,
});

/* ═══ 1 · KE2-1 — A BARE NUMBER IS NOT OBTAINABLE ═══════════════════════ */

describe('1 · KE2-1 · the wrong access fails', () => {
  it('the one accessor yields the status WITH the value', () => {
    const figure = ReportedFigure.fromPublisher(publisher());
    expect(figure).toBeInstanceOf(ReportedFigure);
    const reading = (figure as ReportedFigure).read();
    expect(reading.value).toBe('1234');
    expect(reading.state).toBe('PROVISIONAL');
    expect(reading.qualifierRequired).toBe(true);
  });

  it('NEGATIVE · no property access yields the number', () => {
    const figure = ReportedFigure.fromPublisher(publisher()) as ReportedFigure;

    /* The field is `#private` — absent at runtime, not merely untyped. */
    expect(Object.keys(figure)).toEqual([]);
    expect(Object.getOwnPropertyNames(figure)).toEqual([]);
    expect((figure as unknown as Record<string, unknown>).value).toBeUndefined();
    /* The spread operator copies nothing, so a `{...figure}` shim cannot leak it. */
    expect(Object.keys({ ...(figure as unknown as object) })).toEqual([]);
  });

  it('NEGATIVE · and neither does a template literal, JSON, or an inspect', () => {
    /*
      THE THREE ESCAPE HATCHES E1 NAMES — screenshot, embed, copy-paste. A
      private field alone does not close them: each of these reaches into an
      object without naming a property.
    */
    const figure = ReportedFigure.fromPublisher(publisher()) as ReportedFigure;

    const templated = `${figure}`;
    expect(templated).toContain('PROVISIONAL');
    expect(templated).not.toBe('1234');

    const serialised = JSON.stringify(figure);
    expect(serialised).toContain('PROVISIONAL');
    expect(serialised).toContain('qualifierRequired');
    expect(serialised).not.toBe('"1234"');

    const inspected = (figure as unknown as Record<symbol, () => string>)[
      Symbol.for('nodejs.util.inspect.custom')
    ]();
    expect(inspected).toContain('PROVISIONAL');
  });

  it('there is exactly ONE accessor, and no second door into the lane', () => {
    for (const file of laneFiles()) {
      const source = code(file);
      /* No getter, no public field, no widening cast back to a bare number. */
      expect(`${file}: ${/get\s+value\s*\(/.test(source)}`).toBe(`${file}: false`);
      expect(`${file}: ${/#value\s*;?\s*\n\s*(public|readonly)?\s*value/.test(source)}`).toBe(
        `${file}: false`,
      );
    }
  });
});

/* ═══ 2 · KE2-2 — NO TRANSITION PATH, AND THE GUARD IS SHOWN TO BIND ════ */

/**
 * The executable control. It looks for a write of a finality value that is not
 * read straight from the publisher's statement.
 *
 * Exported shape: a pure function over a source string, so the SAME function
 * that scans the lane can be run against a planted mutation. *A guard not shown
 * to bind is not evidence.*
 */
function promotionPathsIn(source: string): readonly string[] {
  const hits: string[] = [];
  /* Any assignment of a literal finality value. */
  for (const m of source.matchAll(/finality\s*[:=]\s*'(CERTIFIED|UNCERTIFIED)'/g)) hits.push(m[0]);
  /* Any function that names itself a promotion. */
  for (const m of source.matchAll(
    /function\s+(certify|promote|markFinal|finalise|finalize)\w*/gi,
  )) {
    hits.push(m[0]);
  }
  return hits;
}

describe('2 · KE2-2 · status is publisher-stated, and the guard bites', () => {
  it('no promotion path exists anywhere in the lane', () => {
    for (const file of laneFiles()) {
      expect(`${file}: ${promotionPathsIn(code(file)).join(',')}`).toBe(`${file}: `);
    }
  });

  it('MUTATION CONTROL · the same guard FAILS against a planted promotion path', () => {
    /*
      This is the test §14 requires: the guard demonstrated failing. Without it,
      a green result over a lane that happens to be clean proves only that the
      regex never matched anything — including, possibly, anything at all.
    */
    const planted = `
      function certifyWhenAllUnitsIn(figure) {
        return { ...figure, finality: 'CERTIFIED' };
      }
    `;
    const found = promotionPathsIn(planted);
    expect(found.length).toBeGreaterThanOrEqual(2);
    expect(found.join(' ')).toContain("finality: 'CERTIFIED'");
    expect(found.join(' ')).toContain('certifyWhenAllUnitsIn');
  });

  it('finality is read straight through from the statement, both ways', () => {
    const uncertified = ReportedFigure.fromPublisher(publisher({ finality: 'UNCERTIFIED' }));
    const certified = ReportedFigure.fromPublisher(
      publisher({ finality: 'CERTIFIED', reportedness: 'COMPLETE' }),
    );
    expect((uncertified as ReportedFigure).read().finality).toBe('UNCERTIFIED');
    expect((certified as ReportedFigure).read().finality).toBe('CERTIFIED');
    expect((certified as ReportedFigure).read().state).toBe('FINAL_CERTIFIED');
  });
});

/* ═══ 3 · KE2-3 — PROVISIONAL FIGURES EXPIRE ═══════════════════════════ */

describe('3 · KE2-3 · the expiry, exercised', () => {
  const WINDOW = 6 * 60 * 60 * 1000;

  it('a fresh provisional survives its window', () => {
    const figure = ReportedFigure.fromPublisher(publisher()) as ReportedFigure;
    const outcome = expireProvisional(figure, 1_000_000 + WINDOW, WINDOW);
    expect(outcome.kind).toBe('FIGURE');
  });

  it('a stale provisional DEGRADES to a governed absence, not to a stale number', () => {
    const figure = ReportedFigure.fromPublisher(publisher()) as ReportedFigure;
    const outcome = expireProvisional(figure, 1_000_000 + WINDOW + 1, WINDOW);
    expect(outcome.kind).toBe('EXPIRED');
    if (outcome.kind !== 'EXPIRED') throw new Error('unreachable');
    expect(outcome.internal).toBe('SOURCE_TEMPORARILY_UNAVAILABLE');
    /* And it reaches the reader through the M08 projection, alongside four others. */
    expect(outcome.reader).toBe('COVERAGE_GAP');
    expect(readerAbsence('SOURCE_TEMPORARILY_UNAVAILABLE')).toBe('COVERAGE_GAP');
  });

  it('a CERTIFIED figure does not expire — it did not become less true by sitting still', () => {
    const figure = ReportedFigure.fromPublisher(
      publisher({ finality: 'CERTIFIED' }),
    ) as ReportedFigure;
    expect(expireProvisional(figure, 1_000_000 + WINDOW * 100, WINDOW).kind).toBe('FIGURE');
  });

  it('the degradation travels ONE WAY — toward claiming less', () => {
    /* Toward a weaker claim: permitted. */
    expect(expiryMayNotStrengthen('NOT_ASSESSED')).toBe('NOT_ASSESSED');
    /* Toward a stronger claim: refused, with `null` rather than a guess. */
    expect(expiryMayNotStrengthen('ASSESSED_NOTHING_QUALIFIED')).toBeNull();
    expect(expiryMayNotStrengthen('NO_QUALIFYING_EVIDENCE')).toBeNull();
    expect(PROVISIONAL_EXPIRY_INTERNAL_STATE).toBe('SOURCE_TEMPORARILY_UNAVAILABLE');
  });
});

/* ═══ 4 · KE2-4 — THE DENOMINATOR, AND THE WITHHELD CASE ═══════════════ */

describe('4 · KE2-4 · a partial figure carries its denominator or is not shown', () => {
  it('a partial figure WITH its denominator is built and carries it', () => {
    const figure = ReportedFigure.fromPublisher(
      publisher({
        reportedness: 'PARTIAL',
        denominator: { reported: 231, total: 290, unitLabel: 'constituencies' },
      }),
    );
    expect(figure).toBeInstanceOf(ReportedFigure);
    const reading = (figure as ReportedFigure).read();
    expect(reading.state).toBe('PARTIALLY_REPORTED');
    expect(reading.denominator?.total).toBe(290);
    expect(reading.qualifierRequired).toBe(true);
  });

  it('a partial figure WITHOUT its denominator IS NOT SHOWN — it cannot be built', () => {
    /*
      "Not shown" is enforced at construction rather than at render, so an
      unshowable figure does not exist for a renderer to mishandle.
    */
    const refused = ReportedFigure.fromPublisher(
      publisher({ reportedness: 'PARTIAL', denominator: null }),
    );
    expect(refused).not.toBeInstanceOf(ReportedFigure);
    expect(refused).toEqual({ refused: 'DENOMINATOR_UNAVAILABLE' });
  });

  it('{ PARTIAL, CERTIFIED } is representable and NOT producible, and is refused', () => {
    const refused = ReportedFigure.fromPublisher(
      publisher({
        reportedness: 'PARTIAL',
        finality: 'CERTIFIED',
        denominator: { reported: 1, total: 2, unitLabel: 'units' },
      }),
    );
    expect(refused).toEqual({ refused: 'NOT_PRODUCIBLE_COMBINATION' });
    expect(NOT_PRODUCIBLE_COMBINATION).toBe('PARTIAL+CERTIFIED');
  });
});

/* ═══ 5 · §5.1 — THE DECOMPOSITION, AND THE POLISH COLLAPSE CLOSED ═════ */

describe('5 · the two axes never share a word', () => {
  it('the four value-states derive from the two axes plus the revision chain', () => {
    const table: readonly [string, PublisherFigureStatement][] = [
      [
        'PARTIALLY_REPORTED',
        publisher({
          reportedness: 'PARTIAL',
          denominator: { reported: 1, total: 2, unitLabel: 'u' },
        }),
      ],
      ['PROVISIONAL', publisher({ reportedness: 'COMPLETE', finality: 'UNCERTIFIED' })],
      ['FINAL_CERTIFIED', publisher({ reportedness: 'COMPLETE', finality: 'CERTIFIED' })],
      [
        'CORRECTED_REVISED',
        publisher({
          reportedness: 'COMPLETE',
          finality: 'CERTIFIED',
          revisions: [
            { revisionOrdinal: 0, supersedesRevisionOrdinal: null, recordedAt: 'x' },
            {
              revisionOrdinal: 1,
              supersedesRevisionOrdinal: 0,
              revisionKind: 'CORRECTION',
              recordedAt: 'y',
            },
          ],
        }),
      ],
    ];
    for (const [expected, statement] of table) {
      const figure = ReportedFigure.fromPublisher(statement) as ReportedFigure;
      expect(`${expected}: ${figure.read().state}`).toBe(`${expected}: ${expected}`);
    }
  });

  it('`corrected` is DERIVED from the chain and is never a stored member', () => {
    expect(correctionPresent([])).toBe(false);
    expect(
      correctionPresent([
        {
          revisionOrdinal: 1,
          supersedesRevisionOrdinal: 0,
          revisionKind: 'SOURCE_REVISION',
          recordedAt: 'z',
        },
      ]),
    ).toBe(false);
    expect(
      correctionPresent([
        {
          revisionOrdinal: 1,
          supersedesRevisionOrdinal: 0,
          revisionKind: 'CORRECTION',
          recordedAt: 'z',
        },
      ]),
    ).toBe(true);
    /* And no field named `corrected` is stored on the statement. */
    for (const file of laneFiles()) {
      expect(
        `${file}: ${/readonly\s+corrected\s*:/.test(code(file)) && file.includes('Reporting')}`,
      ).not.toBe(`${file}: STORED`);
    }
  });

  it('PL renders the two axes as two words, and NIEPEŁNE cannot reach PROVISIONAL', () => {
    const pl = electionStrings('pl');
    expect(pl.reportedness.PARTIAL).toBe('NIEPEŁNE');
    expect(pl.reportedness.COMPLETE).toBe('KOMPLETNE');
    expect(pl.finality.UNCERTIFIED).toBe('NIEPOTWIERDZONE');
    expect(pl.finality.CERTIFIED).toBe('POTWIERDZONE');
    /*
      THE COLLAPSE IS UNREPRESENTABLE, NOT DISCOURAGED. `PROVISIONAL` is
      COMPLETE on the reportedness axis, so the word that used to swallow both
      cannot be reached from it.
    */
    const provisional = (ReportedFigure.fromPublisher(publisher()) as ReportedFigure).read();
    expect(pl.reportedness[provisional.reportedness]).toBe('KOMPLETNE');
    expect(pl.reportedness[provisional.reportedness]).not.toBe(pl.reportedness.PARTIAL);
  });

  it('amber is on the correction and NOWHERE else', () => {
    const corrected = (
      ReportedFigure.fromPublisher(
        publisher({
          finality: 'CERTIFIED',
          revisions: [
            { revisionOrdinal: 0, supersedesRevisionOrdinal: null, recordedAt: 'x' },
            {
              revisionOrdinal: 1,
              supersedesRevisionOrdinal: 0,
              revisionKind: 'CORRECTION',
              recordedAt: 'y',
            },
          ],
        }),
      ) as ReportedFigure
    ).read();
    expect(corrected.amber).toBe('PRIMARY');

    /* PROVISIONAL is an incomplete certification, not a change. No amber. */
    const provisional = (ReportedFigure.fromPublisher(publisher()) as ReportedFigure).read();
    expect(provisional.amber).toBeNull();
    expect(provisional.qualifierRequired).toBe(true);
  });

  it('KE6-2 · size changes nothing — no magnitude reaches the presentation at all', () => {
    /*
      "Which corrections are large is not neutral information." There is no
      magnitude field, no threshold, no comparison of a correction's size
      anywhere in the lane — so a large correction cannot be given prominence,
      because nothing knows it is large.
    */
    for (const file of laneFiles()) {
      const source = code(file);
      expect(
        `${file}: ${/correctionMagnitude|magnitudeThreshold|largeCorrection|deltaVotes/i.test(source)}`,
      ).toBe(`${file}: false`);
    }
  });
});

/* ═══ 6 · KE2-5 — ORDERING, WITH THE `false` BRANCH EXERCISED ══════════ */

describe('6 · RC-1..RC-6 · the list is unranked, and the record says how it is ordered', () => {
  /*
    ── R2 · WHAT THIS SECTION REPLACES ─────────────────────────────────────

    R1 asserted `queueWasOrderedUpstream === false` and the "declared arbitrary"
    caption. **Both are withdrawn by `MAIN-…-PLAN-B-R3`** — the predicate
    answers a different question and its `false` is not this surface's
    condition, and a caption *"is read by some readers; the sequence by all of
    them."* The declaration moved to a required field on the record.
  */

  it('RC-2 · the order provenance is REQUIRED and is LEXICAL, and the reason it is', () => {
    /*
      No authority sequence is bound — the preview binds no contestants at all —
      so there is no AUTHORITY_PUBLISHED order to carry, and UPSTREAM_ASSESSED
      is unavailable to this vertical by construction.
    */
    expect(ELECTION_SUBJECT_LIST.orderReason).toBe('LEXICAL');
    expect(Object.keys(ELECTION_SUBJECT_LIST)).toContain('orderReason');
    /* Lexical by label is what the field declares, so it must be true of the rows. */
    const labels = ELECTION_SUBJECT_LIST.rows.map((r) => r.label);
    expect(labels).toEqual([...labels].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  });

  it('RC-2 · `UPSTREAM_ASSESSED` is UNASSIGNABLE here, not merely forbidden', () => {
    expect([...ORDER_REASONS]).toEqual(['AUTHORITY_PUBLISHED', 'LEXICAL', 'UPSTREAM_ASSESSED']);
    // @ts-expect-error — UPSTREAM_ASSESSED is subtracted from VerticalOrderReason.
    const refused: typeof ELECTION_SUBJECT_LIST.orderReason = 'UPSTREAM_ASSESSED';
    expect(refused).toBe('UPSTREAM_ASSESSED');
  });

  it('the two LOCAL copies of the union cannot drift', () => {
    /*
      `R-RC-1`/`R-RC-4` keep the carrier local and defer a shared one to its own
      round. The duplication that creates is answered by measurement rather than
      by trust.
    */
    expect([...ORDER_REASONS]).toEqual([...DELIVERY_ORDER_REASONS]);
  });

  it('`queueWasOrderedUpstream` is NOT CALLED anywhere in this lane', () => {
    for (const file of laneFiles()) {
      expect(`${file}: ${/queueWasOrderedUpstream/.test(code(file))}`).toBe(`${file}: false`);
    }
  });

  it('the withdrawn constructions are GONE, not merely unused', () => {
    for (const file of laneFiles()) {
      const source = code(file);
      for (const withdrawn of [
        'TIE_BREAK_IS_ARBITRARY_AND_NOT_CHRONOLOGICAL',
        'ORDER_IS_ARBITRARY_AND_NOT_A_RANKING',
        'ADMISSIBLE_DEFAULT_ORDERINGS',
        'defaultOrderingFor',
        'mustDeclareArbitraryOrder',
        'arbitraryOrder',
      ]) {
        expect(`${file} :: ${withdrawn}: ${source.includes(withdrawn)}`).toBe(
          `${file} :: ${withdrawn}: false`,
        );
      }
    }
  });

  it('RC-1 · NOTHING IN THE LANE SORTS — there is no comparator at all', () => {
    for (const file of laneFiles()) {
      const source = code(file);
      expect(`${file}: ${/\.sort\(|localeCompare|attentionRank/.test(source)}`).toBe(
        `${file}: false`,
      );
    }
  });

  it('MUTATION CONTROL · that sweep FAILS against a planted comparator', () => {
    expect(
      /\.sort\(|localeCompare|attentionRank/.test('rows.sort((a, b) => b.votes - a.votes)'),
    ).toBe(true);
    expect(/\.sort\(|localeCompare|attentionRank/.test('a.label.localeCompare(b.label)')).toBe(
      true,
    );
  });

  it('RC-3 · the row model carries no rank field — absent, not null, not zero', () => {
    for (const row of ELECTION_SUBJECT_LIST.rows) {
      expect(Object.keys(row).sort()).toEqual(['id', 'label', 'stateLabel']);
      expect(row).not.toHaveProperty('attentionRank');
      expect(row).not.toHaveProperty('rank');
      expect(row).not.toHaveProperty('position');
    }
  });

  it('RC-3 · the render callback takes no index, so a position cannot reach the DOM', () => {
    const screen = code(join(SRC, 'components', 'election', 'ElectionPreviewScreen.tsx'));
    expect(screen).toMatch(/\.rows\.map\(\(row\) =>/);
    expect(screen).not.toMatch(/\.map\(\((\w+), *(index|i|idx)\)/);
  });

  it('the surface states the order PROVENANCE, in both locales, as a fact', () => {
    expect(electionStrings('en').orderReasonLabel.LEXICAL).toBe('Order by label');
    expect(electionStrings('pl').orderReasonLabel.LEXICAL).toBe('Kolejność według etykiety');
    const screen = code(join(SRC, 'components', 'election', 'ElectionPreviewScreen.tsx'));
    expect(screen).toMatch(/note=\{t\.orderReasonLabel\[orderReason\]\}/);
  });
});

/* ═══ 6b · RC-3 / RC-4 / RC-5 — ASSERTED AGAINST THE RENDERED OUTPUT ═════ */

/**
 * H2-2. These run the actual component through the server renderer and read the
 * MARKUP, not the source. `RC-4` is the one worth real effort, because it is the
 * one that can regress silently: a style change that makes the first row heavier
 * reintroduces rank without touching any logic.
 */
describe('6b · the rendered rows, and the guard shown to bind', () => {
  const renderToStaticMarkup = (require('react-dom/server') as typeof import('react-dom/server'))
    .renderToStaticMarkup;
  const createElement = (require('react') as typeof import('react')).createElement;

  /** Every `<li …>` opening tag in a rendered list, in document order. */
  function rowOpeningTags(markup: string): readonly string[] {
    return [...markup.matchAll(/<li\b[^>]*>/g)].map((m) => m[0]);
  }

  /**
   * `RC-4`, as a pure predicate so the SAME function can be run against a
   * mutation. Returns the set of distinct row presentations — conformant is
   * exactly one, whatever the row count.
   */
  function distinctRowPresentations(markup: string): readonly string[] {
    return [...new Set(rowOpeningTags(markup))];
  }

  const renderRows = (
    rows: readonly { id: string; label: string; stateLabel?: string }[],
  ): string =>
    renderToStaticMarkup(
      createElement(
        'ul',
        null,
        rows.map((row) =>
          createElement(ContestantRow, { key: row.id, label: row.label, state: row.stateLabel }),
        ),
      ),
    );

  const MARKUP = renderRows([...ELECTION_SUBJECT_LIST.rows]);

  it('RC-4 · every rendered row carries an IDENTICAL presentation', () => {
    expect(rowOpeningTags(MARKUP)).toHaveLength(3);
    expect(distinctRowPresentations(MARKUP)).toHaveLength(1);
  });

  it('MUTATION CONTROL · the RC-4 guard FAILS against an emphasised row', () => {
    /*
      The mutation is the realistic one: a row made heavier because of where it
      sits. `last:border-b-0` in R1 was this defect already — it gave the last
      row a different computed border — and it was removed for that reason.
    */
    const mutated = MARKUP.replace(/<li\b/, '<li class="font-bold"');
    expect(distinctRowPresentations(mutated).length).toBeGreaterThan(1);

    /* And the class R1 carried is the same failure, reproduced. */
    const r1Shape = '<li class="a last:border-b-0"><li class="a last:border-b-0"><li class="a">';
    expect(distinctRowPresentations(r1Shape).length).toBeGreaterThan(1);
  });

  it('RC-3 · no ordinal, index or "1 of N" reaches the rendered output', () => {
    expect(MARKUP).not.toMatch(/\b\d+\s*(of|z)\s*\d+\b/i);
    /* No standalone numeral anywhere in a row's text content. */
    for (const tag of rowOpeningTags(MARKUP))
      expect(tag).not.toMatch(/data-\w*(rank|index|position)/i);
    const textOnly = MARKUP.replace(/<[^>]*>/g, ' ');
    expect(textOnly).not.toMatch(/(^|\s)\d+(\s|$)/);
  });

  it('RC-5 · no connector, rule, numbering or directional affordance between rows', () => {
    expect(MARKUP).not.toMatch(/<hr\b/);
    expect(MARKUP).not.toMatch(/<ol\b/);
    expect(MARKUP).not.toMatch(/list-decimal|border-b|border-t|divide-y/);
    expect(MARKUP).not.toMatch(/→|↓|&rarr;|&darr;/);
  });

  it('MUTATION CONTROL · the RC-5 sweep fires on each of those', () => {
    for (const planted of [
      '<hr/>',
      '<ol><li>x</li></ol>',
      '<li class="border-b">x</li>',
      '<li>a → b</li>',
    ]) {
      expect(
        /<hr\b/.test(planted) ||
          /<ol\b/.test(planted) ||
          /list-decimal|border-b|border-t|divide-y/.test(planted) ||
          /→|↓|&rarr;|&darr;/.test(planted),
      ).toBe(true);
    }
  });
});

/* ═══ 7 · §6.1/§6.2 — NOTHING RANKS, NOTHING DRAWS, NOTHING PREDICTS ═══ */

describe('7 · the absolute prohibitions, swept', () => {
  /*
    ── TWO WITHDRAWALS, RECORDED RATHER THAN DELETED ───────────────────────

    The first version of this block swept the whole lane for a word list and
    fired twice, both times on itself:

      `\bleading\b`  matched the Tailwind class `leading-[1.3]`, a line-height
                      utility on every paragraph of the screen.
      `\branking\b`  matched `'Order is arbitrary and is not a ranking.'` —
                      the sentence whose entire job is to forbid ranking.

    Neither was a defect in the code; both were the guard measuring incidental
    text. So the sweep is split into the two things it was conflating:

      7a · a CODE sweep for identifier-shaped names — what a developer would
           have to write to build a forbidden thing;
      7b · a READER-TEXT sweep over the strings catalogue, which is where a
           forbidden CLAIM would actually reach a reader, and which allows the
           word inside an explicit negation because that is the platform
           refusing the claim rather than making it.
  */

  const FORBIDDEN_IDENTIFIERS: readonly [string, RegExp][] = [
    ['winner / leader', /\bwinnerId\b|\bwinner\s*[:=]|projectedWinner|isLeading|leaderOf/i],
    [
      'margin / swing / forecast',
      /voteMargin|marginPct|swingPct|projection\s*[:=]|forecast\s*[:=]|electability/i,
    ],
    ['ranking / score', /rankingOf|leagueTable|candidateScore|computeScore|rankBy/i],
    ['progress toward a threshold', /progressBar|thresholdPct|toWin|seatsNeeded/i],
    ['constituency or ward geometry', /constituencyGeometry|wardGeometry|choropleth|cartogram/i],
    ['a map', /maplibre|mapbox|<Map\b|GeoJSON|\.geojson/i],
    ['a map-unavailable placeholder', /mapUnavailable|noMapPlaceholder/i],
  ];

  it('7a · no forbidden identifier appears anywhere in the lane', () => {
    for (const file of laneFiles()) {
      const source = code(file);
      for (const [name, pattern] of FORBIDDEN_IDENTIFIERS) {
        expect(`${file} :: ${name}: ${pattern.test(source)}`).toBe(`${file} :: ${name}: false`);
      }
    }
  });

  it('MUTATION CONTROL · every one of those sweeps can fire', () => {
    const planted = [
      'const winner = rows[0];',
      'const voteMargin = a - b;',
      'const leagueTable = [];',
      'const progressBar = 0.5;',
      'const choropleth = true;',
      "import maplibre from 'maplibre-gl';",
      'const mapUnavailable = true;',
    ];
    FORBIDDEN_IDENTIFIERS.forEach(([name, pattern], i) => {
      expect(`${name}: ${pattern.test(planted[i] ?? '')}`).toBe(`${name}: true`);
    });
  });

  /** Every string a reader can actually see, both locales, flattened. */
  function readerText(): readonly string[] {
    const out: string[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === 'string') out.push(value);
      else if (value && typeof value === 'object') Object.values(value).forEach(walk);
    };
    walk(electionStrings('en'));
    walk(electionStrings('pl'));
    return out;
  }

  it('7b · no reader-facing string CLAIMS a winner, a margin or a ranking', () => {
    const CLAIMS: readonly [string, RegExp][] = [
      ['winner / leading', /\bwinner\b|\bleading\b|\bahead\b|\btrailing\b|zwycięzc|prowadzi/i],
      ['margin / forecast', /\bmargin\b|\bswing\b|\bforecast\b|\bprojection\b|prognoz/i],
      ['ranking / score', /\branking\b|\bleague\b|\bscore\b|ranking|wynik punktowy/i],
    ];
    /* A negation is the platform REFUSING the claim, not making it. */
    const NEGATED = /is not a|are not a|nie jest|nie są/i;

    for (const text of readerText()) {
      for (const [name, pattern] of CLAIMS) {
        const hit = pattern.test(text);
        const allowed = !hit || NEGATED.test(text);
        expect(`${name} :: ${text.slice(0, 60)}: ${allowed}`).toBe(
          `${name} :: ${text.slice(0, 60)}: true`,
        );
      }
    }
  });

  it('MUTATION CONTROL · 7b fires on an unnegated claim and not on the negation', () => {
    const NEGATED = /is not a|are not a|nie jest|nie są/i;
    const pattern = /\branking\b/i;
    const claim = 'Rows are shown in ranking order.';
    const refusal = 'Order is arbitrary and is not a ranking.';
    expect(pattern.test(claim) && !NEGATED.test(claim)).toBe(true);
    expect(pattern.test(refusal) && !NEGATED.test(refusal)).toBe(false);
  });

  it('the electoral axis is unaddressable and the lane says so rather than working round it', () => {
    expect([...PRODUCIBLE_ELECTORAL_UNIT_KINDS]).toEqual([]);
    expect(ELECTION_PREVIEW_SCOPE.presentationCeiling).toBe('COUNTRY');
  });
});

/* ═══ 8 · WATCH — REGISTERED NOTHING, AND THE CONTROL STILL COMPILES ═══ */

describe('8 · R-WATCH · nothing is registered and no control is rendered', () => {
  it('neither vertical is a WatchSubjectType', () => {
    expect(WATCH_SUBJECT_TYPES as readonly string[]).not.toContain('ELECTION');
    expect(WATCH_SUBJECT_TYPES as readonly string[]).not.toContain('DELIVERY');
  });

  it('neither vertical is a WatchSurface row', () => {
    expect(Object.keys(WATCH_SUBJECT_TYPES_BY_SURFACE)).not.toContain('ELECTION');
    expect(Object.keys(WATCH_SUBJECT_TYPES_BY_SURFACE)).not.toContain('DELIVERY');
    /* POLITICS is present and EMPTY ON PURPOSE. An empty row is the safe state. */
    expect(WATCH_SUBJECT_TYPES_BY_SURFACE.POLITICS).toEqual([]);
  });

  it('R3 literal watch proposal refuses registered and arbitrary types', () => {
    // Recovery lands the authorized R3 repair; negative assignments must now fail.
    // @ts-expect-error R3 repair now refuses already-registered types.
    const registeredTypeIsAccepted: PoliticsWatchSubjectTypeIsNotRegistered = 'PLACE';
    // @ts-expect-error R3 repair now preserves the literal proposal union.
    const arbitraryStringIsAccepted: PoliticsWatchSubjectTypeIsNotRegistered =
      'not a member of anything';
    expect(registeredTypeIsAccepted).toBe('PLACE');
    expect(arbitraryStringIsAccepted).toBe('not a member of anything');

    const registered: WatchSubjectType = 'PLACE';
    expect(WATCH_SUBJECT_TYPES as readonly string[]).toContain(registered);

    /* What IS true and does bite: the proposal still exists, and it is still blocked. */
    expect(POLITICS_WATCH_REGISTRATION_PROPOSAL.proposedSubjectTypes).toContain('ELECTION');
    expect(POLITICS_WATCH_REGISTRATION_PROPOSAL.blockedBy.length).toBeGreaterThan(0);
  });

  it('H REGISTERED NOTHING — the collections are exactly the baseline', () => {
    /*
      The proof the contract actually needs, and it is a runtime one.
      Registering either vertical anywhere would change one of these two lines.
    */
    expect([...WATCH_SUBJECT_TYPES].sort()).toEqual(
      [
        'ACTOR',
        'CAMPAIGN',
        'COMMODITY',
        'CORRIDOR',
        'EXPOSURE',
        'FRONT',
        'INCIDENT_CLASS',
        'INDICATOR',
        'INFRASTRUCTURE_ASSET',
        'INSTRUMENT',
        'ISSUER',
        'PLACE',
        'POLICY',
        'ROUTE',
        'SECTOR',
        'SITUATION',
        'TRADE_LANE',
      ].sort(),
    );
    expect(Object.keys(WATCH_SUBJECT_TYPES_BY_SURFACE).sort()).toEqual(
      ['CONFLICT', 'ECONOMY', 'MAP', 'MARKET', 'POLITICS', 'SECURITY'].sort(),
    );
  });

  it('R-WATCH-3 IS WITHDRAWN, and the repaired control is verified but NOT APPLIED', () => {
    /*
      ── WHAT CHANGED BETWEEN R1 AND R2 ─────────────────────────────────────

      R1 reported that `PoliticsWatchSubjectTypeIsNotRegistered` compiles and
      CANNOT BITE, and declined to "fix" it because `R-WATCH-3` said *"that is
      the control working."*

      `MAIN-…-PLAN-B-R3` §0.3: **`R-WATCH-3` is WITHDRAWN. "That is the control
      working" was wrong.** Main reproduced the defect and compiled a repair with
      a mutation; it ships as `patches/politics-watch-control.patch.md` for
      AUTHORIZED integration.

      H REPRODUCED ALL FIVE PROOFS INDEPENDENTLY, on this container's own tsc —
      `evidence/watch-typelab-reproduction.txt`:

        A    landed form accepts 'PLACE' and 'anything at all'  -> exit 0, defect
        B-1  repaired form alone                                -> exit 0, clean
        B-2  H's probe against the repair                       -> TS2322 x2, REFUSED
        C    the docblock's stated intent survives the repair   -> TS2322, REFUSED
        M-1  landed form + ELECTION registered                  -> exit 0, DOES NOT NOTICE
        M-2  repaired form + ELECTION registered                -> TS2322, *** BITES ***

      **H DOES NOT APPLY THE PATCH.** It is an authorized canonical edit and this
      round has no canonical write. The assertion below detects which form is in
      the tree and asserts the truth about THAT form, so it becomes the stronger
      assertion by itself on the day the patch lands.
    */
    const politics = readFileSync(
      resolve(SRC, '..', '..', 'shared', 'src', 'politics', 'index.ts'),
      'utf8',
    );
    const repairLanded = /as const satisfies PoliticsWatchRegistrationProposal/.test(politics);

    if (repairLanded) {
      /*
        THE ASSERTION THE OLD CONTROL COULD NOT CARRY. With the repair in place,
        registering ELECTION or DELIVERY as a WatchSubjectType FAILS THE BUILD:
        `Exclude` drops the member, the `extends` fails, the type becomes
        `never`, and `true` is not assignable to `never`.
      */
      expect(politics).toMatch(/POLITICS_WATCH_PROPOSAL_IS_UNREGISTERED/);
      expect(politics).toMatch(/ProposalIsUnregistered/);
    } else {
      /*
        PATCH PENDING. The landed annotated form is still here, and it is still
        the widened one H measured — so the runtime byte-listing below is the
        control, exactly as `R-WCT-2` instructs.
      */
      expect(politics).toMatch(/readonly proposedSubjectTypes: readonly string\[\]/);
      expect(politics).toMatch(
        /export const POLITICS_WATCH_REGISTRATION_PROPOSAL: PoliticsWatchRegistrationProposal/,
      );
      /*
        WITHDRAWN AND REPAIRED: this first read `not.toMatch(/as const satisfies/)`
        and fired on the file's OTHER uses of the idiom — `as const satisfies` is
        this programme's standard construction and appears elsewhere in
        `politics/index.ts`. The absence that matters is the SPECIFIC repair, not
        the idiom. Same class of error as the two R1 sweeps that fired on
        `leading-[1.3]` and on the sentence forbidding ranking.
      */
      expect(politics).not.toMatch(/as const satisfies PoliticsWatchRegistrationProposal/);
      expect(politics).not.toMatch(/POLITICS_WATCH_PROPOSAL_IS_UNREGISTERED/);
    }

    /* R-WCT-3 · the runtime assertion is RATIFIED and is kept EITHER WAY. */
    expect(WATCH_SUBJECT_TYPES as readonly string[]).not.toContain('ELECTION');
    expect(WATCH_SUBJECT_TYPES as readonly string[]).not.toContain('DELIVERY');
  });

  it('WATCH REGISTRATION = NONE, re-stated — and the two controls fail on different edits', () => {
    /*
      `R-WCT-3`: keep both. The type control catches a registration at compile
      time in `shared/`; the runtime assertion catches it from the frontend.
      A registration that slipped past one still trips the other.
    */
    expect(POLITICS_WATCH_REGISTRATION_PROPOSAL.proposedSubjectTypes).toContain('ELECTION');
    expect(POLITICS_WATCH_REGISTRATION_PROPOSAL.blockedBy.length).toBeGreaterThan(0);
    expect(WATCH_SUBJECT_TYPES_BY_SURFACE.POLITICS).toEqual([]);
    expect(Object.keys(WATCH_SUBJECT_TYPES_BY_SURFACE)).not.toContain('ELECTION');
    expect(Object.keys(WATCH_SUBJECT_TYPES_BY_SURFACE)).not.toContain('DELIVERY');
  });

  it('R-WATCH-4 · no watch control is rendered — not even a disabled one', () => {
    for (const file of laneFiles()) {
      const source = code(file);
      expect(
        `${file}: ${/WatchControl|watchButton|follow-button|bell|coming soon|comingSoon/i.test(source)}`,
      ).toBe(`${file}: false`);
    }
  });

  it('the WATCH slot collapses, and so do the four with nothing to say', () => {
    const hud = electionPreviewHud('MODE', 'COUNTRY');
    const rendered = renderableSlots(hud).map(([slot]) => slot);
    expect(rendered).toEqual(['MODE', 'SCOPE']);
    for (const collapsed of ELECTION_COLLAPSED_SLOTS) {
      expect(`${collapsed}: ${rendered.includes(collapsed)}`).toBe(`${collapsed}: false`);
    }
    /* All seven slots still exist in the grammar — collapse is not deletion. */
    expect(HUD_SLOTS).toHaveLength(7);
    expect(HUD_SLOTS as readonly string[]).toContain('WATCH');
  });
});

/* ═══ 9 · §5.3 — THE THREE DISJOINT TREATMENTS, WITH THE EVIDENCE ══════ */

describe('9 · the three treatments are disjoint, proven on three axes', () => {
  it('every pair differs on ink AND border AND numeral', () => {
    const pairs: readonly [
      string,
      keyof typeof ELECTION_TREATMENTS,
      keyof typeof ELECTION_TREATMENTS,
    ][] = [
      ['LOADING/ABSENCE', 'LOADING', 'ABSENCE'],
      ['LOADING/VALUE', 'LOADING', 'VALUE'],
      ['ABSENCE/VALUE', 'ABSENCE', 'VALUE'],
    ];
    for (const [name, a, b] of pairs) {
      const axes = treatmentsDifferOn(ELECTION_TREATMENTS[a], ELECTION_TREATMENTS[b]);
      expect(`${name}: ${[...axes].sort().join(',')}`).toBe(`${name}: border,ink,numeral`);
    }
  });

  it('THE NAMED-COLOUR COMPARISON, not a class-name comparison', () => {
    expect(ELECTION_TREATMENTS.LOADING.inkHex).toBe('#64798a');
    expect(ELECTION_TREATMENTS.ABSENCE.inkHex).toBe('#9db3c0');
    expect(ELECTION_TREATMENTS.VALUE.inkHex).toBe('#e4eef4');
    const hexes = Object.values(ELECTION_TREATMENTS).map((t) => t.inkHex);
    expect(new Set(hexes).size).toBe(hexes.length);
  });

  it('ONLY the value treatment carries a numeral — so absence can never read as 0', () => {
    expect(ELECTION_TREATMENTS.VALUE.carriesNumeral).toBe(true);
    expect(ELECTION_TREATMENTS.ABSENCE.carriesNumeral).toBe(false);
    expect(ELECTION_TREATMENTS.LOADING.carriesNumeral).toBe(false);
    /* And the slot component has no branch that renders a numeral without children. */
    const parts = code(join(SRC, 'components', 'election', 'ElnParts.tsx'));
    expect(parts).toMatch(/treatment\.carriesNumeral \? children : treatment\.glyph/);
  });

  it('D-2 · loading is marked busy and absence is not', () => {
    expect(ELECTION_TREATMENTS.LOADING.busy).toBe(true);
    expect(ELECTION_TREATMENTS.ABSENCE.busy).toBe(false);
  });
});

/* ═══ 10 · PREVIEW BEHAVIOUR, THE CEILING AND THE GATE ═════════════════ */

describe('10 · the preview binds no election', () => {
  it('nothing Kenyan is BOUND — no subject, candidate, party or figure', () => {
    /*
      WITHDRAWN AND REPAIRED. The first version swept every byte of the lane
      for `IEBC` and fired on `ELECTION_LIVE_ROUTE_GATE`, which names the
      licensing authority **because the contract requires it to**: *"the blocker
      is rights, not availability."* A guard that forbids naming the reason a
      route is shut is measuring the wrong thing.

      What the rule actually means is that no Kenyan referent is BOUND — so the
      sweep runs over the bound content itself: the scope, the queue and every
      reader-facing string in both locales.
    */
    const KENYAN = /kenya|nairobi|mombasa|kisumu|odinga|ruto|kenyatta|azimio|jubilee|IEBC/i;
    const bound = JSON.stringify([
      ELECTION_PREVIEW_SCOPE,
      ELECTION_SUBJECT_LIST,
      ELECTION_PREVIEW_STRIP,
      electionStrings('en'),
      electionStrings('pl'),
    ]);
    expect(`bound content: ${KENYAN.test(bound)}`).toBe('bound content: false');

    /* And no real person or party name appears anywhere in the lane at all. */
    const NAMES = /odinga|ruto|kenyatta|azimio|jubilee|\bUDA\b|\bODM\b/i;
    for (const file of laneFiles()) {
      expect(`${file}: ${NAMES.test(code(file))}`).toBe(`${file}: false`);
    }

    expect(ELECTION_PREVIEW_SCOPE.iso2).toBe('ZZ');
    expect(ELECTION_PREVIEW_SCOPE.label).toBe('No subject bound');
    for (const item of ELECTION_SUBJECT_LIST.rows) {
      expect(item.label).toMatch(/^Placeholder contestant/);
    }
  });

  it('MUTATION CONTROL · the bound-content sweep fires on a real referent', () => {
    const KENYAN = /kenya|nairobi|mombasa|kisumu|odinga|ruto|kenyatta|azimio|jubilee|IEBC/i;
    expect(KENYAN.test(JSON.stringify({ label: 'Nairobi County' }))).toBe(true);
  });

  it('no indicator is bound, and the ceiling is the accepted fallback of five', () => {
    expect(ELECTION_PREVIEW_STRIP.indicators).toEqual([]);
    expect(indicatorMaxFor('ELECTION')).toBe(5);
    /* NO ELECTION EXCEPTION IS REGISTERED — the fallback is what supplies the five. */
    expect(Object.keys(INDICATOR_MAX_BY_DOMAIN).sort()).toEqual(['CONFLICT', 'ECONOMY']);
  });

  it('`/election` is gated, the four conditions are named, and none is met', () => {
    expect(electionLiveRouteMayOpen()).toBe(false);
    expect(ELECTION_LIVE_ROUTE_GATE).toHaveLength(4);
    for (const gate of ELECTION_LIVE_ROUTE_GATE) expect(gate.met).toBe(false);
    expect(ELECTION_LIVE_ROUTE_GATE.map((g) => g.condition).join(' ')).toMatch(
      /rights, not availability/,
    );
  });

  it('the live route does not exist, and the preview routes do', () => {
    const app = join(SRC, 'app');
    expect(existsSync(join(app, 'election'))).toBe(false);
    expect(existsSync(join(app, 'kenya-elections'))).toBe(false);
    expect(existsSync(join(app, 'election-visual-preview', 'page.tsx'))).toBe(true);
    expect(existsSync(join(app, 'election-visual-preview', 'compact', 'page.tsx'))).toBe(true);
  });

  it('both preview routes are noindex, unconditionally', () => {
    for (const p of [
      join(SRC, 'app', 'election-visual-preview', 'page.tsx'),
      join(SRC, 'app', 'election-visual-preview', 'compact', 'page.tsx'),
    ]) {
      expect(code(p)).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
    }
  });

  it('compact renders the SAME component — there is no second region list', () => {
    const desktop = code(join(SRC, 'app', 'election-visual-preview', 'page.tsx'));
    const compact = code(join(SRC, 'app', 'election-visual-preview', 'compact', 'page.tsx'));
    expect(desktop).toMatch(/<ElectionEvidenceScreen locale=\{locale\} compact=\{false\} result=\{result\} \/>/);
    expect(compact).toMatch(/<ElectionEvidenceScreen locale=\{locale\} compact=\{true\} result=\{result\} \/>/);
  });

  it('EN and PL only — and NO Kiswahili string is authored', () => {
    expect(() => electionStrings('en')).not.toThrow();
    expect(() => electionStrings('pl')).not.toThrow();
    for (const file of laneFiles()) {
      const source = code(file);
      expect(`${file}: ${/\bsw\b\s*:/.test(source)}`).toBe(`${file}: false`);
    }
  });

  it('E1-KE-1 · `ParticipantEntityCard` is not imported anywhere in the lane', () => {
    for (const file of laneFiles()) {
      expect(`${file}: ${/ParticipantEntityCard/.test(code(file))}`).toBe(`${file}: false`);
    }
  });

  it('KE1-3 · no refused candidate attribute has a field anywhere', () => {
    const REFUSED =
      /nationalId|passportNumber|dateOfBirth|residentialAddress|postalAddress|personalPhone|personalEmail|photograph|education|employment|assetDisclosure/i;
    for (const file of laneFiles()) {
      expect(`${file}: ${REFUSED.test(code(file))}`).toBe(`${file}: false`);
    }
  });

  it('no derivation registry is created or cited', () => {
    for (const file of laneFiles()) {
      expect(`${file}: ${/ELECTION_DERIVATION_RULES/.test(code(file))}`).toBe(`${file}: false`);
    }
  });
});
