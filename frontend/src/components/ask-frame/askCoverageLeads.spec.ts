import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AskCoverageLeadsList, wantsCoverageLeads } from './AskCoverageLeads';
import { safeLeadHref, sanitizeCoverageLeads } from '@/lib/api/coverageLeadsApi';
import { askCoverageLeadsStrings } from '@/lib/ask/askCoverageLeadsStrings';

const GDELT = { citation: 'The GDELT Project', link: 'https://www.gdeltproject.org/' };
const lead = (i: number, over: Record<string, unknown> = {}) => ({
  outlet: `outlet${i}.example.org`,
  url: `https://outlet${i}.example.org/business/story-${i}`,
  seenByGdeltAt: '2026-10-24T06:15:00.000Z',
  language: 'English',
  outletCountry: 'Kenya',
  ...over,
});

describe('CTO R168 · coverage leads appear only for an explicit news question', () => {
  it.each([
    ['CURRENT_REPORTING', false, true],
    ['CURRENT_STATUS_VERIFICATION', false, true],
    ['REFERENCE', false, false],
    ['HISTORICAL', false, false],
    ['PERSONAL_INTELLIGENCE', false, false],
    ['COMPUTATION', false, false],
    [undefined, false, false],
    ['CURRENT_REPORTING', true, false],
  ])('class %p (displayOnly %p) → asks for leads: %p', (questionClass, displayOnly, expected) => {
    expect(wantsCoverageLeads(questionClass, displayOnly)).toBe(expected);
  });
});

describe('CTO R168 · the browser re-checks what it renders', () => {
  it.each(['http://outlet.example.org/a', 'javascript:alert(1)', 'data:text/html,x', 'https://u:p@outlet.example.org/a', 42, null])(
    'an unsafe link is dropped: %p',
    (url) => {
      expect(safeLeadHref(url)).toBeNull();
    },
  );

  it('keeps at most five fields-only leads; any extra field (a title) never survives', () => {
    const result = sanitizeCoverageLeads({
      state: 'LEADS',
      attribution: GDELT,
      leads: Array.from({ length: 7 }, (_, i) => lead(i, { title: 'PUBLISHER HEADLINE', snippet: 'body text' })),
    });
    expect(result?.leads).toHaveLength(5);
    expect(Object.keys(result!.leads[0]).sort()).toEqual(['language', 'outlet', 'outletCountry', 'seenByGdeltAt', 'url']);
    expect(JSON.stringify(result)).not.toMatch(/PUBLISHER HEADLINE|body text/);
  });

  it.each([
    [{ state: 'OFF', leads: [], attribution: GDELT }],
    [{ state: 'NONE', leads: [], attribution: GDELT }],
    [{ state: 'LEADS', leads: [lead(1)], attribution: { ...GDELT, link: 'https://evil.example/' } }],
    [{ state: 'LEADS', leads: [lead(1, { url: 'http://x.example/a' })], attribution: GDELT }],
    [{ state: 'LEADS', leads: [lead(1, { seenByGdeltAt: 'yesterday' })], attribution: GDELT }],
    [null],
    ['<html>'],
  ])('anything but a usable LEADS body renders nothing (%#)', (body) => {
    expect(sanitizeCoverageLeads(body)).toBeNull();
  });
});

describe('CTO R168 · what the reader sees', () => {
  const result = sanitizeCoverageLeads({
    state: 'LEADS',
    attribution: GDELT,
    leads: [lead(1), lead(2, { outlet: '<img src=x onerror=alert(1)>' })],
  })!;
  const html = renderToStaticMarkup(createElement(AskCoverageLeadsList, { result, locale: 'en' }));

  it('the CTO heading, the not-verified note, and "Seen by GDELT" — never "published"', () => {
    expect(html).toContain('Coverage leads — not verified reports');
    expect(html).toContain('GlobalNewsAI has not read or verified these reports, and they are not sources for this answer.');
    expect(html).toContain('Seen by GDELT');
    expect(html).not.toMatch(/[Pp]ublished/);
  });

  it('each link is an explicit "Read original ↗", new tab, no opener, no referrer', () => {
    const links = html.match(/<a [^>]*data-ask="coverage-lead-link"[^>]*>/g) ?? [];
    expect(links).toHaveLength(2);
    for (const a of links) {
      expect(a).toContain('target="_blank"');
      expect(a).toMatch(/rel="noopener noreferrer nofollow"/);
      expect(a).toContain('referrerPolicy="no-referrer"');
    }
    expect(html).toContain('Read original ↗');
  });

  it('an outlet name is plain text, never markup', () => {
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('the GDELT credit links to https://www.gdeltproject.org/', () => {
    expect(html).toMatch(/<a href="https:\/\/www\.gdeltproject\.org\/"[^>]*>Leads from The GDELT Project<\/a>/);
  });

  it('no count, citation or source wording is rendered', () => {
    expect(html).not.toMatch(/sources searched|citation|\bcited\b|\d+ sources/i);
  });
});

describe('CTO R168 · seven locales', () => {
  it.each(['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar'])('%s carries every string, and "seen" never reads as publication', (locale) => {
    const s = askCoverageLeadsStrings(locale);
    for (const value of [s.heading, s.note, s.readOriginal, s.opensOutlet, s.credit, s.seenBy('X')]) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
    expect(s.seenBy('X')).toContain('GDELT');
    expect(s.credit).toContain('GDELT');
    if (locale !== 'en') expect(s.heading).not.toBe(askCoverageLeadsStrings('en').heading);
  });
});

describe('CTO R168 · leads never reach the answer, Sources or any count', () => {
  const src = resolve(__dirname, '../..');
  const importers = (needle: RegExp): string[] => {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.spec.ts') && needle.test(readFileSync(path, 'utf8'))) {
          found.push(path.slice(src.length + 1).split('\\').join('/'));
        }
      }
    };
    walk(src);
    return found.sort();
  };

  it('only the panel imports the leads API, and only the turn view renders the panel', () => {
    expect(importers(/coverageLeadsApi'/)).toEqual(['components/ask-frame/AskCoverageLeads.tsx']);
    expect(importers(/from '\.\/AskCoverageLeads'|ask-frame\/AskCoverageLeads'/)).toEqual(['components/ask-frame/AskR2TurnView.tsx']);
  });
});
