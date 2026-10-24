import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AskCoverageLeads, AskCoverageLeadsList, linkName, wantsCoverageLeads } from './AskCoverageLeads';
import { COVERAGE_LEADS_UI_ENABLED } from '@/lib/ask/coverageLeadsActivation';
import { safeLeadHref, sanitizeCoverageLeads, type CoverageLeadsResult } from '@/lib/api/coverageLeadsApi';
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

describe('CTO R168 · the control exists only with the switch on, for an explicit news question', () => {
  it('the switch is a code constant, ON at the activation SHA (E1 V5 + H + L + CTO R169), never an environment variable', () => {
    /* R169 · activation is this one reviewed commit; rollback is the previous exact SHA (false) */
    expect(COVERAGE_LEADS_UI_ENABLED).toBe(true);
    const source = readFileSync(join(__dirname, 'AskCoverageLeads.tsx'), 'utf8');
    expect(source).not.toMatch(/process.env/);
  });

  it.each([
    ['CURRENT_REPORTING', false, true, true],
    ['CURRENT_STATUS_VERIFICATION', false, true, true],
    ['CURRENT_REPORTING', false, false, false],
    ['REFERENCE', false, true, false],
    ['HISTORICAL', false, true, false],
    ['PERSONAL_INTELLIGENCE', false, true, false],
    ['COMPUTATION', false, true, false],
    [undefined, false, true, false],
    ['CURRENT_REPORTING', true, true, false],
  ])('class %p · displayOnly %p · switch %p → control: %p', (questionClass, displayOnly, switchOn, expected) => {
    expect(wantsCoverageLeads(questionClass, displayOnly, switchOn)).toBe(expected);
  });
});

describe('CTO R168 · nothing is sent until the reader asks', () => {
  const props = { question: 'Kenya economy this week?', questionClass: 'CURRENT_REPORTING', locale: 'en' as const, displayOnly: false };

  it('switch off: nothing renders and nothing is sent', () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch' as never);
    expect(renderToStaticMarkup(createElement(AskCoverageLeads, { ...props, switchOn: false }))).toBe('');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('switch on: rendering shows only the "Show coverage leads" button and sends nothing', () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch' as never);
    const html = renderToStaticMarkup(createElement(AskCoverageLeads, { ...props, switchOn: true }));
    expect(html).toContain('data-ask="coverage-leads-show"');
    expect(html).toContain('min-h-[44px]');
    expect(html).not.toContain('rounded-[12px]'); // H R168 E3: no frame around the lone button
    expect(html).toContain('Show coverage leads from other outlets');
    expect(html).not.toContain('coverage-lead-link');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('the panel has no effect hook: a render can never trigger a request', () => {
    const source = readFileSync(join(__dirname, 'AskCoverageLeads.tsx'), 'utf8');
    expect(source).not.toMatch(/useEffect|useLayoutEffect/);
  });
});

describe('CTO R168 · the browser re-checks what it renders', () => {
  it.each(['http://outlet.example.org/a', 'javascript:alert(1)', 'data:text/html,x', 42, null])('an unsafe link is dropped: %p', (url) => {
    expect(safeLeadHref(url)).toBeNull();
  });

  it('keeps at most five display-field leads; a title, snippet, language or country never survives', () => {
    const outcome = sanitizeCoverageLeads({
      state: 'LEADS',
      attribution: GDELT,
      leads: Array.from({ length: 7 }, (_, i) => lead(i, { title: 'PUBLISHER HEADLINE', snippet: 'body text' })),
    });
    expect(outcome.kind).toBe('LEADS');
    const leads = outcome.kind === 'LEADS' ? outcome.result.leads : [];
    expect(leads).toHaveLength(5);
    expect(Object.keys(leads[0]).sort()).toEqual(['outlet', 'seenByGdeltAt', 'url']);
    expect(JSON.stringify(outcome)).not.toMatch(/PUBLISHER HEADLINE|body text|Kenya|English/);
  });

  it.each([
    [{ state: 'NONE', leads: [], attribution: GDELT }, 'NONE'],
    [{ state: 'NO_PLACE', leads: [], attribution: GDELT }, 'NONE'],
    [{ state: 'MULTI_PLACE', leads: [], attribution: GDELT }, 'NONE'],
    [{ state: 'SUPPRESSED', leads: [], attribution: GDELT }, 'NONE'],
    [{ state: 'OFF', leads: [], attribution: GDELT }, 'UNAVAILABLE'],
    [{ state: 'NOT_AUTHORIZED', leads: [], attribution: GDELT }, 'UNAVAILABLE'],
    [{ state: 'CAPACITY', leads: [], attribution: GDELT }, 'UNAVAILABLE'],
    [{ state: 'LEADS', leads: [lead(1)], attribution: { ...GDELT, link: 'https://evil.example/' } }, 'UNAVAILABLE'],
    [{ state: 'LEADS', leads: [lead(1, { url: 'http://x.example/a' })], attribution: GDELT }, 'NONE'],
    [{ state: 'LEADS', leads: [lead(1, { seenByGdeltAt: 'yesterday' })], attribution: GDELT }, 'NONE'],
    [null, 'UNAVAILABLE'],
    ['<html>', 'UNAVAILABLE'],
  ])('a body that is not usable leads shows a plain state, never a list (%#)', (body, kind) => {
    expect(sanitizeCoverageLeads(body).kind).toBe(kind);
  });
});

describe('CTO R168 · what the reader sees after asking', () => {
  const outcome = sanitizeCoverageLeads({
    state: 'LEADS',
    attribution: GDELT,
    leads: [lead(1), lead(2, { outlet: '<img src=x onerror=alert(1)>' })],
  });
  const result = (outcome.kind === 'LEADS' ? outcome.result : null) as CoverageLeadsResult;
  const html = renderToStaticMarkup(createElement(AskCoverageLeadsList, { result, locale: 'en' }));

  it('the CTO heading, the not-verified note, and "Seen by GDELT" — never "published"', () => {
    expect(html).toContain('Coverage leads — not verified reports');
    expect(html).toContain('GlobalNewsAI has not read or verified these reports, and they are not sources for this answer.');
    expect(html).toContain('Seen by GDELT');
    expect(html).not.toMatch(/[Pp]ublished/);
  });

  it('each link is an explicit "Read original ↗": new tab, noopener, noreferrer, no referrer', () => {
    const links = html.match(/<a [^>]*data-ask="coverage-lead-link"[^>]*>/g) ?? [];
    expect(links).toHaveLength(2);
    for (const a of links) {
      expect(a).toContain('target="_blank"');
      expect(a).toMatch(/rel="noopener noreferrer nofollow"/);
      expect(a).toContain('referrerPolicy="no-referrer"');
    }
    expect(html).toContain('Read original ↗');
  });

  it('H R168 · every control is a 44 px target; the accessible name carries no arrow glyph', () => {
    const anchors = html.match(/<a [^>]*>/g) ?? [];
    expect(anchors.length).toBeGreaterThanOrEqual(3);
    for (const a of anchors) expect(a).toContain('min-h-[44px]');
    for (const label of html.match(/aria-label="[^"]*"/g) ?? []) expect(label).not.toContain('↗');
    expect(html).toContain('aria-label="Read original — outlet1.example.org');
  });

  it('H R168 · outlet and time are bidi-isolated; names wrap at word boundaries', () => {
    expect(html).toMatch(/data-ask="coverage-lead-outlet" class="break-words[^"]*" style="unicode-bidi:isolate"/);
    expect(html).not.toContain('break-all');
  });

  it('H R168 · an unformattable time is dropped, never shown raw', () => {
    const odd = { leads: [{ outlet: 'outlet9.example.org', url: 'https://outlet9.example.org/a', seenByGdeltAt: 'not-a-time' }], attribution: GDELT };
    const markup = renderToStaticMarkup(createElement(AskCoverageLeadsList, { result: odd, locale: 'en' }));
    expect(markup).not.toContain('Seen by GDELT');
    expect(markup).not.toContain('not-a-time');
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

describe('L R168 · no direction-control character in any coverage-leads string', () => {
  /* written as escapes, never as literal characters */
  const BIDI_CONTROL = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\u061C]/u;

  it('positive control: the guard finds a planted control character', () => {
    expect(BIDI_CONTROL.test(`x${String.fromCharCode(0x200f)}y`)).toBe(true);
  });

  it.each(['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar'])('%s carries none', (locale) => {
    const s = askCoverageLeadsStrings(locale);
    for (const value of [s.heading, s.note, s.readOriginal, s.opensOutlet, s.credit, s.show, s.loading, s.none, s.unavailable, s.seenBy('X')]) {
      expect(BIDI_CONTROL.test(value)).toBe(false);
    }
  });

  it('Arabic: the heading uses the governed "not verified" lexeme and the link glyph points up-left', () => {
    const s = askCoverageLeadsStrings('ar');
    expect(s.heading).toContain('غير مُتحقَّق منها');
    expect(s.readOriginal.endsWith('↖')).toBe(true);
  });
});

describe('CTO R168 · seven locales', () => {
  it.each(['en', 'pl', 'fr', 'de', 'es', 'pt', 'ar'])('%s carries every string, and "seen" never reads as publication', (locale) => {
    const s = askCoverageLeadsStrings(locale);
    for (const value of [s.heading, s.note, s.readOriginal, s.opensOutlet, s.credit, s.show, s.loading, s.none, s.unavailable, s.seenBy('X')]) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
    expect(s.seenBy('X')).toContain('GDELT');
    expect(s.credit).toContain('GDELT');
    expect(linkName(s.readOriginal)).not.toMatch(/[↗↖]/u);
    expect(linkName(s.readOriginal).length).toBeGreaterThan(0);
    /* the markup renders the label then the time: every locale must put {time} last */
    expect(s.seenBy('§TIME§').endsWith('§TIME§')).toBe(true);
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
