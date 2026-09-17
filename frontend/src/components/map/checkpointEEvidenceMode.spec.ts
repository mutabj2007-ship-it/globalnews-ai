import { readFileSync } from 'fs';
import { join } from 'path';

import { qualifyingRecords } from '@/lib/map/evidence/evidenceModel';
import { layerAppliesInMode, layerById, railLayers } from '@/lib/map/layers/layerRegistry';
import { LIVE_MAP_MODES } from '@/lib/map/state/mapState';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT E-4 / E-5 — WHAT EVIDENCE MODE AND THE EVID TOGGLE ACTUALLY DO
 * ════════════════════════════════════════════════════════════════════════════
 *
 * SPATIAL-EVIDENCE-MODE-AFFORDANCE-1 and
 * SPATIAL-COUNTRY-EVIDENCE-LAYER-TOGGLE-1.
 *
 * The ruling for Checkpoint E is *"correct or explicitly classify"*. Both of
 * these are CLASSIFIED, with the measurement that settles them, because
 * correcting either would mean inventing product semantics that belong to a
 * design ruling rather than to a convergence pass.
 *
 * ─── E-4 · EVIDENCE MODE IS INDISTINGUISHABLE FROM WORLD ──────────────────
 *
 * MEASURED, not argued: `qualifyingRecords` switches on the mode, and WORLD and
 * EVIDENCE share one `default: return true` arm. Given identical inputs the two
 * live modes return THE SAME RECORDS — so switching between them changes
 * nothing a reader can see.
 *
 * THE CAUSE IS A PRODUCER GATE, NOT A MISSING DESIGN. The registry does declare
 * a distinction: `evidencePoints` applies in EVIDENCE and CHANGE and NOT in
 * WORLD, so EVIDENCE is meant to be the mode that draws point-precision
 * evidence. That layer is GATED — "no producer emits point-precision evidence;
 * PRODUCIBLE_SPATIAL_PRECISION is ['COUNTRY','UNKNOWN']" — so the difference
 * cannot manifest. EVIDENCE mode is not empty of intent; it is waiting on a
 * backend that does not yet emit what it exists to show.
 *
 * WHY THIS IS NOT CORRECTED HERE. The three ways forward — merge the modes,
 * relabel EVIDENCE as pending, or leave it until the producer lands — are
 * product decisions with different costs, and the ruling forbids inventing.
 * Recorded as SPATIAL-EVIDENCE-MODE-AFFORDANCE-1 = OPEN, with the gate named,
 * so the decision is made on evidence rather than rediscovered later.
 *
 * ─── E-5 · THE EVID TOGGLE GOVERNS TWO OF THE FOUR EVIDENCE LAYERS ────────
 *
 * The canvas binds four evidence layers to two different keys:
 *
 *   FILL, EVIDENCE_LINE  <- layers.countryEvidence   the EVID chip in the rail
 *   HALO, MARK           <- layers.evidencePoints    NO CONTROL EXISTS
 *
 * `evidencePoints` is not in `RAIL_EVIDENCE_LAYERS`, so no rail control can
 * ever set it, and `layers.evidencePoints !== false` means an unset key reads as
 * VISIBLE. Both keys even share the same glyph, so they would read as one
 * layer.
 *
 * Today this is invisible for the same reason as E-4: `evidencePoints` is GATED
 * and draws nothing, so turning EVID off does remove all visible evidence. The
 * trigger is named and is the same one: the moment a producer emits
 * point-precision evidence, marks would appear that the EVID chip does not
 * govern and no control can switch off.
 *
 * Recorded as SPATIAL-COUNTRY-EVIDENCE-LAYER-TOGGLE-1 = OPEN, guarded below so
 * it cannot land unnoticed.
 */

const canvas = readFileSync(join(__dirname, 'shell', 'EvidenceMapCanvas.tsx'), 'utf-8');

const record = (over: Record<string, unknown> = {}) =>
  ({
    id: 'r1',
    geography: { countryIso3: 'POL', displayName: 'Poland' },
    lastObservedAt: '2026-09-17T00:00:00.000Z',
    ...over,
  }) as never;

const set = (records: readonly unknown[]) =>
  ({ loadedAt: '2026-09-17T06:00:00.000Z', records }) as never;

describe('E-4 — EVIDENCE mode is not yet distinguishable from WORLD', () => {
  describe('THE TWO LIVE MODES RETURN THE SAME RECORDS', () => {
    const evidenceSet = set([
      record({ id: 'r1' }),
      record({ id: 'r2', newSinceLastVisit: 3 }),
      record({ id: 'r3', situationIds: ['s1'] }),
    ]);

    it('measured over the same input, WORLD and EVIDENCE agree exactly', () => {
      const world = qualifyingRecords(evidenceSet, 'WORLD', '24H');
      const evidence = qualifyingRecords(evidenceSet, 'EVIDENCE', '24H');

      expect(evidence.map((r) => r.id)).toEqual(world.map((r) => r.id));
    });

    it('and they are the only two live modes, so this is what a reader can reach', () => {
      expect([...LIVE_MAP_MODES]).toEqual(['WORLD', 'EVIDENCE']);
    });

    it('the other modes DO differ, which is what makes the equality meaningful', () => {
      /*
        If every mode returned everything, the equality above would say nothing
        about EVIDENCE in particular. These show the switch really does
        discriminate — EVIDENCE simply is not one of the arms that does.
      */
      expect(qualifyingRecords(evidenceSet, 'CHANGE', '24H').map((r) => r.id)).toEqual(['r2']);
      expect(qualifyingRecords(evidenceSet, 'SITUATIONS', '24H').map((r) => r.id)).toEqual(['r3']);
      expect(qualifyingRecords(evidenceSet, 'SOURCES', '24H')).toHaveLength(0);
    });
  });

  describe('THE INTENDED DISTINCTION EXISTS IN DATA, AND IS GATED', () => {
    it('evidencePoints applies in EVIDENCE and not in WORLD', () => {
      /* So EVIDENCE is declared as the mode that draws point-precision evidence. */
      const points = layerById('evidencePoints')!;

      expect(layerAppliesInMode(points, 'EVIDENCE')).toBe(true);
      expect(layerAppliesInMode(points, 'WORLD')).toBe(false);
    });

    it('but it is GATED on a producer, so the distinction cannot appear', () => {
      const points = layerById('evidencePoints')!;

      expect(points.runtime).toBe('GATED');
      expect(points.available).toBe(false);
      expect(points.runtimeEvidence).toMatch(/no producer emits point-precision evidence/i);
    });

    it('and the gate is named as the producer, not as this code', () => {
      /*
        Worth pinning: the fix is a backend capability, so nothing in the map
        layer can close it and no frontend change should pretend to.
      */
      expect(layerById('evidencePoints')!.runtimeEvidence).toMatch(
        /PRODUCIBLE_SPATIAL_PRECISION.? is \['COUNTRY','UNKNOWN'\]/,
      );
    });
  });
});

describe('E-5 — the EVID toggle does not govern every evidence layer', () => {
  describe('FOUR EVIDENCE LAYERS, TWO KEYS, ONE CONTROL', () => {
    it('the country fill and its edge answer to countryEvidence', () => {
      expect(canvas).toContain('apply(FILL_LAYER_ID, layers.countryEvidence !== false);');
      expect(canvas).toContain('apply(EVIDENCE_LINE_LAYER_ID, layers.countryEvidence !== false);');
    });

    it('the point halo and mark answer to a DIFFERENT key', () => {
      expect(canvas).toContain('apply(HALO_LAYER_ID, layers.evidencePoints !== false);');
      expect(canvas).toContain('apply(MARK_LAYER_ID, layers.evidencePoints !== false);');
    });

    it('and no rail control can ever set that key', () => {
      /* The defect in one assertion. */
      expect(railLayers().map((l) => l.id)).not.toContain('evidencePoints');
    });

    it('an unset key reads as VISIBLE, not hidden', () => {
      /*
        `!== false` means absent is on. So the layer is not merely
        uncontrollable, it defaults to drawn — which is the direction that
        matters.
      */
      expect(canvas).toContain('layers.evidencePoints !== false');
      expect(layerById('evidencePoints')!.defaultOn).toBe(true);
    });
  });

  describe('WHY NO READER HAS MET THIS', () => {
    it('the ungoverned layer is gated and draws nothing today', () => {
      expect(layerById('evidencePoints')!.available).toBe(false);
    });

    it('so turning EVID off does remove all VISIBLE evidence — for now', () => {
      /*
        The honest statement of scope. Both halves matter: the toggle is
        complete in what a reader can currently see, and incomplete in what the
        canvas is wired to draw.
      */
      const governed = layerById('countryEvidence')!;

      expect(governed.available).toBe(true);
      expect(railLayers().map((l) => l.id)).toContain('countryEvidence');
    });

    it('and the trigger is the same producer that blocks E-4', () => {
      /* One backend capability closes both items. That is worth knowing. */
      expect(layerById('evidencePoints')!.runtime).toBe('GATED');
    });
  });
});
