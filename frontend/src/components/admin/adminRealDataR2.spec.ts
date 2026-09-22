import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AdminContextProvider } from './shell/AdminContext';
import { OverviewScreen } from './screens/OverviewScreen';
import { AnalyticsUsageTab } from './screens/AnalyticsUsageTab';
import { AnalyticsUsersTab } from './screens/AnalyticsUsersTab';
import { AnalyticsScreen } from './screens/AnalyticsScreen';
import { SupportScreen } from './screens/SupportScreen';
import { SystemHealthScreen } from './screens/SystemHealthScreen';
import { useAdminResource } from '@/lib/admin/useAdminResource';
import { ADMIN_API } from '@/lib/admin/adminRoutes';
import { adminEn } from '@/lib/i18n/dictionaries/adminEn';
import type { AdminCapability } from '@/lib/admin/adminCapabilities';

jest.mock('@/lib/admin/useAdminResource', () => ({ useAdminResource: jest.fn() }));
const resource = jest.mocked(useAdminResource);
const render = (component: React.ReactElement, capabilities: AdminCapability[]) => {
  const props = {
    t: adminEn,
    me: { adminId: 'test', role: 'SUPER_ADMIN' as const, capabilities },
    children: component,
  };
  return renderToStaticMarkup(React.createElement(AdminContextProvider, props));
};

beforeEach(() => {
  resource.mockReset();
  resource.mockReturnValue({ state: 'real', data: null, reload: jest.fn() });
});

it.each([
  [OverviewScreen, 'analytics.view'],
  [AnalyticsUsersTab, 'access.manage'],
  [SupportScreen, 'support.handle'],
  [SystemHealthScreen, 'analytics.view'],
] as const)('%p does not mount a reader without its capability', (Component, capability) => {
  expect(render(React.createElement(Component), [])).toContain(adminEn.access.forbiddenBody);
  expect(resource).not.toHaveBeenCalled();
  render(React.createElement(Component), [capability]);
  expect(resource).toHaveBeenCalled();
});

it('analytics route cannot mount users based on role or analytics permission alone', () => {
  render(React.createElement(AnalyticsScreen, { tab: 'users' }), ['analytics.view']);
  expect(resource).not.toHaveBeenCalled();
});

it('overview reads only the three approved aggregate APIs and shares geography data', () => {
  render(React.createElement(OverviewScreen), ['analytics.view']);
  expect(resource.mock.calls.map(([path]) => path)).toEqual([
    ADMIN_API.analyticsUsage,
    ADMIN_API.systemHealth,
    ADMIN_API.analyticsCoverageGeography,
  ]);
});

it('shows measured zero independently of unavailable values and failed sections', () => {
  resource.mockReturnValue({
    state: 'real',
    data: {
      retention: { declaredDays: 90, enforced: false },
      windows: { shortHours: 24, longHours: 168 },
      generatedAt: '2026-09-22T00:00:00.000Z',
      accounts: null,
      analysis: { runsLast24h: 0, tokens: { sampleCount: 0 }, latency: { sampleCount: 0 } },
      events: null,
    },
    reload: jest.fn(),
  });
  const html = render(React.createElement(AnalyticsUsageTab), ['analytics.view']);
  expect(html).toContain(adminEn.realData.tokenSamples);
  expect(html).toContain(adminEn.realData.totalTokens);
  expect(html).toContain('>0<');
  expect(html).not.toContain('undefined');
  // Token totals lack a measurement; never synthesize a zero.
  const tokenCard = html.slice(html.indexOf(adminEn.realData.totalTokens));
  expect(tokenCard.slice(0, tokenCard.indexOf('</div></div>'))).not.toContain('>0<');
});

it('preserves unsupported active-user and finance/audit/SLA placeholders', () => {
  const read = (name: string) => readFileSync(join(__dirname, 'screens', name), 'utf8');
  const overview = read('OverviewScreen.tsx');
  expect(
    overview.slice(
      overview.indexOf('screen.kpis.activeUsers'),
      overview.indexOf('label={t.screens.analytics.coverageDistinct}'),
    ),
  ).toContain('data={UNAVAILABLE}');
  expect(read('AnalyticsScreen.tsx')).toContain('field="admin-03.subscriptions"');
  expect(read('SupportScreen.tsx')).toContain('field="admin-05.sla"');
  expect(read('SystemLogsScreen.tsx')).toContain('field="admin-07.logStream"');
  expect(read('PaymentsScreen.tsx')).toContain('PlaceholderPanel');
});
