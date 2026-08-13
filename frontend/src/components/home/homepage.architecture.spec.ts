import { readFileSync } from 'fs';
import { join } from 'path';

const pageSource = readFileSync(join(__dirname, '../../app/page.tsx'), 'utf-8');
const latestUpdatesSource = readFileSync(join(__dirname, 'LatestUpdatesFeed.tsx'), 'utf-8');
const newsroomSource = readFileSync(join(__dirname, 'NewsroomSection.tsx'), 'utf-8');

describe('Homepage final architecture (Milestone #51 consolidated round)', () => {
  it('renders sections in the approved order: Hero, LatestNowRail, NewsroomSection, CategoryCards, LatestUpdatesFeed, WorldMapGateway, HowItWorks, TrustSection', () => {
    const order = ['<Hero', '<LatestNowRail', '<NewsroomSection', '<CategoryCards', '<LatestUpdatesFeed', '<WorldMapGateway', '<HowItWorks', '<TrustSection'];
    let lastIndex = -1;
    for (const marker of order) {
      const index = pageSource.indexOf(marker);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it('makes exactly one getHomeFeed call (the single-request architecture)', () => {
    const matches = pageSource.match(/getHomeFeed\(/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('page.tsx contains no direct fetch() call — the single request stays inside getHomeFeed', () => {
    expect(pageSource).not.toMatch(/\bfetch\(/);
  });

  it('LatestNowRail and LatestUpdatesFeed both receive the SAME feed.latestUpdates — one derivation source, not a duplicated allocation', () => {
    expect(pageSource).toMatch(/<LatestNowRail updates=\{feed\.latestUpdates\}/);
    expect(pageSource).toMatch(/<LatestUpdatesFeed updates=\{feed\.latestUpdates\}/);
  });
});

describe('DataMode/provider hierarchy (Milestone #51)', () => {
  it('DataModeLabel no longer appears in LatestUpdatesFeed — de-duplicated per the investigation', () => {
    expect(latestUpdatesSource).not.toMatch(/<DataModeLabel/);
    expect(latestUpdatesSource).not.toMatch(/import\s*\{[^}]*\bDataModeLabel\b[^}]*\}\s*from/);
  });

  it('DataModeLabel is retained exactly once, in NewsroomSection', () => {
    expect(newsroomSource).toMatch(/<DataModeLabel/);
  });

  it('LatestNowRail carries no per-card data-mode badge', () => {
    const railSource = readFileSync(join(__dirname, 'LatestNowRail.tsx'), 'utf-8');
    expect(railSource).not.toMatch(/<DataModeLabel/);
  });
});

describe('Phase B regression — semantic allocation preserved (Milestone #51)', () => {
  it('page.tsx still uses the four Phase B semantic roles', () => {
    expect(pageSource).toMatch(/feed\.featured/);
    expect(pageSource).toMatch(/feed\.inFocus/);
    expect(pageSource).toMatch(/feed\.discovery/);
    expect(pageSource).toMatch(/feed\.latestUpdates/);
  });

  it('no old trending/categoryCards HomeFeed field names remain', () => {
    expect(pageSource).not.toMatch(/feed\.trending/);
    expect(pageSource).not.toMatch(/feed\.categoryCards/);
  });
});
