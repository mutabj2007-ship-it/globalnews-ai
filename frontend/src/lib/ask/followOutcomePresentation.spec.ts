import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AskV2FollowedOutcome } from '@/lib/api/askV2Api';
import { followStrings } from './followStrings';
import {
  FOLLOW_OUTCOME_PRESENTATION,
  followOutcomePresentation,
} from './followOutcomePresentation';

/**
 * House rule, and the one this suite broke on its first run: COMMENT-STRIP BEFORE SCANNING.
 * A docblock that names what it forbids ("no amber", "the details attribute moved here") is a
 * match for a prohibition scan, and a suite that reads source text has to read the code.
 */
const code = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

/**
 * CLAUDE DESIGN R3 · D08 — the compact status map.
 *
 * The seven outcomes are listed here literally, on purpose. If the backend union grows, this
 * array stops matching `FOLLOW_OUTCOME_PRESENTATION`'s keys and the suite says so by name,
 * alongside the compile error the `Record` already produces.
 */
const OUTCOMES: readonly AskV2FollowedOutcome[] = [
  'INCOMPLETE_CHECK',
  'INSUFFICIENT_BASELINE',
  'CORRECTION',
  'MATERIAL_CHANGE',
  'NEW_EVIDENCE',
  'UNCHANGED',
  'NO_RELEVANT_UPDATE',
];

describe('D08 · the outcome→presentation map is total', () => {
  it('covers all seven outcomes and nothing else', () => {
    expect(Object.keys(FOLLOW_OUTCOME_PRESENTATION).sort()).toEqual([...OUTCOMES].sort());
    for (const o of OUTCOMES) expect(followOutcomePresentation(o)).toBeDefined();
  });

  it('is frozen, so no caller can repaint one outcome at runtime', () => {
    expect(Object.isFrozen(FOLLOW_OUTCOME_PRESENTATION)).toBe(true);
  });

  it('holds no words: every label and detail comes from followStrings', () => {
    const body = code(readFileSync(join(__dirname, 'followOutcomePresentation.ts'), 'utf8'))
      .split('\n')
      .filter((line) => !line.startsWith('import '))
      .join('\n');
    /* No string literals outside the four tone names — a sentence here would be an untranslated
       sentence, and wording belongs to Claude L. */
    const literals = [...body.matchAll(/'([^']*)'/g)].map((m) => m[1]);
    expect(literals.filter((l) => !['REPORTED', 'SETTLED', 'BASELINE', 'INCOMPLETE'].includes(l)))
      .toEqual([]);
  });
});

describe('D08 · the truth rules the grouping has to keep', () => {
  it('an incomplete check never shares the tone of a completed one', () => {
    /* "an incomplete check never reads as 'nothing changed'". A shared tone would say exactly
       that in colour, under a label that says the opposite in words. */
    expect(followOutcomePresentation('INCOMPLETE_CHECK').tone).toBe('INCOMPLETE');
    expect(followOutcomePresentation('UNCHANGED').tone).toBe('SETTLED');
    expect(followOutcomePresentation('NO_RELEVANT_UPDATE').tone).toBe('SETTLED');
    expect(followOutcomePresentation('INCOMPLETE_CHECK').tone).not.toBe(
      followOutcomePresentation('UNCHANGED').tone,
    );
  });

  it('INSUFFICIENT_BASELINE is distinct from INCOMPLETE_CHECK and from UNCHANGED', () => {
    /* CTO directive 9 Oct 2026, D08. An absent baseline is not a quiet "no change" result, and
       it is not a failed check either. */
    const b = followOutcomePresentation('INSUFFICIENT_BASELINE');
    expect(b.tone).toBe('BASELINE');
    expect(b.tone).not.toBe(followOutcomePresentation('INCOMPLETE_CHECK').tone);
    expect(b.tone).not.toBe(followOutcomePresentation('UNCHANGED').tone);
  });

  it('all seven keep their own label and their own detail: nothing is merged', () => {
    for (const locale of ['en', 'pl'] as const) {
      const s = followStrings(locale);
      const labels = OUTCOMES.map((o) => s.outcome[o]);
      const details = OUTCOMES.map((o) => s.outcomeDetail[o]);
      expect(new Set(labels).size).toBe(OUTCOMES.length);
      expect(new Set(details).size).toBe(OUTCOMES.length);
      for (const t of [...labels, ...details]) expect(t.trim().length).toBeGreaterThan(0);
    }
  });

  it('attention marks what the reader should look at, and is not urgency', () => {
    expect(followOutcomePresentation('NEW_EVIDENCE').attention).toBe(true);
    expect(followOutcomePresentation('MATERIAL_CHANGE').attention).toBe(true);
    expect(followOutcomePresentation('CORRECTION').attention).toBe(true);
    expect(followOutcomePresentation('INCOMPLETE_CHECK').attention).toBe(true);
    /* A completed check that found nothing is not a thing to chase. */
    expect(followOutcomePresentation('UNCHANGED').attention).toBe(false);
    expect(followOutcomePresentation('NO_RELEVANT_UPDATE').attention).toBe(false);
    expect(followOutcomePresentation('INSUFFICIENT_BASELINE').attention).toBe(false);
  });

  it('four tones over seven outcomes — one compact status, not seven competing pills', () => {
    expect(new Set(OUTCOMES.map((o) => followOutcomePresentation(o).tone)).size).toBe(4);
  });
});

describe('D08 · My updates renders the map, the detail and the preserved qualifiers', () => {
  const client = code(
    readFileSync(join(__dirname, '../../components/ask/MyUpdatesClient.tsx'), 'utf8'),
  );

  it('one compact status per row, painted from the map, with the detail sentence under it', () => {
    expect(client).toContain('data-ask-follow-tone={followOutcomePresentation(latestCheck.outcome).tone}');
    expect(client).toContain('{s.outcome[latestCheck.outcome]}');
    expect(client).toContain('{s.outcomeDetail[latestCheck.outcome]}');
    /* The outcome is named ONCE per row: the chip is the details control. */
    expect(client.match(/s\.outcome\[latestCheck\.outcome\]/g)).toHaveLength(1);
    expect(client.match(/data-ask="followed-details"/g)).toHaveLength(1);
  });

  it('the tone→class map is total too, and introduces no new colour', () => {
    expect(client).toContain('Readonly<Record<FollowOutcomeTone, string>>');
    for (const tone of ['REPORTED', 'SETTLED', 'BASELINE', 'INCOMPLETE']) {
      expect(client).toContain(`${tone}: '`);
    }
    /*
      GN-CD-300 §W.4's forbidden amber is asserted tree-wide by claudeDesignFoundation.spec.ts,
      which scans for the literal — including in comments, which is how this lane first tripped
      it. The hex is therefore not written here either. What this asserts is the local rule: an
      incomplete check is not painted as a warning, so no red and no amber utility class.
    */
    expect(client).not.toMatch(/amber|text-red|border-red|bg-red|text-warn|border-warn/);
  });

  it('keeps the PARTIAL_CHECK qualifier and the baseline age, and rewrites no follow semantics', () => {
    expect(client).toContain("data-ask-follow-partial={latestCheck.partial ? 'true' : 'false'}");
    /* The qualifier's own wording and its source list stay where they were authored. */
    expect(client).toContain('s.structuredUnassessed(');
    expect(client).toContain('s.baseline(');
    expect(client).toContain('s.noBaseline');
    expect(client).toContain('s.lastSuccessful(');
    /* Nothing here computes materiality, counts or freshness. */
    expect(client).not.toMatch(/newEvidenceCount|supportedChangeCount|possibleCorrectionCount/);
  });
});
