import { readFileSync } from 'fs';
import { join } from 'path';
import tailwindConfig from '../../../tailwind.config';

jest.mock('@/components/ui/SafeImage', () => ({ SafeImage: () => null }));

import {
  CATEGORY_CHANNEL,
  TREND_NEUTRAL_CHANNEL,
  TRANSPARENT_PIXEL,
  categoryChannel,
  decorate,
} from '@/components/home/TrendingCard';

const source = readFileSync(join(__dirname, 'TrendingCard.tsx'), 'utf-8');

type ThemeExtend = Record<string, Record<string, unknown>>;
const themeExtend = (tailwindConfig.theme?.extend ?? {}) as unknown as ThemeExtend;

const codeOnly = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * The eight values the repository's own classifier can actually produce:
 * seven rule categories plus the `world` default. Nothing else can reach a
 * card, which is why the BREAKING variant is unreachable and why three of
 * these have no released colour.
 */
const PRODUCTION_CATEGORIES = [
  'world',
  'politics',
  'business',
  'technology',
  'science',
  'health',
  'sports',
  'entertainment',
] as const;

/* ─────────────── 1. the decorate() derivation, executed ─────────────── */

describe('TrendingCard — GN-CD-110 decorate() derivation', () => {
  it('maps only the categories the CTO approved, and nothing else', () => {
    // Exact released matches.
    expect(CATEGORY_CHANNEL.politics).toBe('96,165,250');
    expect(CATEGORY_CHANNEL.technology).toBe('167,139,250');
    expect(CATEGORY_CHANNEL.health).toBe('34,211,238');
    // Approved presentation analogues (CTO decision D-1).
    expect(CATEGORY_CHANNEL.business).toBe('52,211,153');
    expect(CATEGORY_CHANNEL.science).toBe('251,146,60');
    // No other mapping exists — in particular none was invented for the three
    // production categories the design never assigned a colour to.
    expect(Object.keys(CATEGORY_CHANNEL).sort()).toEqual(
      ['business', 'health', 'politics', 'science', 'technology'],
    );
  });

  it('falls back to ONE existing released neutral, which asserts nothing about the story', () => {
    // GN-CD-307 reserves cyan as the neutral system colour that never signals
    // urgency or identity. It is the released accent.sky value, not a new one.
    expect(TREND_NEUTRAL_CHANNEL).toBe('56,189,248');
    const accent = (themeExtend.colors.cd as Record<string, Record<string, string>>).accent;
    expect(accent.sky).toBe('#38bdf8');
    for (const category of ['world', 'sports', 'entertainment']) {
      expect(categoryChannel(category)).toBe(TREND_NEUTRAL_CHANNEL);
    }
  });

  it('never introduces a semantic colour the design reserves for states production cannot have', () => {
    const channels = Object.values(CATEGORY_CHANNEL).concat(TREND_NEUTRAL_CHANNEL);
    // #f87171 red is GN-CD-303's Level 1 urgent colour and GN-CD-307 rations
    // it to genuinely breaking content, which this rail can never identify.
    expect(channels).not.toContain('248,113,113');
    expect(codeOnly(source)).not.toContain('248,113,113');
  });

  it('returns a complete, well-formed composition for every category production can emit', () => {
    for (const category of PRODUCTION_CATEGORIES) {
      const visual = decorate(category);
      expect(visual.channel).toMatch(/^\d{1,3},\d{1,3},\d{1,3}$/);
      // GN-CD-110's exact recipe: a 165deg base, a radial highlight, 1px
      // scanlines every 4px and a 115deg category hatch every 11px.
      expect(visual.tile).toContain('linear-gradient(165deg');
      expect(visual.tile).toContain('radial-gradient(70% 45% at 30% 18%');
      expect(visual.tile).toContain(`rgba(${visual.channel},.5)`);
      expect(visual.tile).toContain(`rgba(${visual.channel},.55)`);
      expect(visual.tile).toContain('rgba(8,20,40,.85) 58%');
      expect(visual.tile).toContain('rgba(4,8,16,.95)');
      expect(visual.texture).toContain('repeating-linear-gradient(0deg,rgba(255,255,255,.055) 0 1px,transparent 1px 4px)');
      expect(visual.texture).toContain(`repeating-linear-gradient(115deg,rgba(${visual.channel},.22) 0 2px,transparent 2px 11px)`);
    }
  });

  it('never returns undefined, whatever the provider sends', () => {
    for (const input of [null, undefined, '', 'a-category-that-does-not-exist', 'POLITICS']) {
      const visual = decorate(input);
      expect(visual.channel).toBeDefined();
      expect(visual.tile.length).toBeGreaterThan(0);
      expect(visual.texture.length).toBeGreaterThan(0);
    }
    // Case-insensitive, so a provider that upper-cases still gets its colour.
    expect(categoryChannel('POLITICS')).toBe(CATEGORY_CHANNEL.politics);
  });
});

/* ───────────────────── 2. released card geometry ───────────────────── */

describe('TrendingCard — GN-CD-109 released geometry', () => {
  it('is one anchor carrying both released compositions', () => {
    expect((source.match(/<a\s/g) ?? []).length).toBe(1);
    expect(source).toMatch(/flex-col overflow-hidden/);
    expect(source).toMatch(/cd-hero:flex-row/);
  });

  it('uses the released desktop card values', () => {
    expect(source).toMatch(/cd-hero:w-cd-280/);
    expect(source).toMatch(/cd-hero:gap-cd-11/);
    expect(source).toMatch(/cd-hero:rounded-cd-12/);
    expect(source).toMatch(/cd-hero:border-cd-edge-card\b/);
    expect(source).toMatch(/cd-hero:bg-cd-fill-trend-card\b/);
    expect(source).toMatch(/cd-hero:p-cd-9/);
    expect(source).toMatch(/cd-hero:shadow-\[0_0_14px_rgba\(var\(--tc-ch\),0\.07\)\]/);
  });

  it('uses the released mobile card values', () => {
    expect(source).toMatch(/w-cd-246 /);
    expect(source).toMatch(/rounded-cd-14/);
    expect(source).toMatch(/border-cd-edge-card-mobile/);
    expect(source).toMatch(/bg-cd-fill-trend-card-m/);
    expect(source).toMatch(/shadow-\[0_0_12px_rgba\(var\(--tc-ch\),0\.07\)\]/);
    expect(source).toMatch(/bg-cd-fill-trend-body-m px-cd-12 pb-cd-12 pt-cd-11/);
  });

  it('uses the released media geometry at both viewports', () => {
    expect(source).toMatch(/h-cd-112 w-full flex-none overflow-hidden cd-hero:h-cd-78 cd-hero:w-cd-74 cd-hero:rounded-cd-9/);
    expect(source).toMatch(/cd-hero:border-\[color:rgba\(var\(--tc-ch\),0\.4\)\]/);
    expect(source).toMatch(/opacity-70 cd-hero:opacity-75/);
  });

  it('uses the released hover treatment — two named properties at 180ms, not transition-all', () => {
    expect(source).toMatch(/cd-hero:transition-\[transform,box-shadow\] cd-hero:duration-cd-180/);
    expect(source).toMatch(/cd-hero:hover:border-cd-edge-hover/);
    expect(source).toMatch(/cd-hero:hover:bg-cd-fill-trend-hover/);
    expect(source).toMatch(/cd-hero:hover:shadow-cd-trend-hover/);
    expect(source).toMatch(/cd-hero:motion-safe:hover:-translate-y-cd-2/);
    expect(codeOnly(source)).not.toMatch(/transition-all/);
    expect((themeExtend.transitionDuration as unknown as Record<string, string>)['cd-180']).toBe('180ms');
  });

  it('uses the released type roles — and IBM Plex Sans on the headline at BOTH viewports', () => {
    // ERRATUM-006: the mobile trending headline declares no font-family and
    // must inherit IBM Plex Sans. The pre-M66.4 card set Space Grotesk, which
    // is exactly the mistake the erratum exists to prevent.
    expect(source).toMatch(/font-cd-body text-cd-card-head-m/);
    expect(source).toMatch(/cd-hero:text-cd-card-head\b/);
    expect(codeOnly(source)).not.toMatch(/font-cd-display|font-display/);
    const fontSize = themeExtend.fontSize as unknown as Record<string, [string, Record<string, string>]>;
    expect(fontSize['cd-card-head']).toEqual(['13px', { lineHeight: '1.32', fontWeight: '600' }]);
    expect(fontSize['cd-card-head-m']).toEqual(['14.5px', { lineHeight: '1.32', fontWeight: '600' }]);
    expect(fontSize['cd-mono-meta'][0]).toBe('10.5px');
    expect(fontSize['cd-mono-meta-m']).toEqual(['9.5px', { letterSpacing: '0.10em' }]);
    expect(fontSize['cd-mono-chip-m']).toEqual(['9px', { letterSpacing: '0.12em' }]);
    expect(fontSize['cd-mono-readout']).toEqual(['10px', { letterSpacing: '0.14em' }]);
  });

  it('places the category as a chip over the media on mobile and as a text row on desktop', () => {
    expect(source).toMatch(/absolute left-cd-10 top-cd-9 inline-flex items-center rounded-cd-5/);
    expect(source).toMatch(/bg-cd-fill-chip-m px-cd-7 py-cd-3/);
    expect(source).toMatch(/hidden font-cd-mono text-cd-mono-readout uppercase[\s\S]{0,60}cd-hero:block/);
    // Category is carried by colour AND text together (GN-CD-307): the chip,
    // the desktop row, and the card's own accessible name — three uses of the
    // one localized label, never a colour-only signal.
    // Two JSX renderings — the mobile chip and the desktop row. The third
    // occurrence in the file is the interpolation inside the accessible name.
    expect((source.match(/>\s*\{categoryLabel\}/g) ?? []).length).toBe(2);
    expect(source).toMatch(/const accessibleName = `\$\{categoryLabel\}: /);
  });

  it('keeps the production headline clamp (CTO decision D-8)', () => {
    // GN-CD-112 authors no clamp; UNRESOLVED-028 records that real headlines
    // over ~70 characters unbalance the whole rail through flex stretch.
    expect((source.match(/line-clamp-2/g) ?? []).length).toBe(1);
  });
});

/* ─────────────────── 3. real data, honest fallbacks ─────────────────── */

describe('TrendingCard — real data and honest fallbacks', () => {
  it('renders only real NewsArticle fields', () => {
    for (const field of ['article.url', 'article.title', 'article.imageUrl', 'article.category', 'article.publishedAt', 'article.sourcesCount']) {
      expect(source).toContain(field);
    }
  });

  it('introduces no fetch, no state, no timer and no client boundary of its own', () => {
    const code = codeOnly(source);
    expect(code).not.toMatch(/fetch\(|useState|useEffect|useRef|setInterval|setTimeout/);
    expect(source.trimStart().startsWith("'use client'")).toBe(false);
  });

  it('shows the released category composition when a story has no photograph', () => {
    expect(source).toMatch(/\{article\.imageUrl \? \(/);
    expect(source).toMatch(/style=\{\{ backgroundImage: visual\.tile \}\}/);
    expect(source).toMatch(/style=\{\{ backgroundImage: visual\.texture \}\}/);
  });

  it('reveals the same composition when a photograph fails, without touching the protected SafeImage', () => {
    expect(TRANSPARENT_PIXEL.startsWith('data:image/gif;base64,')).toBe(true);
    expect(source).toMatch(/fallbackSrc=\{TRANSPARENT_PIXEL\}/);
    // The generic stock placeholder is no longer this card's fallback.
    expect(codeOnly(source)).not.toMatch(/article-placeholder\.jpg/);
  });

  it('never claims a corroboration the data does not support', () => {
    expect(source).toMatch(/article\.sourcesCount > 1 \?/);
    expect(source).toMatch(/pluralWithForms\(article\.sourcesCount, language, t\.sourceForms\)/);
    // The source clause is omitted from the accessible name too, not just the
    // visible metadata.
    expect(source).toMatch(/\$\{sources \? `, \$\{sources\}` : ''\}/);
  });

  it('is a real link with a real destination and a real focus indicator', () => {
    expect(source).toMatch(/href=\{article\.url\}/);
    expect(source).toMatch(/target="_blank"/);
    expect(source).toMatch(/rel="noopener noreferrer"/);
    expect(source).toMatch(/focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-cd-edge-focus/);
    // GN-CD-109 wires role="link" and tabIndex onto a div and then reports
    // DEFECT-014, no focus indicator. Neither applies to a real anchor.
    expect(codeOnly(source)).not.toMatch(/role="link"|tabIndex/);
  });

  it('does not announce the story title twice', () => {
    // The card's own accessible name already carries the title, so the
    // photograph is decorative.
    expect(source).toMatch(/alt=""/);
  });

  it('requests exactly one image per story, at the released sizes for each viewport', () => {
    expect((source.match(/<SafeImage/g) ?? []).length).toBe(1);
    expect(source).toMatch(/sizes="\(min-width: 1240px\) 74px, 246px"/);
    expect(source).toMatch(/priority=\{isLead\}/);
  });
});
