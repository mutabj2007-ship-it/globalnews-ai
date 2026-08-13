import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'Hero.tsx'), 'utf-8');

describe('Hero two-zone recomposition (Master Frontend Recomposition, Checkpoint 2)', () => {
  it('uses a two-zone grid at the lg breakpoint (copy+ask left, dominant world visual right)', () => {
    expect(source).toMatch(/lg:grid-cols-\[0\.47fr_1fr\]/);
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

  it('the Hero visual grid uses the wider frame-utilization max-width and a map-dominant ratio (~32/68), per the reference proportion target', () => {
    expect(source).toMatch(/max-w-\[1480px\]/);
    expect(source).toMatch(/lg:grid-cols-\[0\.47fr_1fr\]/);
  });
});
