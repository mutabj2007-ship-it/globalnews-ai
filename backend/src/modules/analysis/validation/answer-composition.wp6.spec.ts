import { assessAnswerComposition } from './answer-composition.util';
import { CASES } from './answer-composition.wp6.fixtures';
import {
  buildPresentationRulesInstruction,
  WP6_PRESENTATION_RULES,
} from '../prompt/presentation-rules.util';
import { buildAnalysisMessages } from '../prompt/build-analysis-prompt.util';

/*
  RETRIEVAL R1 · WP6 — FIXTURE-BY-FIXTURE ACCEPTANCE OF THE COMPOSITION CHECKER.

  Fixtures: the 8 WP6 composition fixtures (T1/wp6-fixtures v1: P-16a, P-16b, P-17a, P-17b, P-08,
  P-09, P-CALC, P-CMP), East Africa's W1–W13 (EA-05), the new P-16c / P-16d / P-17c, and the cargo
  volume-vs-price sentinel. All text is SYNTHETIC (fictitious publishers, .example URLs): no real
  publisher text, no model, no provider.

  For each fixture: a CORRECT reference answer must raise NO finding and must contain the fixture's
  required content (the positive control — a checker that flags nothing would otherwise pass every
  "defect" test vacuously the other way round, and one that flags everything fails here); each
  DEFECTIVE answer must raise exactly the named code (and may raise others).
*/

const BOLD_SENTENCE =
  '**The fire at GOICO Plaza damaged many stalls and traders are waiting for official details from the district.** [ev-goico-en]';

describe('WP6 · composition checker, fixture by fixture', () => {
  it('covers the 8 existing fixtures, EA W1–W13 and the added sentinels', () => {
    const ids = CASES.map((c) => c.id);
    for (const id of ['P-16a', 'P-16b', 'P-17a', 'P-17b', 'P-08', 'P-09', 'P-CALC', 'P-CMP'])
      expect(ids).toContain(id);
    const covered = CASES.flatMap((c) => c.covers).join(' | ');
    for (let w = 1; w <= 13; w += 1) expect(covered).toMatch(new RegExp(`\\bW${w}\\b`));
  });

  describe.each(CASES.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    it('the correct reference answer raises no finding and carries the required content', () => {
      expect(assessAnswerComposition(c.good, c.ctx)).toEqual([]);
      for (const text of c.mustContain ?? []) expect(c.good).toContain(text);
      for (const term of c.mustBold ?? []) expect(c.good).toContain(`**${term}**`);
    });

    it.each(c.bad.map((b) => [b.label, b] as const))('defect "%s" is flagged', (_label, b) => {
      expect(assessAnswerComposition(b.text, c.ctx)).toContain(b.code);
    });
  });

  it('selective emphasis: a fully bold long sentence is flagged; the good answers are not', () => {
    expect(assessAnswerComposition(BOLD_SENTENCE)).toContain('BOLD_OVERUSE');
  });

  it('a rule without its context stays silent (no guessing)', () => {
    expect(
      assessAnswerComposition('Several outlets confirmed the ambush near Brazzaville.'),
    ).toEqual([]);
  });
});

describe('WP6 · presentation rules in the generation prompt', () => {
  const article = {
    id: 'a1',
    title: 'Synthetic headline',
    summary: 'Synthetic summary.',
    url: 'https://synthetic.example/a1',
    sourceId: 'synthetic-wire',
    sourceName: 'Synthetic Wire',
    category: 'world',
    sourcesCount: 1,
    publishedAt: '2026-10-10T08:00:00.000Z',
  } as never;

  it('flag off: the prompt is byte-identical to the base (no block, no extra call)', () => {
    const base = buildAnalysisMessages('What happened?', [article], 1200);
    const off = buildAnalysisMessages(
      'What happened?',
      [article],
      1200,
      undefined,
      'en',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      false,
    );
    expect(off).toEqual(base);
    expect(buildPresentationRulesInstruction(undefined)).toBe('');
  });

  it('flag on: the one block is appended to the system prompt; the user message is unchanged', () => {
    const base = buildAnalysisMessages('What happened?', [article], 1200);
    const on = buildAnalysisMessages(
      'What happened?',
      [article],
      1200,
      undefined,
      'en',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
    );
    expect(on.user).toBe(base.user);
    expect(on.system).toContain(WP6_PRESENTATION_RULES);
    expect(on.system.replace(`\n\n${WP6_PRESENTATION_RULES}\n`, '')).toBe(base.system);
  });

  it('the rules defer to the reader and forbid invented scores, sources and negative claims', () => {
    expect(WP6_PRESENTATION_RULES).toMatch(/reader's own format instructions .* take precedence/u);
    expect(WP6_PRESENTATION_RULES).toMatch(/Never write a confidence score/u);
    expect(WP6_PRESENTATION_RULES).toMatch(/never state that an event did not happen/u);
    expect(WP6_PRESENTATION_RULES).toMatch(/A change in volume is not a change in price/u);
  });
});

describe('WP6 · quotations are exact or absent (QUOTE_NOT_IN_EVIDENCE, CTO R4 §5)', () => {
  const evidenceText = [
    'The district mayor said: "We are still counting the damaged stalls." Traders gathered outside.',
    "Officials described the blaze as 'under control by midnight'.",
  ];

  it('a verbatim quotation (any quote style, case and spacing aside) raises nothing', () => {
    for (const answer of [
      'The mayor said "We are still counting the damaged stalls." [ev-goico-en]',
      'The mayor said “we are still  counting the damaged stalls”. [ev-goico-en]',
      'Officials called the blaze «under control by midnight». [ev-goico-en]',
    ])
      expect(assessAnswerComposition(answer, { evidenceText })).toEqual([]);
  });

  it('an invented or reworded quotation is flagged; paraphrase without quotation marks is not', () => {
    expect(
      assessAnswerComposition('The mayor said "Hundreds of stalls were destroyed." [ev-goico-en]', {
        evidenceText,
      }),
    ).toContain('QUOTE_NOT_IN_EVIDENCE');
    expect(
      assessAnswerComposition(
        'The mayor said “we are counting the stalls that were damaged”. [ev-goico-en]',
        { evidenceText },
      ),
    ).toContain('QUOTE_NOT_IN_EVIDENCE');
    expect(
      assessAnswerComposition(
        'The mayor said the damaged stalls are still being counted. [ev-goico-en]',
        { evidenceText },
      ),
    ).toEqual([]);
  });

  it('short quoted terms and headings are not quotations; without evidence text the rule is silent', () => {
    expect(
      assessAnswerComposition('Traders call it the "new market". [ev-goico-en]', { evidenceText }),
    ).toEqual([]);
    expect(assessAnswerComposition('The mayor said "Hundreds of stalls were destroyed."')).toEqual(
      [],
    );
  });

  it('every reference answer that carries evidence text still raises nothing (no regression)', () => {
    for (const c of CASES.filter((x) => x.ctx?.evidenceText !== undefined))
      expect(assessAnswerComposition(c.good, c.ctx)).not.toContain('QUOTE_NOT_IN_EVIDENCE');
  });
});
