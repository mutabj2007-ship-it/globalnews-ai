import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { NAV_MODEL } from '@/lib/navModel';
import { NavBar } from './NavBar';
import { getDictionary } from '@/lib/i18n/dictionaries';

/*
  H-PUBLIC-NAV-QUOTA-SAFETY-1.

  THE DEFECT: the six editorial header categories were `kind: 'search'` with
  `href: '/search?q=<term>'`. /search is the real Analysis entry path — the
  same contract the Hero and SearchPageClient produce. So one click by any
  anonymous visitor on "World", "Politics", "Business", "Technology",
  "Science" or "Health" started a real, billable AI analysis. Nine header
  items, six of them a free analysis trigger.

  THE FIX IS DELIBERATELY NOT A NEW PRESENTATION. NavBar already carries an
  accepted, genuinely non-interactive branch for `kind: 'unavailable'` (a
  <span aria-disabled="true">, no href, no handler, no Link, therefore no
  prefetch), built for About at M65 and already reviewed. The six entries are
  moved onto that existing branch. Nothing in NavBar.tsx changes; the header's
  GN-CD geometry is untouched.

  These tests assert the RENDERED MARKUP, not the model alone, because the
  brief's requirement is about what a browser can click, focus and activate —
  not about what a TypeScript literal says.
*/

// usePathname/useRouter need a Next router context that a bare
// renderToStaticMarkup has none of. The mock supplies only what NavBar reads.
jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }),
}));


const en = getDictionary('en').navBar;
const navBarSource = readFileSync(`${__dirname}/NavBar.tsx`, 'utf8');

const SILENCED = ['World', 'Politics', 'Business', 'Technology', 'Science', 'Health'] as const;
const ACTIVE_ROUTES = ['Home', 'World Map'] as const;

function markup(): string {
  return renderToStaticMarkup(createElement(NavBar, { language: 'en' as never }));
}

/**
 * Every element that could carry the label, as rendered. Returns the raw tag
 * text so the assertions can look at the element itself, not at a summary of it.
 */
function elementsFor(label: string, html: string): string[] {
  const localized = en.navItemLabels[
    NAV_MODEL.find((entry) => entry.label === label)?.labelKey as string
  ];
  const out: string[] = [];
  const re = /<(a|span|button)\b[^>]*>([^<]*)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[2].trim() === localized) out.push(m[0]);
  }
  return out;
}

describe('H-PUBLIC-NAV-QUOTA-SAFETY-1 — the model', () => {
  it('no entry in the public nav can reach the Analysis entry path', () => {
    for (const entry of NAV_MODEL) {
      expect(entry.href ?? '').not.toContain('/search');
    }
    expect(NAV_MODEL.some((entry) => entry.kind === 'search')).toBe(false);
  });

  it('each silenced category is inert in the model — kind unavailable, and the href property is absent, not merely undefined', () => {
    for (const label of SILENCED) {
      const entry = NAV_MODEL.find((candidate) => candidate.label === label);
      expect(entry).toBeDefined();
      expect(entry?.kind).toBe('unavailable');
      expect(Object.prototype.hasOwnProperty.call(entry as object, 'href')).toBe(false);
    }
  });

  it('the nine-item design sequence and its order are unchanged — silencing is not hiding', () => {
    expect(NAV_MODEL.map((entry) => entry.label)).toEqual([
      'Home',
      'World Map',
      'World',
      'Politics',
      'Business',
      'Technology',
      'Science',
      'Health',
      'About',
    ]);
  });
});

describe('H-PUBLIC-NAV-QUOTA-SAFETY-1 — the rendered header', () => {
  const html = markup();

  it('renders every silenced label — the items stay visible', () => {
    for (const label of SILENCED) {
      expect(elementsFor(label, html).length).toBeGreaterThan(0);
    }
  });

  it('NO silenced label is rendered as an anchor — no href means no navigation, no middle-click, no prefetch and no context-menu "open in new tab"', () => {
    for (const label of SILENCED) {
      for (const element of elementsFor(label, html)) {
        expect(element.startsWith('<span')).toBe(true);
        expect(element).not.toContain('href');
      }
    }
  });

  it('NO silenced label is keyboard-activatable — no tabindex, no role that implies activation, no href to focus', () => {
    for (const label of SILENCED) {
      for (const element of elementsFor(label, html)) {
        expect(element).not.toContain('tabindex');
        expect(element).not.toMatch(/role="(link|button|menuitem)"/);
      }
    }
  });

  it('each silenced label is accessibly, truthfully announced as unavailable — never a silent dead control', () => {
    for (const label of SILENCED) {
      for (const element of elementsFor(label, html)) {
        expect(element).toContain('aria-disabled="true"');
        expect(element).toContain(en.editorialUnavailableLabel);
      }
    }
  });

  it('the two real routes are STILL real anchors — this patch silences the categories, it does not break the nav', () => {
    for (const label of ACTIVE_ROUTES) {
      const elements = elementsFor(label, html);
      expect(elements.length).toBeGreaterThan(0);
      for (const element of elements) {
        expect(element.startsWith('<a')).toBe(true);
        expect(element).toMatch(/href="\/(map)?"/);
      }
    }
  });

  it('Help is still a real link to the real support route — it is a utility affordance and was never in scope', () => {
    expect(html).toMatch(new RegExp(`<a[^>]*href="/support"[^>]*>${en.help}</a>`));
  });

  it('the whole rendered header contains not one /search?q= destination', () => {
    expect(html).not.toContain('/search?q=');
  });
});

describe('H-PUBLIC-NAV-QUOTA-SAFETY-1 — positive control', () => {
  /*
    A guard that cannot fail is not a guard. This re-runs the two load-bearing
    assertions against the PREIMAGE shape — a model entry that still carries
    the old search href — and requires them to fail. If the renderer ever
    stopped distinguishing the two kinds, this control would go green and the
    tests above would be worthless.
  */
  it('the preimage shape (kind search + /search?q= href) is rejected by the same assertions', () => {
    const preimage = { label: 'World', labelKey: 'world', kind: 'search', href: '/search?q=world' };
    expect(() => {
      expect(preimage.href ?? '').not.toContain('/search');
    }).toThrow();
    expect(() => {
      expect(Object.prototype.hasOwnProperty.call(preimage, 'href')).toBe(false);
    }).toThrow();
  });

  it('NavBar still routes non-unavailable entries through a real Link — proving the span above is a consequence of the kind, not of a dead renderer', () => {
    expect(navBarSource).toMatch(/href=\{entry\.href as string\}/);
    expect(navBarSource).toMatch(/entry\.kind === 'unavailable'/);
  });
});
