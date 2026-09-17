import { buildCensus, emptinessOf } from './dimension-grounding-census';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * J-2 — AN EMPTY DIMENSION SAYS WHY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CTO ruling: *"Distinguish these two states: model returned no items; model
 * returned candidate items but grounding/validation rejected all of them."*
 *
 * The backend already knew — `validateSourcedClaims` sees the raw candidate
 * array and builds the accepted one — and discarded the difference at the
 * `return`. A reader was shown a zero that quietly implied "the reporting is
 * silent" even when the truth was "the reporting did not support what was
 * drafted".
 *
 * NOTHING HERE ADMITS AN ENTRY. Every grounding rule is untouched and every
 * rejection still happens for exactly the reason it happened before. This
 * records a decision; it does not take one.
 */
describe('J-2 — dimension grounding census', () => {
  describe('THE TWO EMPTY STATES ARE DISTINGUISHED', () => {
    it('nothing generated is NOT the same answer as everything rejected', () => {
      expect(emptinessOf(buildCensus(0, 0))).toBe('NOTHING_GENERATED');
      expect(emptinessOf(buildCensus(4, 0))).toBe('ALL_REJECTED');
    });

    it('a dimension with survivors is simply not empty', () => {
      expect(emptinessOf(buildCensus(4, 2))).toBe('NOT_EMPTY');
      expect(emptinessOf(buildCensus(1, 1))).toBe('NOT_EMPTY');
    });

    it('a partially rejected dimension is NOT reported as empty', () => {
      /*
        The reader has real items; the rejections are diagnostics, not a reason
        to describe the dimension as unanswered.
      */
      const census = buildCensus(5, 1);

      expect(emptinessOf(census)).toBe('NOT_EMPTY');
      expect(census.rejected).toBe(4);
    });
  });

  describe('THE COUNTS ARE ARITHMETIC, NOT JUDGEMENT', () => {
    it('rejected is generated minus accepted', () => {
      expect(buildCensus(6, 2)).toEqual({ generated: 6, accepted: 2, rejected: 4 });
      expect(buildCensus(3, 3)).toEqual({ generated: 3, accepted: 3, rejected: 0 });
      expect(buildCensus(0, 0)).toEqual({ generated: 0, accepted: 0, rejected: 0 });
    });

    it('an impossible accepted count is clamped rather than producing a negative', () => {
      /*
        `accepted` cannot exceed `generated` today because it is built by
        filtering. A future refactor that pushed a synthesised entry would make
        `rejected` negative and silently nonsensical; this makes it visible.
      */
      const census = buildCensus(2, 5);

      expect(census.accepted).toBe(2);
      expect(census.rejected).toBe(0);
    });
  });

  describe('WHAT THIS MUST NOT BECOME', () => {
    it('a census never invents an accepted entry to avoid a zero', () => {
      /* CTO ruling: "Do not fabricate content simply to avoid a zero." */
      expect(buildCensus(7, 0).accepted).toBe(0);
      expect(emptinessOf(buildCensus(7, 0))).toBe('ALL_REJECTED');
    });

    it('the emptiness verdict is derived only from counts, never from content', () => {
      /*
        Two dimensions with identical counts get identical verdicts regardless
        of what they were about — so this can never become a second, hidden
        relevance judgement.
      */
      expect(emptinessOf(buildCensus(3, 0))).toBe(emptinessOf(buildCensus(3, 0)));
    });
  });
});
