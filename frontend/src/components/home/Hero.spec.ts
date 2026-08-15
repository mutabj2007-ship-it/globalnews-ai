import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'Hero.tsx'), 'utf-8');

describe('Hero three-zone recomposition (M60 Phase 2 — search/ask left, dominant world visual center, live intelligence right, per CTO-approved reference geometry)', () => {
  it('uses a three-zone grid at the lg breakpoint (~31% / ~50% / ~19%, matching the approved reference proportions)', () => {
    expect(source).toMatch(/lg:grid-cols-\[0\.31fr_0\.50fr_0\.19fr\]/);
  });

  it('the live-intelligence panel is its own grid column, never absolutely positioned on top of the map', () => {
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/absolute bottom-4 right-4 top-4/);
  });

  it('uses HeroWorldVisual (real world geometry) as the Hero globe — CTO Visual Revision replaced the earlier abstract dot-grid version', () => {
    expect(source).toMatch(/<HeroWorldVisual/);
    expect(source).toMatch(/import \{ HeroWorldVisual \} from '@\/components\/home\/HeroWorldVisual'/);
  });

  it('the real Ask GlobalNews AI form submission is unchanged — same handler, same /search destination', () => {
    expect(source).toMatch(/onSubmit=\{handleSubmit\}/);
    expect(source).toMatch(/router\.push\(`\/search\?q=/);
  });

  it('does not introduce a second/fake AI input — exactly one <form role="search">', () => {
    const formCount = (source.match(/role="search"/g) ?? []).length;
    expect(formCount).toBe(1);
  });

  it('secondary CTA links to the real /map page', () => {
    expect(source).toMatch(/href="\/map"/);
  });

  it('credibility row uses only dictionary-driven, truthful generic labels', () => {
    expect(source).toMatch(/t\.credibilityLiveSources/);
    expect(source).toMatch(/t\.credibilityAiAnalysis/);
    expect(source).toMatch(/t\.credibilityEvidence/);
  });

  it('does not display an unsupported numeric claim near the credibility row', () => {
    expect(source).not.toMatch(/\d+\s*(reports|sources|alerts)/i);
  });

  it('accepts real HomeFeed articles for the compact live-feed panel — no new fetch introduced', () => {
    expect(source).toMatch(/latestArticles\?:\s*NewsArticle\[\]/);
    expect(source).not.toMatch(/fetch\(/);
  });

  it('the live-feed panel shows a small, bounded number of real articles, not the full feed', () => {
    expect(source).toMatch(/const FEED_PANEL_COUNT = 3/);
    expect(source).toMatch(/latestArticles\.slice\(0, FEED_PANEL_COUNT\)/);
  });

  it('the live-feed panel always remains present, even with zero articles — a truthful fallback state instead of disappearing', () => {
    expect(source).not.toMatch(/\{latestArticles\.length > 0 && \(/);
    expect(source).toMatch(/latestArticles\.length > 0 \? \(/);
    expect(source).toMatch(/\{t\.feedPanelUnavailableHeading\}/);
    expect(source).toMatch(/\{t\.feedPanelUnavailableBody\}/);
  });

  it('the fallback state never fabricates a headline or timestamp', () => {
    const fallbackBlock = source.slice(
      source.indexOf('feedPanelUnavailableHeading'),
      source.indexOf('feedPanelViewMap'),
    );
    expect(fallbackBlock).not.toMatch(/formatRelativeTime/);
  });

  it('the Hero visual grid uses the wider frame-utilization max-width and the approved three-zone map-dominant composition (~31/50/19), per the reference proportion target', () => {
    expect(source).toMatch(/max-w-\[1600px\]/);
    expect(source).toMatch(/lg:grid-cols-\[0\.31fr_0\.50fr_0\.19fr\]/);
  });
});
