/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE TWO LINEAGE FIELDS HAVE NO COLUMN, AND THE STORE SAYS SO OUT LOUD
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `OfficialDataRetrieval.referencePeriod` and `.sourceLanguage` landed this round because
 * Main's ruling C places them on the retrieval and `R-NUM-2` forbids the alternative. The
 * COLUMNS did not land, and this round was instructed to report that rather than invent a
 * migration — ruling D declines to design one.
 *
 * This suite is the report. It asserts the two things a reader needs: that the refusal
 * fires, and that it is NARROW — retaining a PDF artifact, which is what `R-STO-1` says
 * needs no migration, is unaffected.
 */

import {
  assertLineageFieldsArePersistable,
} from './official-data-snapshot.store';

describe('lineage fields with no column', () => {
  it('refuses a referencePeriod, naming the reason rather than dropping it', () => {
    expect(() => assertLineageFieldsArePersistable({ referencePeriod: '2026-08' })).toThrow(
      /SNAPSHOT_LINEAGE_FIELD_HAS_NO_COLUMN/,
    );
  });

  it('refuses a sourceLanguage the same way', () => {
    expect(() => assertLineageFieldsArePersistable({ sourceLanguage: 'en' })).toThrow(
      /SNAPSHOT_LINEAGE_FIELD_HAS_NO_COLUMN/,
    );
  });

  it('names BOTH when both are supplied, so one fix does not reveal a second failure', () => {
    let message = '';
    try {
      assertLineageFieldsArePersistable({ referencePeriod: '2026-08', sourceLanguage: 'en' });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('referencePeriod');
    expect(message).toContain('sourceLanguage');
  });

  it('states WHY, because a refusal a reader cannot act on is an outage', () => {
    let message = '';
    try {
      assertLineageFieldsArePersistable({ sourceLanguage: 'en' });
    } catch (e) {
      message = (e as Error).message;
    }
    /* The two candidate homes and why neither may be used. */
    expect(message).toContain('editionAnnotations');
    expect(message).toContain('R-AID-6');
    expect(message).toContain('schema migration');
  });

  it('IS NARROW — a retrieval that carries neither passes, so PDF retention is unaffected', () => {
    /* `R-STO-1`: retaining PDF BYTES needs no migration, measured and ratified. The
       artifact, its address, its retrieval row and its admission verdict all persist
       today. Only the two lineage fields have nowhere to go. */
    expect(() => assertLineageFieldsArePersistable({})).not.toThrow();
    expect(() =>
      assertLineageFieldsArePersistable({
        referencePeriod: undefined,
        sourceLanguage: undefined,
      }),
    ).not.toThrow();
  });
});
