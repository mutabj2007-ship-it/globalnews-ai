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
      'admin-02.pipelineMode',
      'admin-06.providerHealth',
      'admin-06.providerMode',
      'admin-07.appProbe',
      'admin-07.databaseProbe',
      'admin-07.newsProviderProbe',
      'admin-08.correlationId',
      'settings.localisation',
    ]);
  });

  it('carries the F0 corrections — the nine fields the design tagged A that have no backing data are C', () => {
    (
      [
        'admin-03.languagePerSession',
        'admin-04.transactions',
        'admin-04.taxTreatment',
        'admin-04.customersNip',
        'admin-04.invoices',
        'admin-05.tickets',
        'admin-05.userReplies',
        'admin-06.providerCounters',
        'admin-08.adminAuthEvents',
      ] as const
    ).forEach((key) => {
      expect({ key, tag: provenanceOf(key) }).toEqual({ key, tag: 'C' });
    });
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
