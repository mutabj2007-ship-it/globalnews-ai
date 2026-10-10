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
      expect(out.answer).toEqual({ state: 'INSUFFICIENT', basis: WITHHELD_BASIS, missingRoles: [] });
      expect(out.analysis).toBeNull();
      expect(out.background).toBeNull();
      expect(out.artifact).toBeNull();
      expect(out.withheld).toEqual({ reason: 'SOURCE_RIGHTS', count: 1 });
      expect(out.chips).toEqual({ kind: 'NONE' });
    },
  );

  it('a provider-only answer is returned unchanged (same object)', () => {
    const payload = stored(['bbc', 'reuters']);
    expect(withheldForSourceRights(payload)).toBe(payload);
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
    expect(out.recentReporting.items.map((i) => i.sourceId)).toEqual(['bbc', 'feed:taarifa-rw']);
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
  it('every ref resolves to a provider-path article → reusable', async () => {
    expect(await priorWorkRightsClearedWith(sourced(['a', 'b']), store({ a: { sourceId: 'bbc', providerId: 'gnews' }, b: { sourceId: 'reuters' } }), 20)).toBe(true);
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
