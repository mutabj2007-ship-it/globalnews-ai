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
 * T1 UPDATE: the gate now exists (feed-source-registry.ts `feedActivationRefusal`,
 * driven by each entry's recorded `rights.state`). The paragraphs below are the
 * B5 record of the gap as it was measured; the tests further down were rewritten
 * to assert the closed behaviour, as they instructed.
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

describe('B5-E · PROVIDER-RIGHTS-ACTIVATION-GATE-1 — CLOSED by T1 (rewritten, not deleted)', () => {
  it('a rights-prohibited source named in the allowlist stays INERT and the refusal is visible', () => {
    /*
      T1 — THIS TEST FAILED WHEN THE GATE LANDED, AS ITS OWN COMMENT PREDICTED, and
      is rewritten as instructed: naming feed:standardmedia-ke in RSS_FEED_SOURCES no
      longer activates it. The refusal is reported, with the recorded reason, rather
      than silently dropped.
    */
    const resolved = resolveActiveFeedSources(FEED_SOURCES, 'feed:standardmedia-ke');

    expect(resolved.sources).toEqual([]);
    expect(resolved.overridden).toBe(true);
    expect(resolved.refused).toEqual([
      expect.objectContaining({
        sourceId: 'feed:standardmedia-ke',
        reason: 'RIGHTS_RESTRICTED',
        rightsState: 'RESTRICTED',
      }),
    ]);
    expect(resolveActiveFeedSources(FEED_SOURCES, 'feed:wp-pl').refused).toEqual([
      expect.objectContaining({ sourceId: 'feed:wp-pl', reason: 'RIGHTS_PROHIBITED' }),
    ]);
  });

  it('and every registry entry now carries an explicit recorded rights state — none CLEARED', () => {
    /*
      The second half of the recorded gap: the registry now exposes the state the gate
      reads. It is a recorded state with its evidence, never inferred from a fetch.
    */
    for (const entry of FEED_SOURCES) {
      expect(entry.rights.state).toBeDefined();
      expect(entry.rights.evidence.length).toBeGreaterThan(0);
      expect(entry.rights.state).not.toBe('CLEARED');
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
