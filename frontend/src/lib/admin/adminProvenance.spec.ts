import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { PROVENANCE, PROVENANCE_KEYS, provenanceOf } from './adminProvenance';

/**
 * F1.b — provenance is data, and this is the spec that keeps it honest.
 *
 * Two properties matter most:
 *   1. NO FIELD MAY CLAIM TAG D. D is design sample data, and design
 *      sample data does not ship. A D entry here would be a licence to
 *      render an illustrative figure.
 *   2. THE A-TAGGED SET IS EXACTLY THE CAPABILITIES THAT REALLY EXIST.
 *      F0 found nine of the design's thirteen A-tags had no backing data
 *      at all. If someone re-tags a field A without an endpoint behind
 *      it, this fails.
 */
const ADMIN_COMPONENTS = join(__dirname, '..', '..', 'components', 'admin');

function componentFiles(dir: string = ADMIN_COMPONENTS): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return componentFiles(full);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('F1.b — provenance registry', () => {
  it('covers all nine screens', () => {
    [
      'admin-01',
      'admin-02',
      'admin-03',
      'admin-04',
      'admin-05',
      'admin-06',
      'admin-07',
      'admin-08',
      'settings',
    ].forEach((prefix) => {
      expect(PROVENANCE_KEYS.some((key) => key.startsWith(`${prefix}.`))).toBe(true);
    });
  });

  it('NO field is tagged D — design sample data does not ship', () => {
    PROVENANCE_KEYS.forEach((key) => {
      expect({ key, tag: provenanceOf(key) }).not.toEqual({ key, tag: 'D' });
    });
  });

  it('every tag is one of A, B or C', () => {
    PROVENANCE_KEYS.forEach((key) => {
      expect(['A', 'B', 'C']).toContain(PROVENANCE[key]);
    });
  });

  it('the A-tagged set is exactly the capabilities that genuinely exist today', () => {
    const aTagged = PROVENANCE_KEYS.filter((key) => PROVENANCE[key] === 'A').sort();

    expect(aTagged).toEqual([
      'admin-01.capabilities',
      'admin-01.identity',
      'admin-01.role',
      'admin-02.alphaReview',
      'admin-02.analysisRequests',
      'admin-02.pipelineMode',
      'admin-03.analysisRuns',
      'admin-03.contentGeography',
      'admin-03.featureUsage',
      'admin-03.followedCountries',
      'admin-03.newUsers',
      'admin-03.observedReturnVisits',
      'admin-03.userRecords',
      'admin-05.internalNotes',
      'admin-05.tickets',
      'admin-05.userReplies',
      'admin-06.providerHealth',
      'admin-06.providerMode',
      'admin-07.aiProviderProbe',
      'admin-07.appProbe',
      'admin-07.authenticationProbe',
      'admin-07.databaseProbe',
      'admin-07.newsProviderProbe',
      'admin-08.correlationId',
      'settings.localisation',
    ]);
  });

  /**
   * MVP-G4 — the only two fields this milestone re-tagged, and the two
   * it added. Written as an explicit test rather than left implicit in
   * the list above, so the reason a tag moved stays in the record.
   */
  it('G4 promotes the two probes it implemented from C to A, and nothing else', () => {
    expect(provenanceOf('admin-07.authenticationProbe')).toBe('A');
    expect(provenanceOf('admin-07.aiProviderProbe')).toBe('A');

    // Still C: no probe was implemented for either.
    expect(provenanceOf('admin-07.frontendProbe')).toBe('C');
    expect(provenanceOf('admin-07.backgroundServices')).toBe('C');
  });

  it('G4 tags the ingestion aggregates B — a derived count, not a stored field', () => {
    expect(provenanceOf('admin-07.ingestionVolume')).toBe('B');
    expect(provenanceOf('admin-07.ingestionFreshness')).toBe('B');
  });

  /**
   * S3 — the three support fields it implemented, and the two it did
   * not. Written as an explicit test rather than left implicit in the
   * list above, so the reason each tag is where it is stays in the
   * record — and so that a future edit cannot promote the last two by
   * quietly adding them to a sorted array.
   */
  it('S3 promotes the three support fields it implemented from C to A', () => {
    expect(provenanceOf('admin-05.tickets')).toBe('A');
    expect(provenanceOf('admin-05.userReplies')).toBe('A');
    expect(provenanceOf('admin-05.internalNotes')).toBe('A');
  });

  it('S3 leaves ticket audit and SLA at C — neither has a source of truth', () => {
    // There is no audit store and no SLA model in this platform. An A
    // here would be a claim that the screen can show something the
    // backend cannot produce, which is the exact failure the provenance
    // registry exists to prevent.
    expect(provenanceOf('admin-05.ticketAudit')).toBe('C');
    expect(provenanceOf('admin-05.sla')).toBe('C');
  });

  it('carries the F0 corrections — the fields the design tagged A that have no backing data are C', () => {
    // 'admin-05.tickets' and 'admin-05.userReplies' were on this list
    // until S3. They left it by having the capability BUILT — the
    // support ticket and message models and the admin queue endpoint —
    // not by being re-tagged. The remaining seven still have no backing
    // data of any kind.
    (
      [
        'admin-03.languagePerSession',
        'admin-04.transactions',
        'admin-04.taxTreatment',
        'admin-04.customersNip',
        'admin-04.invoices',
        'admin-06.providerCounters',
        'admin-08.adminAuthEvents',
      ] as const
    ).forEach((key) => {
      expect({ key, tag: provenanceOf(key) }).toEqual({ key, tag: 'C' });
    });
  });

  /**
   * ADMIN-03 — the eight fields this lane promoted, and the five it
   * deliberately did not.
   *
   * Written out rather than left implicit in the sorted list above, so
   * that the REASON each tag sits where it sits stays in the record and
   * so that a future edit cannot promote one of the five by quietly
   * adding it to an array.
   */
  it('ADMIN-03 promotes only fields a real endpoint now returns', () => {
    (
      [
        // AnalysisRun has existed since R3/T7; the ledger's C was stale.
        'admin-02.analysisRequests',
        'admin-03.analysisRuns',
        'admin-03.newUsers',
        'admin-03.observedReturnVisits',
        'admin-03.featureUsage',
        'admin-03.userRecords',
        'admin-03.contentGeography',
        'admin-03.followedCountries',
      ] as const
    ).forEach((key) => {
      expect({ key, tag: provenanceOf(key) }).toEqual({ key, tag: 'A' });
    });
  });

  it('ADMIN-03 leaves every field WITHOUT a source at C', () => {
    (
      [
        // Active users: no per-request activity is recorded anywhere,
        // and anonymous readers cannot be counted at all.
        'admin-03.activeReturning',
        // Session-scoped language is not persisted, and the one column
        // that could hold it is populated by no emitter.
        'admin-03.languagePerSession',
        // No address, no geo enrichment, no query string in the access
        // log. The contract has no field for it either.
        'admin-03.audienceGeography',
        // Cohorts need a per-user activity time series. lastSeenAt is a
        // single overwritten scalar, so the history does not exist and
        // building this later recovers nothing before the day it ships.
        'admin-03.retention',
        // No client error model, column, endpoint or handler exists.
        'admin-03.clientErrors',
        // No subscription model exists anywhere in this platform.
        'admin-03.subscriptions',
      ] as const
    ).forEach((key) => {
      expect({ key, tag: provenanceOf(key) }).toEqual({ key, tag: 'C' });
    });
  });

  /**
   * THE ONE THAT MATTERS MOST ON THIS SCREEN.
   *
   * A live "returning" number sitting next to an absent "active" number
   * is exactly the situation where the live one gets borrowed to fill
   * the gap. The two are separate keys with separate tags so that doing
   * so requires editing this file, in the open.
   */
  it('the returning measurement and the absent active measurement are DIFFERENT keys', () => {
    expect(provenanceOf('admin-03.observedReturnVisits')).toBe('A');
    expect(provenanceOf('admin-03.activeReturning')).toBe('C');
  });

  /**
   * ADMIN-03 CLOSURE — the third stale entry, corrected after a separate
   * ruling rather than folded into the implementation.
   *
   * B claims a rollup is all that is missing. For sessions nothing is
   * missing that could be built: the rows are deleted on sign-out and on
   * expiry, so a historical session count has no source to aggregate.
   * The distinction matters because B invites somebody to write the
   * endpoint, and the endpoint cannot exist.
   */
  it('sessions are C, not B — the rows are deleted, so no rollup could ever recover them', () => {
    expect(provenanceOf('admin-02.sessions')).toBe('C');
  });

  it('the two fields the design over-tagged A that really are aggregations are B', () => {
    expect(provenanceOf('admin-02.articlesIngested')).toBe('B');
    expect(provenanceOf('admin-06.articleInventory')).toBe('B');
  });

  it('every provenance key a component references exists in the registry', () => {
    const referenced = new Set<string>();

    componentFiles().forEach((file) => {
      const source = readFileSync(file, 'utf-8');
      (source.match(/field="([a-z0-9-]+\.[A-Za-z]+)"/g) ?? []).forEach((raw) => {
        referenced.add(raw.replace(/field="|"/g, ''));
      });
      (source.match(/'((?:admin-0[1-8]|settings)\.[A-Za-z]+)'/g) ?? []).forEach((raw) => {
        referenced.add(raw.replace(/'/g, ''));
      });
    });

    expect(referenced.size).toBeGreaterThan(20);
    referenced.forEach((key) => {
      expect(PROVENANCE_KEYS).toContain(key);
    });
  });

  it('every data component that shows a value renders a provenance badge', () => {
    ['KpiCard.tsx', 'AdminPanel.tsx', 'PlaceholderPanel.tsx'].forEach((name) => {
      const source = readFileSync(join(ADMIN_COMPONENTS, 'primitives', name), 'utf-8');
      expect(source).toContain('ProvenanceBadge');
    });
  });
});
