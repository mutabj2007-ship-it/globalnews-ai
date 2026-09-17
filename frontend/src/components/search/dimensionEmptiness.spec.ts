import { readFileSync } from 'fs';
import { join } from 'path';

import type { AnalysisApiResponse } from '@globalnews-ai/shared';

import {
  dimensionEmptyLabelKey,
  dimensionEmptyReason,
  dimensionFieldFor,
} from './dimensionEmptiness';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * J-2 — THE READER IS TOLD WHY, NOT SHOWN A COUNT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling: *"Do not expose internal implementation jargon to normal readers.
 * The user-facing meaning should remain truthful … Do not fabricate content
 * simply to avoid a zero."*
 */

const withCensus = (
  grounding: Record<string, { generated: number; accepted: number; rejected: number }> | undefined,
): AnalysisApiResponse =>
  ({
    analysis: grounding === undefined ? {} : { dimensionGrounding: grounding },
  }) as unknown as AnalysisApiResponse;

describe('J-2 — the empty-dimension sentence', () => {
  describe('EACH DIMENSION READS ITS OWN FIELD', () => {
    it('maps every rendered dimension to the response field it is built from', () => {
      expect(dimensionFieldFor('why-this-matters')).toBe('relevance');
      expect(dimensionFieldFor('who-is-affected')).toBe('affectedParties');
      expect(dimensionFieldFor('immediate-effects')).toBe('immediateImpacts');
      expect(dimensionFieldFor('key-facts')).toBe('keyFacts');
    });

    it('a dimension with no backing field has no reason to give', () => {
      /* `brief` is prose, not a list; `insufficient-evidence` is itself the gap. */
      expect(dimensionFieldFor('brief')).toBeUndefined();
      expect(dimensionEmptyReason(withCensus({}), 'brief')).toBe('UNKNOWN');
    });
  });

  describe('THE TWO EMPTY STATES PRODUCE DIFFERENT SENTENCES', () => {
    it('all rejected reads as "not supported by the evidence"', () => {
      const response = withCensus({ relevance: { generated: 3, accepted: 0, rejected: 3 } });

      expect(dimensionEmptyReason(response, 'why-this-matters')).toBe('ALL_REJECTED');
      expect(dimensionEmptyLabelKey('ALL_REJECTED')).toBe('noGroundedItemsInDimension');
    });

    it('nothing generated reads as "the evidence reports nothing"', () => {
      const response = withCensus({ relevance: { generated: 0, accepted: 0, rejected: 0 } });

      expect(dimensionEmptyReason(response, 'why-this-matters')).toBe('NOTHING_GENERATED');
      expect(dimensionEmptyLabelKey('NOTHING_GENERATED')).toBe('nothingReportedInDimension');
    });

    it('the two sentences are not the same key — the collapse is gone', () => {
      expect(dimensionEmptyLabelKey('ALL_REJECTED')).not.toBe(
        dimensionEmptyLabelKey('NOTHING_GENERATED'),
      );
    });
  });

  describe('A NON-EMPTY DIMENSION GETS NO SENTENCE AT ALL', () => {
    it('any surviving entry means there is nothing to explain', () => {
      const response = withCensus({ keyFacts: { generated: 5, accepted: 2, rejected: 3 } });

      expect(dimensionEmptyReason(response, 'key-facts')).toBe('UNKNOWN');
    });
  });

  describe('ABSENT COUNTS FALL BACK RATHER THAN GUESS', () => {
    it('a result with no census at all keeps the original generic wording', () => {
      expect(dimensionEmptyReason(withCensus(undefined), 'key-facts')).toBe('UNKNOWN');
      expect(dimensionEmptyLabelKey('UNKNOWN')).toBe('noItemsInDimension');
    });

    it('a census that omits THIS dimension also falls back', () => {
      const response = withCensus({ keyFacts: { generated: 1, accepted: 1, rejected: 0 } });

      expect(dimensionEmptyReason(response, 'immediate-effects')).toBe('UNKNOWN');
    });

    it('a null analysis does not throw', () => {
      const response = { analysis: null } as unknown as AnalysisApiResponse;

      expect(dimensionEmptyReason(response, 'key-facts')).toBe('UNKNOWN');
    });
  });

  describe('NO COUNT EVER REACHES THE READER', () => {
    it('the function returns a dictionary KEY, never a number or a rendered string', () => {
      const keys = (['ALL_REJECTED', 'NOTHING_GENERATED', 'UNKNOWN'] as const).map(
        dimensionEmptyLabelKey,
      );

      for (const key of keys) {
        expect(key).toMatch(/^[a-zA-Z]+$/);
        expect(key).not.toMatch(/\d/);
      }
    });

    it('the label keys exist in BOTH dictionaries', () => {
      /* eslint-disable @typescript-eslint/no-var-requires */
      const fs = require('fs') as typeof import('fs');
      const path = require('path') as typeof import('path');
      /* eslint-enable @typescript-eslint/no-var-requires */

      for (const dict of ['en.ts', 'pl.ts']) {
        const source = fs.readFileSync(
          path.join(__dirname, '..', '..', 'lib', 'i18n', 'dictionaries', dict),
          'utf-8',
        );

        expect(source).toContain('noGroundedItemsInDimension:');
        expect(source).toContain('nothingReportedInDimension:');
      }
    });
  });
});

/**
 * ── THE WIRING GUARANTEE ──────────────────────────────────────────────────
 *
 * Added after a near-miss worth recording: an earlier revision landed the
 * helper, the dictionaries and the backend census, and every test above passed
 * — while `AnalysisWorkspace` still rendered the generic line, because a patch
 * failed at its anchor and only the import was applied.
 *
 * A helper nothing calls is not a fix. These assertions read the real component
 * so the two cannot pass independently again.
 */
describe('J-2 — the workspace actually uses the reason', () => {
  const workspace = readFileSync(
    join(__dirname, 'AnalysisWorkspace.tsx'),
    'utf-8',
  ).replace(/\/\*[\s\S]*?\*\//g, '');

  it('derives the label key from the active dimension', () => {
    expect(workspace).toContain('const emptyDimensionLabelKey = dimensionEmptyLabelKey(');
    expect(workspace).toContain('dimensionEmptyReason(response, activeDimension),');
  });

  it('the dimension panel renders the derived key, not the generic label', () => {
    const panel = workspace.slice(
      workspace.indexOf('font-gn-mono text-gn-hud-meta uppercase text-gn-hud-faint'),
    );

    expect(panel.slice(0, 200)).toContain('{t[emptyDimensionLabelKey]}');
  });

  it('the generic sub-view empty state renders it too', () => {
    expect(workspace).toContain(
      'if (entries.length === 0) return <EmptySubView label={t[emptyDimensionLabelKey]} />;',
    );
  });

  it('agreement and difference sub-views KEEP the generic line — they carry no census', () => {
    /*
      Only the four census-backed dimensions have a reason to give. Wiring the
      derived key into these would assert a cause the backend never measured.
    */
    expect(workspace).toContain('if (differenceGroups.length === 0) return <EmptySubView label={t.noItemsInDimension} />;');
  });
});
