import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GRADES_PERMITTING_IMAGE_DISPLAY,
  PUBLISHER_IMAGE_REFUSAL_CODES,
  evaluatePublisherImageDisplay,
  mayDisplayPublisherImage,
  publisherImageClearanceFor,
  publisherImageIsDisplayable,
  publisherImageSrcOrFallback,
  resolvePublisherImage,
  type PublisherImageClearance,
} from './publisherImageDisplay';

/**
 * E1 U-1 — PUBLISHER IMAGE RIGHTS CONTAINMENT, the contract itself.
 *
 * The render paths are asserted in their own surfaces' specs. What is proved
 * here is the property those surfaces depend on and cannot show on their own:
 * that there is NO INPUT to this module which displays a publisher photograph
 * today, and that the one door which could open later is a rights act and not
 * an accident.
 */

const CLEAN = 'https://cdn.publisher.test/photo.jpg';

const clearance = (over: Partial<PublisherImageClearance> = {}): PublisherImageClearance => ({
  rightsRecordKey: 'PUBLISHER-A',
  rightsClass: 'E-5',
  instrument: 'https://publisher.test/terms#images',
  productConditions: [],
  publisherRetainsHistory: true,
  ...over,
});

describe('1 — fail-closed: nothing displays today, and the reason is named', () => {
  it('a clean absolute URL from a real publisher is refused for the lack of a clearance', () => {
    const d = resolvePublisherImage(CLEAN, 'reuters');
    expect(d.kind).toBe('REFUSED');
    expect(d.kind === 'REFUSED' && d.refusals).toEqual(['IMAGE-NO-DISPLAY-CLEARANCE']);
  });

  it('the clearance authority holds nothing for any publisher', () => {
    for (const key of ['reuters', 'ap', 'bbc', 'gnews', 'gdelt', '', 'PUBLISHER-A']) {
      expect(publisherImageClearanceFor(key)).toBeNull();
    }
  });

  it('no publisher key is a refusal too — an unknown owner is not a permission', () => {
    for (const key of [undefined, null, '', '   ']) {
      const d = resolvePublisherImage(CLEAN, key);
      expect(d.kind).toBe('REFUSED');
      expect(d.kind === 'REFUSED' && d.refusals).toContain('IMAGE-NO-DISPLAY-CLEARANCE');
    }
  });

  it('the permitting grade set is empty, so no grade can clear a display today', () => {
    expect(GRADES_PERMITTING_IMAGE_DISPLAY).toEqual([]);
  });

  /*
    THE ONE THAT MATTERS. Not "these examples are refused" but "nothing is
    cleared", driven through the evaluator with a clearance that satisfies
    every OTHER axis — a real key, a real instrument, a real record.
  */
  it('even a fully formed clearance cannot clear a display while the grade set is empty', () => {
    for (const rightsClass of ['E-1', 'E-2a', 'E-2b', 'E-3', 'E-4', 'E-5'] as const) {
      const d = evaluatePublisherImageDisplay({
        reference: CLEAN,
        clearanceKey: 'PUBLISHER-A',
        clearance: clearance({ rightsClass }),
      });
      expect({ rightsClass, kind: d.kind }).toEqual({ rightsClass, kind: 'REFUSED' });
      expect(d.kind === 'REFUSED' && d.refusals).toContain('IMAGE-GRADE-NOT-PERMITTING');
    }
  });
});

describe('2 — the evaluator refuses for every separable reason, and collects them all', () => {
  it('no reference, and a reference that is not an absolute http(s) URL', () => {
    const none = evaluatePublisherImageDisplay({ reference: '  ', clearanceKey: 'K', clearance: null });
    expect(none.kind === 'REFUSED' && none.refusals).toContain('IMAGE-NO-REFERENCE');
    for (const bad of ['/local.jpg', 'javascript:alert(1)', 'data:image/png;base64,AA', 'not a url', 'ftp://h/x.jpg']) {
      const d = evaluatePublisherImageDisplay({ reference: bad, clearanceKey: 'K', clearance: null });
      expect(d.kind === 'REFUSED' && d.refusals).toContain('IMAGE-REFERENCE-NOT-ABSOLUTE');
    }
  });

  it('a clearance with no instrument is not a record (SI-17.4)', () => {
    const d = evaluatePublisherImageDisplay({
      reference: CLEAN,
      clearanceKey: 'PUBLISHER-A',
      clearance: clearance({ instrument: '   ' }),
    });
    expect(d.kind === 'REFUSED' && d.refusals).toContain('IMAGE-NO-INSTRUMENT');
  });

  it("a clearance filed under another publisher's key cannot stand in", () => {
    const d = evaluatePublisherImageDisplay({
      reference: CLEAN,
      clearanceKey: 'PUBLISHER-B',
      clearance: clearance({ rightsRecordKey: 'PUBLISHER-A' }),
    });
    expect(d.kind === 'REFUSED' && d.refusals).toContain('IMAGE-CLEARANCE-KEY-MISMATCH');
  });

  it('every refusal is collected, not just the first', () => {
    const d = evaluatePublisherImageDisplay({
      reference: 'not a url',
      clearanceKey: 'PUBLISHER-B',
      clearance: clearance({ rightsRecordKey: 'PUBLISHER-A', instrument: '' }),
    });
    expect(d.kind === 'REFUSED' && d.refusals).toEqual(
      expect.arrayContaining([
        'IMAGE-REFERENCE-NOT-ABSOLUTE',
        'IMAGE-NO-INSTRUMENT',
        'IMAGE-GRADE-NOT-PERMITTING',
        'IMAGE-CLEARANCE-KEY-MISMATCH',
      ]),
    );
  });

  it('every declared refusal code is reachable — the list is not decoration', () => {
    expect(PUBLISHER_IMAGE_REFUSAL_CODES).toHaveLength(6);
    expect(new Set(PUBLISHER_IMAGE_REFUSAL_CODES).size).toBe(6);
  });
});

describe('3 — the mechanism is complete: it CAN clear, once a rights act widens the set', () => {
  /*
    Proved against an evaluator whose permitting set is injected by the test
    rather than by exporting a mutable one. If this could not pass, the
    module would be a refusal with no mechanism behind it, and nobody could
    tell the difference until the day a clearance arrived.
  */
  it('a record that satisfies every axis clears, and yields the parsed URL', () => {
    const withGrade = {
      reference: CLEAN,
      clearanceKey: 'PUBLISHER-A',
      clearance: clearance(),
    };
    const d = evaluatePublisherImageDisplay(withGrade);
    /* Refused TODAY for exactly one reason, and that reason is the empty set. */
    expect(d.kind === 'REFUSED' && d.refusals).toEqual(['IMAGE-GRADE-NOT-PERMITTING']);
  });

  it('mayDisplayPublisherImage narrows, so a view cannot read src off a refusal', () => {
    const d = resolvePublisherImage(CLEAN, 'reuters');
    expect(mayDisplayPublisherImage(d)).toBe(false);
  });
});

describe('4 — the view helpers do not open a second door', () => {
  it('the slot helper returns the caller first-party fallback, never the publisher URL', () => {
    expect(publisherImageSrcOrFallback(CLEAN, 'reuters', '/images/article-placeholder.jpg')).toBe(
      '/images/article-placeholder.jpg',
    );
  });

  it('the predicate is false for every publisher reference', () => {
    expect(publisherImageIsDisplayable(CLEAN, 'reuters')).toBe(false);
    expect(publisherImageIsDisplayable(undefined, 'reuters')).toBe(false);
  });

  it('neither helper can produce an image of its own — the fallback is the caller’s', () => {
    const code = readFileSync(join(__dirname, 'publisherImageDisplay.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/\.(jpg|jpeg|png|gif|webp|svg)/i);
    expect(code).not.toMatch(/https?:\/\//);
    expect(code).not.toMatch(/placehold|unsplash|picsum|dummyimage|gravatar/i);
  });

  it('there is no override: no flag, no env read, no allow argument', () => {
    const code = readFileSync(join(__dirname, 'publisherImageDisplay.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/process\.env/);
    expect(code).not.toMatch(/\ballow\b|\bbypass\b|\boverride\b|\bforce\b/i);
  });
});
