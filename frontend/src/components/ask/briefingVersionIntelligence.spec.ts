import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BriefingVersionView } from './BriefingViews';
import type { AskV2BriefingDetail, AskV2BriefingVersion } from '@/lib/api/askV2Api';

jest.mock('next/link', () => {
  const { createElement: h } = jest.requireActual('react');
  return { __esModule: true, default: ({ children, prefetch: _p, ...rest }: Record<string, unknown>) => h('a', rest, children) };
});

/**
 * CTO review of cf7a5d1 — a saved version STORES the governed specialist basis (blocks.intelligence);
 * the reader of that version must SEE it, through the same view rules as the live answer: only USED,
 * non-context contributions. A refused or non-displayable record is never shown.
 */
const obs = (reference: string, label: string) => ({
  reference,
  kind: 'UCDP_STATE_BASED',
  label,
  value: '3',
  unit: 'best-estimate fatalities',
  period: '2026-08-20',
  geography: 'COD',
  source: { name: 'UCDP GED candidate (fixture)', url: 'https://example.org/ucdp', licence: null },
  retainedAt: '2026-09-24T00:00:00Z',
  detail: { place: 'North Kivu (fixture)', parties: ['Side A', 'Side B'], headline: null, citedOutlets: [] },
});
const contribution = (contributorId: string, status: string, observations: unknown[]) => ({
  contributorId,
  domain: 'security',
  status,
  applicability: 'SUPPLEMENTARY',
  observations,
  temporalBasis: 'RETAINED_EVENT_RECORD',
  geographyBasis: 'COD',
  disclosures: ['RETAINED_NOT_CURRENT'],
  degradationReason: null,
});
const detail = { id: 'b1', title: 'Fixture', scope: { kind: 'ASK_QUESTION' }, status: 'ACTIVE', createdAt: '', updatedAt: '', versions: [], update: null } as unknown as AskV2BriefingDetail;
const version = (intelligence: unknown, withField = true): AskV2BriefingVersion =>
  ({
    briefingId: 'b1',
    title: 'Fixture',
    version: 1,
    asOf: '2026-10-01T08:00:00Z',
    windowFrom: null,
    windowTo: null,
    blocks: {
      schema: 'briefing-blocks/1',
      answerState: 'CURRENT_REPORTING',
      summary: 'Fixture summary.',
      keyFacts: [],
      comparisonTable: null,
      background: null,
      ...(withField ? { intelligence } : {}),
    },
    evidenceRefs: [],
    evidenceRevision: 'r',
    coverageGaps: [],
    createdAt: '2026-10-01T08:00:00Z',
    supersededBy: null,
    aiExecuted: false,
  }) as unknown as AskV2BriefingVersion;

const render = (v: AskV2BriefingVersion): string => {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(createElement(BriefingVersionView, { detail, version: v, locale: 'en' }));
  });
  const html = JSON.stringify(r.toJSON());
  act(() => r.unmount());
  return html;
};

describe('saved briefing version — the stored specialist basis is shown, never over-exposed', () => {
  it('shows a USED Conflict record from blocks.intelligence', () => {
    const html = render(version({ considered: ['CONFLICT'], contributions: [contribution('CONFLICT', 'USED', [obs('ucdp:1', 'Visible event')])] }));
    expect(html).toContain('"data-briefing":"intelligence"');
    expect(html).toContain('North Kivu (fixture)');
  });

  it('never shows observations of a REFUSED or NO_DATA contribution', () => {
    const html = render(
      version({
        considered: ['CONFLICT', 'ECONOMY_CPI'],
        contributions: [
          contribution('CONFLICT', 'REFUSED', [obs('x:1', 'REFUSED RECORD MUST NOT APPEAR')]),
          contribution('ECONOMY_CPI', 'NO_DATA', [obs('x:2', 'NO_DATA RECORD MUST NOT APPEAR')]),
        ],
      }),
    );
    expect(html).not.toContain('MUST NOT APPEAR');
  });

  it('an older version without the field shows nothing (unknown, not "none")', () => {
    const html = render(version(undefined, false));
    expect(html).not.toContain('"data-briefing":"intelligence"');
  });
});

describe('a saved PRIMARILY STRUCTURED answer (no summary) reads as sourced by its records', () => {
  it('shows the governed records and never "no sourced answer"', () => {
    const v = version({ considered: ['CONFLICT'], contributions: [contribution('CONFLICT', 'USED', [obs('ucdp:9', 'Structured-only event')])] });
    (v.blocks as { summary: string | null }).summary = null;
    const html = render(v);
    expect(html).toContain('"data-briefing":"intelligence"');
    expect(html).not.toContain('no sourced answer');
  });
});

describe('a saved version with NO summary and NO governed basis still says so', () => {
  it('a GEOGRAPHY-only or refused basis keeps "no sourced answer"', () => {
    for (const c of [contribution('GEOGRAPHY', 'USED', [obs('geo:1', 'Place')]), contribution('CONFLICT', 'REFUSED', [obs('x:1', 'R')])]) {
      const v = version({ considered: [c.contributorId], contributions: [c] });
      (v.blocks as { summary: string | null }).summary = null;
      expect(render(v)).toContain('no sourced answer');
    }
  });
});

describe('CTO continuation R2 — the version view uses the backend isGovernedBasis rule', () => {
  it('a reference-geography or source-less basis keeps "no sourced answer"', () => {
    const geoBasis = { ...contribution('CONFLICT', 'USED', [obs('g:1', 'Place')]), temporalBasis: 'REFERENCE_GEOGRAPHY' };
    const sourceless = contribution('CONFLICT', 'USED', [{ ...obs('x:2', 'No source'), source: { name: ' ', url: null, licence: null } }]);
    for (const c of [geoBasis, sourceless]) {
      const v = version({ considered: [c.contributorId], contributions: [c] });
      (v.blocks as { summary: string | null }).summary = null;
      expect(render(v)).toContain('no sourced answer');
    }
  });
});
