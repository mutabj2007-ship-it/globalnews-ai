import { createElement } from 'react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EnergyShell } from '@/components/energy/EnergyShell';
import EnergyPage from '@/app/energy/page';
import { cookies } from 'next/headers';
import { energyStrings } from './energyStrings';
import { energyFrameFromRetained, energyRetainedStrings } from './energyRetainedAdapter';
import { ENERGY_LAYOUT } from './energyTokens';
import type { EnergyObservation } from '@globalnews-ai/shared';
jest.mock('next/navigation', () => ({ useRouter: () => ({replace: jest.fn()}) }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/components/energy/EnergySpatialSubstrate', () => ({ EnergySpatialSubstrate: () => null }));
// Tests only: never a route fixture or a database admission.
const observation: EnergyObservation = {
  observationKey: 'synthetic-record', subjectId: 'test-subject', subjectName: 'Synthetic subject', subjectType: 'CORRIDOR',
  geographyId: 'PL', spatialPrecision: 'COUNTRY', metric: 'STORAGE', period: '2026-08', value: 12, unit: 'GWh',
  releaseStatus: 'FINAL', publisherChangedAt: null, retrievalId: 'test-retrieval', freshnessBasis: 'RETAINED_ONLY',
  provenance: {sourceType:'PUBLIC_DATA', evidenceRole:'REFERENCE_DATA', providerId:'TEST', institution:'Synthetic authority', retrievedAt:'2026-09-01T00:00:00.000Z'},
};
afterEach(() => jest.restoreAllMocks());
it.each(['en', 'pl'] as const)('route loads exactly one retained read and binds %s with no fixture query override', async locale => {
  (cookies as jest.Mock).mockReturnValue({get: () => ({value:locale})});
  const fetcher = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ok:true,json:async()=>[observation]} as Response);
  const page = await EnergyPage({searchParams:{subject:energyFrameFromRetained({kind:'OBSERVATIONS',observations:[observation]},locale).subjects[0].id,frame:'design-fixture'}});
  const shell = page.props.children;
  expect(shell.type).toBe(EnergyShell);
  expect(shell.props.data.subjects[0].name).toBe('Synthetic subject');
  expect(shell.props.locale).toBe(locale);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(String(fetcher.mock.calls[0][0])).toMatch(/\/energy\/observations$/);
});
it.each([[1512,'en'],[390,'en'],[1512,'pl'],[390,'pl']] as const)('renders retained evidence in existing %ipx %s selection', (width, locale) => {
  const reactHooks = require('react') as typeof React;
  const realUseState = reactHooks.useState;
  jest.spyOn(reactHooks, 'useState').mockImplementation(((initial: unknown) => realUseState(initial === ENERGY_LAYOUT.reflowWidth ? width : initial)) as typeof React.useState);
  const html = renderToStaticMarkup(createElement(EnergyShell, {
    data: energyFrameFromRetained({kind:'OBSERVATIONS',observations:[observation]},locale),
    strings: energyRetainedStrings({kind:'OBSERVATIONS',observations:[observation]},locale), locale, urlState:{substrate:'spatial',window:'7d',subject:energyFrameFromRetained({kind:'OBSERVATIONS',observations:[observation]},locale).subjects[0].id},
  }));
  expect(html).toContain(`data-energy-shell="${width === 390 ? 'compact' : 'desktop'}"`);
  expect(html).toContain('Synthetic subject');
  expect(html).toContain('12 GWh');
  expect(html).toContain('Synthetic authority');
  expect(html).toContain('test-retrieval');
  expect(html).toContain('data-energy-watch="absent"');
  expect(html).not.toContain('data-energy-watch="active"');
});
it.each(['en', 'pl'] as const)('compact %s discoverability uses the existing unranked list, not Change', locale => {
  const hooks = require('react') as typeof React;
  const realUseState = hooks.useState;
  jest.spyOn(hooks, 'useState').mockImplementation(((initial: unknown) => realUseState(initial === ENERGY_LAYOUT.reflowWidth ? 390 : initial)) as typeof React.useState);
  const props = { data: energyFrameFromRetained({kind:'OBSERVATIONS',observations:[observation]},locale), strings: energyRetainedStrings({kind:'OBSERVATIONS',observations:[observation]},locale), locale };
  const spatial = renderToStaticMarkup(createElement(EnergyShell, {...props, urlState:{substrate:'spatial',window:'7d',subject:null}}));
  expect(spatial).toContain('Synthetic subject');
  expect(spatial).toContain(energyStrings(locale).hudEvidence);
  const change = renderToStaticMarkup(createElement(EnergyShell, {...props, urlState:{substrate:'change',window:'7d',subject:null}}));
  expect(change).not.toContain('Synthetic subject');
});
