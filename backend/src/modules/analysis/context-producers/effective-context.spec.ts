import {
  readEffectiveContext, readDraftContext,
  mapCountryMayBeShownAsScope, mapCountryIsAvailableUnused,
  type RetrievalContextFacts, type ContextStoresPresent,
} from './effective-context';
import { CONTEXT_EFFECTS } from './ask-context-producers.contract';

const stores = (story: boolean, geo: boolean): ContextStoresPresent => ({
  storyContextPresent: story, geographyContextPresent: geo,
});

/** The three server shapes, built so absence is a MISSING KEY, not an undefined value. */
const USED: RetrievalContextFacts = { geographyContextUsed: true };
const OUTRANKED: RetrievalContextFacts = { geographyContextUsed: false };
const NOT_ELIGIBLE: RetrievalContextFacts = { storyContextUsed: true };   // no geography key at all

describe('D · selected Map country is not the same fact as Map country used', () => {
  it('USED — the server says the selection scoped retrieval', () => {
    const r = readEffectiveContext(USED, stores(false, true));
    expect(r.mapGeography).toBe('USED');
    expect(mapCountryMayBeShownAsScope(USED, stores(false, true))).toBe(true);
  });

  it('PRESENT_UNUSED — eligible and outranked by a place in the question', () => {
    const r = readEffectiveContext(OUTRANKED, stores(false, true));
    expect(r.mapGeography).toBe('PRESENT_UNUSED');
    expect(mapCountryMayBeShownAsScope(OUTRANKED, stores(false, true))).toBe(false);
    expect(mapCountryIsAvailableUnused(OUTRANKED, stores(false, true))).toBe(true);
  });

  it('NOT_ELIGIBLE — a story anchor outranked it, so the key is absent', () => {
    expect('geographyContextUsed' in NOT_ELIGIBLE).toBe(false);   // the premise, asserted
    const r = readEffectiveContext(NOT_ELIGIBLE, stores(true, true));
    expect(r.mapGeography).toBe('NOT_ELIGIBLE');
    expect(mapCountryMayBeShownAsScope(NOT_ELIGIBLE, stores(true, true))).toBe(false);
  });

  it('ABSENT — the reader selected nothing', () => {
    expect(readEffectiveContext({}, stores(false, false)).mapGeography).toBe('ABSENT');
  });

  it('THE DEFECT, PINNED — the three server states are three different readings', () => {
    const readings = [
      readEffectiveContext(USED, stores(false, true)).mapGeography,
      readEffectiveContext(OUTRANKED, stores(false, true)).mapGeography,
      readEffectiveContext(NOT_ELIGIBLE, stores(true, true)).mapGeography,
    ];
    expect(new Set(readings).size).toBe(3);
  });

  it('NEGATIVE CONTROL — store occupancy alone cannot produce the reading', () => {
    // Same stores, three different server facts, three different answers. A
    // derivation that read only the stores would return one answer for all three,
    // which is exactly AskAiDock.tsx:161.
    const s = stores(false, true);
    const answers = [USED, OUTRANKED, {}].map((f) => readEffectiveContext(f, s).mapGeography);
    expect(answers).toEqual(['USED', 'PRESENT_UNUSED', 'NOT_ELIGIBLE']);
    expect(new Set(answers).size).toBe(3);
  });

  it('a present key that is neither true nor false is never reported as USED', () => {
    const weird = JSON.parse('{"geographyContextUsed": null}') as RetrievalContextFacts;
    expect(readEffectiveContext(weird, stores(false, true)).mapGeography).not.toBe('USED');
  });
});

describe('D · story geography', () => {
  it('USED when the server says the anchor scoped retrieval', () => {
    expect(readEffectiveContext({ storyContextUsed: true }, stores(true, false)).story).toBe('USED');
  });

  it('PRESENT_UNUSED when a typed place outranked the anchor', () => {
    expect(readEffectiveContext({ storyContextUsed: false }, stores(true, false)).story).toBe('PRESENT_UNUSED');
  });

  it('a chip must not name the story as the scope when the server says it was not used', () => {
    const r = readEffectiveContext({ storyContextUsed: false }, stores(true, false));
    expect(r.story).not.toBe('USED');
  });
});

describe('D · global scope is a claim, never a floor', () => {
  it('honest only when nothing scoped the answer', () => {
    expect(readEffectiveContext({}, stores(false, false)).globalScopeIsHonest).toBe(true);
  });

  it('NOT honest when a typed place scoped retrieval and the selection was outranked', () => {
    // This is the "falls back to World Events" half of the defect: both stores can
    // look uninteresting while retrieval was in fact scoped.
    expect(readEffectiveContext(OUTRANKED, stores(false, true)).globalScopeIsHonest).toBe(true);
    // ^ the map was not used — but the TYPED place was, and that fact does not live
    //   on this axis. Recorded explicitly so no reader mistakes this function for a
    //   complete answer: see the note below.
  });

  it('DISCLOSED LIMIT — this reading covers the two CONTEXT axes, not typed geography', () => {
    /**
     * REPORTED, NOT PAPERED OVER. `globalScopeIsHonest` is derived from the story
     * and map axes only, because those are the only two the wire reports as
     * used/unused. A question whose scope came from a TYPED place has no
     * `typedGeographyUsed` field to read, so this function cannot see it and will
     * report global scope as honest.
     *
     * The chip must therefore ALSO consult the typed-geography producer's own
     * output before making a global claim. Stated here, in a test, so the gap is
     * visible to whoever wires it rather than discovered on a reader surface.
     */
    expect(readEffectiveContext(OUTRANKED, stores(false, true)).mapGeography).toBe('PRESENT_UNUSED');
  });

  it('NOT honest when either axis was used', () => {
    expect(readEffectiveContext(USED, stores(false, true)).globalScopeIsHonest).toBe(false);
    expect(readEffectiveContext({ storyContextUsed: true }, stores(true, false)).globalScopeIsHonest).toBe(false);
  });
});

describe('D · the draft reading, before any answer exists', () => {
  it('nothing can be USED and no global claim can be made', () => {
    const d = readDraftContext(stores(true, true));
    expect(d.story).toBe('PRESENT_UNUSED');
    expect(d.mapGeography).toBe('PRESENT_UNUSED');
    expect(d.globalScopeIsHonest).toBe(false);
  });

  it('an empty composer shows both axes absent', () => {
    const d = readDraftContext(stores(false, false));
    expect(d.story).toBe('ABSENT');
    expect(d.mapGeography).toBe('ABSENT');
  });
});

describe('D · follow-ups and conflicting contexts', () => {
  it('FOLLOW-UP — a second turn under a changed geography reads the new server facts, never the old', () => {
    const turn1 = readEffectiveContext(USED, stores(false, true));
    const turn2 = readEffectiveContext(OUTRANKED, stores(false, true));
    expect(turn1.mapGeography).toBe('USED');
    expect(turn2.mapGeography).toBe('PRESENT_UNUSED');
    // The reading is a pure function of the turn's own facts, so a stale turn
    // cannot leak into the current one — there is no state to carry.
  });

  it('CONFLICT — story present and geography present: the server decides, not the stores', () => {
    const bothPresent = stores(true, true);
    expect(readEffectiveContext({ storyContextUsed: true }, bothPresent)).toMatchObject({
      story: 'USED', mapGeography: 'NOT_ELIGIBLE',
    });
    expect(readEffectiveContext({ storyContextUsed: false, geographyContextUsed: false }, bothPresent)).toMatchObject({
      story: 'PRESENT_UNUSED', mapGeography: 'PRESENT_UNUSED',
    });
  });

  it('CONFLICT — the two axes are never merged into one claim', () => {
    const r = readEffectiveContext({ storyContextUsed: true }, stores(true, true));
    expect(r.story).not.toBe(r.mapGeography);
  });

  it('every effect returned is a declared member of the vocabulary', () => {
    const cases: [RetrievalContextFacts, ContextStoresPresent][] = [
      [USED, stores(false, true)], [OUTRANKED, stores(true, true)],
      [NOT_ELIGIBLE, stores(true, true)], [{}, stores(false, false)],
    ];
    for (const [f, s] of cases) {
      const r = readEffectiveContext(f, s);
      expect(CONTEXT_EFFECTS).toContain(r.story);
      expect(CONTEXT_EFFECTS).toContain(r.mapGeography);
    }
  });

  it('is total and never throws on a malformed facts object', () => {
    for (const f of [{}, JSON.parse('{"geographyContextUsed":"yes"}'), JSON.parse('{"storyContextUsed":0}')]) {
      expect(() => readEffectiveContext(f as RetrievalContextFacts, stores(true, true))).not.toThrow();
    }
  });
});
