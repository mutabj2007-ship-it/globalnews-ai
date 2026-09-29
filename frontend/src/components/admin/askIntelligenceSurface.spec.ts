import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AdminContextProvider } from './shell/AdminContext';
import { AskIntelligenceScreen } from './screens/AskIntelligenceScreen';
import { useAdminResource } from '@/lib/admin/useAdminResource';
import { ADMIN_API } from '@/lib/admin/adminRoutes';
import { adminEn } from '@/lib/i18n/dictionaries/adminEn';
import { adminPl } from '@/lib/i18n/dictionaries/adminPl';
import type { AdminCapability } from '@/lib/admin/adminCapabilities';
import type { AdminAskIntelligenceResponse } from '@/lib/admin/adminApiTypes';
import type { AdminDictionary } from '@/lib/i18n/dictionaries/adminEn';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK PUBLIC BETA OPERATIONS MINIMUM R1 — THE OPERATIONS PAGE, RENDERED
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The two properties that matter on an operations page:
 *   1. it renders no question, ever;
 *   2. a failed read shows an error, NOT a healthy zero.
 * Both are asserted against real markup rather than against the component's intentions.
 */
jest.mock('@/lib/admin/useAdminResource', () => ({ useAdminResource: jest.fn() }));
const resource = jest.mocked(useAdminResource);

const render = (capabilities: AdminCapability[], dictionary: AdminDictionary = adminEn): string => {
  /* The props are built as an object rather than passed inline, matching the landed
     `adminRealDataR2.spec.ts`: `AdminContextProvider` declares `children` as a required
     prop, so an inline literal trips `react/no-children-prop` while a third argument does
     not satisfy the type. */
  const props = {
    t: dictionary,
    me: { adminId: 'test', role: 'SUPER_ADMIN' as const, capabilities },
    children: React.createElement(AskIntelligenceScreen),
  };
  return renderToStaticMarkup(React.createElement(AdminContextProvider, props));
};

const EMPTY: AdminAskIntelligenceResponse = {
  health: {
    attemptsLast24h: 0,
    attemptsLast7d: 0,
    executionsLast24h: 0,
    executionsLast7d: 0,
    completionsLast24h: 0,
    failuresLast24h: 0,
    storedResultReusedLast7d: 0,
    modelInvocationsLast24h: 0,
    providerCallsLast24h: 0,
    zeroModelLast24h: 0,
    latency: { sampleCount: 0 },
    tokens: { sampleCount: 0 },
    byAnswerState: [],
    declaredAnswerStates: ['CURRENT_REPORTING'],
    clarificationRequiredLast7d: 0,
    capabilityUnavailableLast7d: 0,
  },
  evidence: null,
  operations: null,
  improvement: null,
  alerts: null,
  arraySample: { sampleCount: 0, limit: 5000, truncated: false },
  windows: { shortHours: 24, longHours: 168 },
  retention: { declaredDays: 30, enforced: true, enforcedBy: 'OPPORTUNISTIC_SWEEP_ON_WRITE' },
  disclosures: {
    rawQuestionStored: false,
    questionReviewImplemented: false,
    monetaryCostAvailable: false,
    deviceClassAvailable: false,
    readOnly: true,
    legacyRoutePathInstrumented: false,
    quotedWithoutExecutionObserved: false,
  },
  generatedAt: '2026-09-29T00:00:00.000Z',
};

beforeEach(() => {
  resource.mockReset();
  resource.mockReturnValue({ state: 'real', data: EMPTY, reload: jest.fn() });
});

describe('R1 — access', () => {
  it('does not mount a reader without analytics.view', () => {
    expect(render([])).toContain(adminEn.access.forbiddenBody);
    expect(resource).not.toHaveBeenCalled();
  });

  it('reads exactly one endpoint, and it is the Ask operations read', () => {
    render(['analytics.view']);
    expect(resource.mock.calls.map(([path]) => path)).toEqual([ADMIN_API.askIntelligence]);
  });
});

describe('R1 — a failed read is never a healthy zero', () => {
  it('a failed request renders the error state and no measured value', () => {
    resource.mockReturnValue({ state: 'error', data: null, reload: jest.fn() });
    const html = render(['analytics.view']);
    expect(html).toContain(adminEn.states.failed);
    expect(html).not.toContain('>0<');
  });

  it('a MEASURED zero renders as a zero, beside sections that failed', () => {
    const html = render(['analytics.view']);
    /* `health` was read and is genuinely empty; every other section is null, i.e. failed. */
    expect(html).toContain('>0<');
    expect(html).toContain(adminEn.states.failed);
    expect(html).not.toContain('undefined');
  });

  it('an absent latency measurement is NOT rendered as zero milliseconds', () => {
    const html = render(['analytics.view']);
    /* sampleCount is a measured zero; the median over zero rows has no value at all, so it
       must render as unavailable rather than borrow the sample count's zero. */
    const median = html.slice(html.indexOf(adminEn.screens.askIntelligence.health.latencyMedian));
    expect(median.slice(0, median.indexOf('</div></div>'))).not.toContain('>0<');
  });
});

describe('R1 — no question can reach the page', () => {
  it('the rendered markup carries no question, query, account or address field name', () => {
    const html = render(['analytics.view']).toLowerCase();
    ['"question"', 'rawquestion', 'searchquery', 'useremail', 'ipaddress', 'setby'].forEach(
      (forbidden) => {
        expect({ forbidden, present: html.includes(forbidden) }).toEqual({
          forbidden,
          present: false,
        });
      },
    );
  });

  it('the privacy notice is on the page rather than in a comment', () => {
    expect(render(['analytics.view'])).toContain(adminEn.screens.askIntelligence.privacyNotice);
  });

  it('the legacy rollback panel states the absence of a measurement', () => {
    expect(render(['analytics.view'])).toContain(
      adminEn.screens.askIntelligence.operations.legacyNotInstrumented,
    );
  });
});

describe('R1 — the page is EN and PL', () => {
  it('renders Polish copy from the Polish dictionary', () => {
    const html = render(['analytics.view'], adminPl);
    expect(html).toContain(adminPl.screens.askIntelligence.title);
    expect(html).toContain(adminPl.screens.askIntelligence.privacyNotice);
    expect(html).not.toContain(adminEn.screens.askIntelligence.privacyNotice);
  });
});

describe('R1 — the screen source cannot smuggle a figure or a sentence', () => {
  const source = readFileSync(join(__dirname, 'screens', 'AskIntelligenceScreen.tsx'), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/className=\{?["'`][\s\S]*?["'`]\}?/g, '');

  it('contains no rendered numeric literal', () => {
    expect(source.match(/>\s*\d[\d\s,.]*</g)).toBeNull();
  });

  it('every alert severity has a chip tone, so an unknown severity cannot render as healthy', () => {
    const map = source.slice(source.indexOf('SEVERITY_TONE'));
    ['OK', 'WARNING', 'CRITICAL', 'UNKNOWN'].forEach((severity) => {
      expect(map.slice(0, 200)).toContain(severity);
    });
    expect(map.slice(0, 200)).toContain("UNKNOWN: 'mute'");
  });

  it('it composes the shared primitives rather than inventing its own empty state', () => {
    expect(source).toContain('AdminDataTable');
    expect(source).toContain('KpiCard');
    expect(source).toContain('sectionState');
  });
});
