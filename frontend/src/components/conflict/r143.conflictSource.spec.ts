import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ConflictObservation } from '@globalnews-ai/shared';
import { reviewedObservations } from '@/lib/conflict/retained';
import { UCDP_LICENCE } from '@/lib/ask/askExploreRegions';
import { ConflictSourceField } from './ConflictSourceField';
import CONFLICT from '@/components/ask-frame/r135.conflictFixture.json';

/*
  R143 D3 · E1 R135 addendum 02 §3 (R135-C2) — the /conflict selected record's "Source".
  UCDP records the reporting outlet's headline in `sourceReference.citation` (and as `source_headline`);
  UCDP's CC BY 4.0 licenses UCDP's data, not that publisher's expression. So the panel shows the
  DATASET + licence, the outlet NAME and the record's link — never the citation or the headline.
  The fixture is real retained UCDP rows (the same file as R135); no headline is copied into this spec.
*/
const rows = reviewedObservations(CONFLICT);
const html = (row: ConflictObservation): string =>
  renderToStaticMarkup(createElement('dl', null, createElement(ConflictSourceField, { row, sourceLabel: 'Source' })));

describe('R143 D3 · /conflict source field', () => {
  it('fixture precondition: the real rows DO carry a citation, so the negative below is meaningful', () => {
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => typeof r.sourceReference.citation === 'string' && r.sourceReference.citation.length > 20)).toBe(true);
  });
  it.each(rows.map((r) => [r.observationKey, r] as const))('%s: never renders the raw citation (publisher headline)', (_k, row) => {
    const out = html(row);
    expect(out).not.toContain(row.sourceReference.citation as string);
    /* not even a long fragment of it (the live string began with the outlet, then the headline) */
    const after = (row.sourceReference.citation as string).split(',').slice(2).join(',').trim();
    if (after.length >= 12) expect(out).not.toContain(after.slice(0, 12));
  });
  it('credits the dataset with the CC BY 4.0 licence name and URI, isolated as en/ltr', () => {
    const out = html(rows[0]);
    expect(out).toContain('UCDP GED');
    expect(out).toContain(`href="${UCDP_LICENCE.href}"`);
    expect(out).toMatch(/data-conflict="source-licence"[^>]*>CC BY 4\.0</);
    expect(out).toMatch(/<a href="https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/" target="_blank" rel="noopener noreferrer" lang="en" dir="ltr"/);
  });
  it('keeps the outlet NAMES (reportingOffice) — UCDP\'s own datum, E1 R135 Q1', () => {
    const row = rows.find((r) => r.sourceReference.reportingOffice?.startsWith('The New Times'));
    expect(row).toBeDefined();
    expect(html(row!)).toContain('The New Times, Actualite.cd, Kivu Morning Post');
  });
  it('CTO R144: a social handle in reportingOffice (a person\'s account) is never shown', () => {
    const row = rows.find((r) => /@\w+ on X/.test(r.sourceReference.reportingOffice ?? ''));
    expect(row).toBeDefined();
    expect(html(row!)).not.toMatch(/@\w+|on X/);
  });
  it('ConflictDashboard renders the source through this field and has no headline or citation render left', () => {
    const src = readFileSync(join(__dirname, 'ConflictDashboard.tsx'), 'utf8');
    expect(src).toContain('<ConflictSourceField row={row} sourceLabel={t.source} />');
    expect(src).not.toMatch(/evidenceDetail\??\.sourceHeadline/);
    expect(src).not.toMatch(/sourceReference\.citation/);
    /* CTO R144: UCDP source_original is unreviewed free text — not rendered until E1 rules */
    expect(src).not.toMatch(/evidenceDetail\??\.sourceOriginal/);
  });
});
