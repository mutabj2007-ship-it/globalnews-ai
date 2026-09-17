import { FEED_SOURCES, resolveActiveFeedSources } from './feed-source-registry';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * B5-E — PROVIDER DORMANCY, AND THE RIGHTS GATE THAT DOES NOT EXIST YET
 * ════════════════════════════════════════════════════════════════════════════
 *
 * B5 activates no provider. These assertions hold that true, and record the
 * measured shape of the gap the future contract has to close.
 *
 * ── PROVIDER-RIGHTS-ACTIVATION-GATE-1 — RECORDED, NOT IMPLEMENTED ────────
 *
 * The ruling is that activation must never be controlled solely by registry
 * presence, transport success, or an `enabled` boolean, and must require an
 * explicit governed RIGHTS-CLEARED state.
 *
 * MEASURED HERE: that gate does not exist today. `resolveActiveFeedSources`
 * turns a source on when its id appears in the `RSS_FEED_SOURCES` allowlist,
 * and consults nothing about rights. The registry is honest about what it is —
 * an id allowlist with no wildcard, which is a good deployment control — but an
 * id allowlist is not a rights decision, and nothing in this file can tell the
 * difference between a source that MAY run and one that merely CAN.
 *
 * The test below demonstrates that rather than asserting it in prose, so the
 * gap is visible as behaviour. Implementing the gate is explicitly out of scope
 * for B5; this is the record that it is still open.
 *
 * ── THE TWO NAMED SOURCES ARE PRESERVED, NOT DELETED ─────────────────────
 *
 * G R10 places `feed:standardmedia-ke` and the Wirtualna Polska entry under
 * ACTIVATION PROHIBITED on current published terms. The instruction is to keep
 * both in the registry and history. Deleting them would destroy the provenance
 * that records WHY they are prohibited, and the next person to find the feed
 * would re-add it with no memory of the terms.
 */
describe('B5-E · every feed source ships disabled', () => {
  it('no registry entry is enabled', () => {
    const enabled = FEED_SOURCES.filter((s) => s.enabled).map((s) => s.sourceId);

    expect(enabled).toEqual([]);
  });

  it('and with no override, nothing resolves active', () => {
    expect(resolveActiveFeedSources(FEED_SOURCES, undefined).sources).toEqual([]);
    expect(resolveActiveFeedSources(FEED_SOURCES, '').sources).toEqual([]);
  });
});

describe('B5-E · the rights-prohibited sources are PRESERVED and disabled', () => {
  const PROHIBITED = ['feed:standardmedia-ke', 'feed:wp-pl'];

  it('both entries are still present in the registry', () => {
    /*
      PRESENCE IS THE POINT. The provenance note and verifiedAt on each entry
      are the record of what was measured and when; deleting the entry would
      delete the reason it must not run, and the feed would be rediscovered
      later by somebody with no memory of the terms.
    */
    for (const id of PROHIBITED) {
      expect(FEED_SOURCES.find((s) => s.sourceId === id)).toBeDefined();
    }
  });

  it('and both are disabled in the shipped state', () => {
    for (const id of PROHIBITED) {
      expect(FEED_SOURCES.find((s) => s.sourceId === id)?.enabled).toBe(false);
    }
  });

  it('each still carries its provenance, which is what makes the prohibition auditable', () => {
    for (const id of PROHIBITED) {
      const entry = FEED_SOURCES.find((s) => s.sourceId === id);

      expect(entry?.provenanceNote?.length ?? 0).toBeGreaterThan(0);
      expect(entry?.verifiedAt?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('B5-E · PROVIDER-RIGHTS-ACTIVATION-GATE-1 is OPEN — demonstrated, not asserted', () => {
  it('RECORDED GAP — an id in the allowlist activates a rights-prohibited source today', () => {
    /*
      THIS TEST DOCUMENTS A GAP AND EXPECTS THE CURRENT BEHAVIOUR. It is not a
      claim that the behaviour is correct.

      Naming feed:standardmedia-ke in RSS_FEED_SOURCES activates it, because the
      only questions the resolver asks are "is this id known?" and "was it
      named?". Rights are not among them. That is exactly the condition
      PROVIDER-RIGHTS-ACTIVATION-GATE-1 exists to end.

      WHEN THE GATE LANDS, THIS TEST MUST FAIL — and that failure is the signal
      that it worked. It should then be rewritten to assert that the source
      stays inert despite being named, rather than deleted.
    */
    const resolved = resolveActiveFeedSources(FEED_SOURCES, 'feed:standardmedia-ke');

    expect(resolved.sources.map((s) => s.sourceId)).toEqual(['feed:standardmedia-ke']);
    expect(resolved.overridden).toBe(true);
  });

  it('and the registry exposes no rights-cleared state for the gate to read', () => {
    /*
      The second half of the gap: even a caller that WANTED to check rights has
      nothing to check. No entry carries a rights field, so the future contract
      has to add the state as well as the gate.
    */
    for (const entry of FEED_SOURCES) {
      expect(entry).not.toHaveProperty('rightsCleared');
      expect(entry).not.toHaveProperty('rightsState');
    }
  });

  it('the allowlist still has no wildcard, which is the control that DOES hold', () => {
    /*
      Worth asserting beside the gap: a `*` would mean the next entry appended
      to this registry activates itself in every environment already carrying
      the variable. It does not exist, and must not be added as a convenience
      while the rights gate is still missing.
    */
    expect(resolveActiveFeedSources(FEED_SOURCES, '*').sources).toEqual([]);
    expect(resolveActiveFeedSources(FEED_SOURCES, '*').unknownIds).toEqual(['*']);
  });
});
