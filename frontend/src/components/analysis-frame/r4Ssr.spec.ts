import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnalysisFrameSurface } from '@/components/analysis-frame/AnalysisFrameSurface';
import { fixture } from '@/components/analysis-frame/frameFixtures';

describe('R4 §9 — SSR emits no React warning', () => {
  it('renders the mounted surface server-side with a silent console', () => {
    const errors: string[] = [];
    const warns: string[] = [];
    const e = jest.spyOn(console, 'error').mockImplementation((...a) => { errors.push(String(a[0])); });
    const w = jest.spyOn(console, 'warn').mockImplementation((...a) => { warns.push(String(a[0])); });
    try {
      renderToStaticMarkup(createElement(AnalysisFrameSurface as never, { response: fixture() } as never));
    } finally { e.mockRestore(); w.mockRestore(); }
    expect({ errors, warns }).toEqual({ errors: [], warns: [] });
  });
});
