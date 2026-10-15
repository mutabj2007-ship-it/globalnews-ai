import { WITHHELD_BASIS, priorWorkRightsClearedWith, withheldForSourceRights } from './source-rights-withholding';

/*
  E1 §8.2 step 3 — stored answers citing held sources are withheld from readers at read time (the 34
  Taarifa, 25 KT Press and 1 Standard answers measured on Alpha 2026-10-10), never rewritten.
*/
const stored = (sourceIds: string[]) => ({
  answer: { state: 'CURRENT_REPORTING', basis: 'REQUIRED_EVIDENCE_OBTAINED', missingRoles: [] },
  analysis: { articles: sourceIds.map((sourceId, i) => ({ id: `a${i}`, sourceId, providerId: sourceId.startsWith('feed:') ? undefined : 'gnews' })) },
  background: { text: 'derived text' },
  artifact: { kind: 'SOURCED_REPORT' },
  chips: { kind: 'NONE' },
});

describe('withheldForSourceRights', () => {
  it.each([['feed:taarifa-rw'], ['feed:ktpress-rw'], ['feed:standardmedia-ke']])(
    'an answer citing %s is withheld: no text, no analysis, no memory; the reason is stated',
    (sourceId) => {
      const out = withheldForSourceRights(stored([sourceId])) as Record<string, unknown>;
      /* CTO R81 (b3e1744, R54 C-96 allowlist) — SUPERSEDED, NOT DELETED: was toEqual({ state, basis,
         missingRoles: [] }). The withheld answer is now REBUILT from codes (no spread of the stored answer)
         and carries an empty candidates list; the reader-visible state and basis are unchanged. */
      expect(out.answer).toEqual({ state: 'INSUFFICIENT', basis: WITHHELD_BASIS, missingRoles: [], candidates: [] });
      expect(out.analysis).toBeNull();
      expect(out.background).toBeNull();
      expect(out.artifact).toBeNull();
      expect(out.withheld).toEqual({ reason: 'SOURCE_RIGHTS', count: 1 });
      expect(out.chips).toEqual({ kind: 'NONE' });
    },
  );

  /* MASTER CTO R47 / E1-R46 supersedes "a provider-only answer is returned unchanged": a GNews-pending
     (PROVIDER_PENDING_REVIEW) answer has no positive basis for an external reader, so it is withheld too */
  it('E1-R46: a provider-only (GNews pending) answer is withheld from the external reader; the reason is stated', () => {
    const out = withheldForSourceRights(stored(['bbc', 'reuters'])) as Record<string, unknown>;
    expect((out.answer as { basis: string }).basis).toBe(WITHHELD_BASIS);
    expect(out.withheld).toEqual({ reason: 'SOURCE_RIGHTS', count: 2 });
  });

  it('one held source among provider sources withholds the whole derived answer', () => {
    const out = withheldForSourceRights(stored(['bbc', 'feed:taarifa-rw'])) as Record<string, unknown>;
    expect((out.answer as { basis: string }).basis).toBe(WITHHELD_BASIS);
  });

  it('the stored payload object is never mutated', () => {
    const payload = stored(['feed:taarifa-rw']);
    const copy = JSON.parse(JSON.stringify(payload));
    withheldForSourceRights(payload);
    expect(payload).toEqual(copy);
  });

  it('a metadata list keeps only items the METADATA decision admits', () => {
    const payload = {
      answer: { state: 'REFERENCE_BACKGROUND' },
      recentReporting: { items: [{ sourceId: 'bbc', providerId: 'gnews' }, { sourceId: 'feed:wp-pl' }, { sourceId: 'feed:taarifa-rw' }] },
    };
    const out = withheldForSourceRights(payload) as { recentReporting: { items: Array<{ sourceId: string }> } };
    /* E1-R46 — a GNews-pending item has no positive METADATA basis.
       E1 R81 C-1 — SUPERSEDED, NOT DELETED: was toEqual(['feed:taarifa-rw']) ("Taarifa's recorded metadata
       grant stays"). The state-keyed LIMITED_SCOPE_REVIEW metadata basis is removed (Taarifa parked):
       no item below CLEARED is listed. */
    expect(out.recentReporting.items.map((i) => i.sourceId)).toEqual([]);
  });

  it.each([null, undefined, 'x', 3, []])('non-object payload %p passes through', (v) => {
    expect(withheldForSourceRights(v)).toBe(v);
  });
});

/* Bypass check — an earlier SOURCED answer is reused as model input only when its sources still pass */
describe('priorWorkRightsClearedWith', () => {
  const store = (rows: Record<string, { sourceId: string; providerId?: string } | null>) => async (id: string) => rows[id] ?? null;
  const sourced = (refs: string[]) => ({ provenance: 'SOURCED_REPORTING', evidenceRefs: refs });

  it('a model-reasoning answer carries no source content → reusable', async () => {
    expect(await priorWorkRightsClearedWith({ provenance: 'MODEL_REASONING' }, undefined, 20)).toBe(true);
  });
  /* E1-R46 R46-10 supersedes "provider-path prior work is reusable": a GNews-pending source is not re-input */
  it('E1-R46: prior work resting on provider-path (GNews pending) articles is NOT handed to the model again', async () => {
    expect(await priorWorkRightsClearedWith(sourced(['a', 'b']), store({ a: { sourceId: 'bbc', providerId: 'gnews' }, b: { sourceId: 'reuters' } }), 20)).toBe(false);
  });
  it.each([
    ['a held RSS source', { a: { sourceId: 'feed:taarifa-rw' } }],
    ['a social post', { a: { sourceId: 'social:x:1' } }],
    ['an unresolvable ref (what the store returns for a held row)', { a: null }],
  ])('%s → withheld', async (_l, rows) => {
    expect(await priorWorkRightsClearedWith(sourced(['a']), store(rows as never), 20)).toBe(false);
  });
  it('no refs, too many refs, no store, or a failed read → withheld (fails closed)', async () => {
    expect(await priorWorkRightsClearedWith(sourced([]), store({}), 20)).toBe(false);
    expect(await priorWorkRightsClearedWith(sourced(['a', 'b', 'c']), store({}), 2)).toBe(false);
    expect(await priorWorkRightsClearedWith(sourced(['a']), undefined, 20)).toBe(false);
    expect(await priorWorkRightsClearedWith(sourced(['a']), async () => { throw new Error('db'); }, 20)).toBe(false);
  });
});
