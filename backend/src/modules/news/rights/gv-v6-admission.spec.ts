import { admitGlobalVoicesPage, GV_LICENCE } from './gv-v6-admission';

/*
  E1 V6 C-GV1…C-GV9 + G R175 T1–T6. SYNTHETIC pages shaped on the furniture G measured (and Main
  re-read 2026-10-24: contributor-name/credit-label blocks, span.post-date, a[rel=license],
  link[rel=canonical]). No real capture is committed; names and slugs are invented.
*/
const URL_ = 'https://globalvoices.org/2026/10/22/a-synthetic-original-report/';

interface Page {
  canonical?: string | null;
  contributors?: { label: string; name: string; href: string }[];
  date?: string | null;
  licence?: string[];
  body?: string;
  sidebar?: string;
}

function page(p: Page = {}): string {
  const canonical = p.canonical === undefined ? URL_ : p.canonical;
  const contributors = p.contributors ?? [
    {
      label: 'Written by',
      name: 'Amara Okonjo',
      href: 'https://globalvoices.org/author/amara-okonjo/',
    },
  ];
  const credits = contributors
    .map(
      (c) =>
        `<div class='contributor'><div class='contributor-name'><span class='credit-label'>${c.label}</span><a href='${c.href}' class='user-link'>${c.name}</a></div></div>`,
    )
    .join('');
  const date =
    p.date === undefined
      ? `Posted <a href='https://globalvoices.org/2026/10/22/'>22 October 2026</a>`
      : p.date;
  const licence = (p.licence ?? [GV_LICENCE.url])
    .map((h) => `<a rel='license' href='${h}' title='Creative Commons'></a>`)
    .join('');
  return [
    '<html><head>',
    canonical === null ? '' : `<link rel="canonical" href="${canonical}" />`,
    '</head><body><article>',
    credits,
    date === null ? '' : `<span class='post-date'>${date}</span>`,
    `<div class='entry'>${p.body ?? '<p>Power cuts spread across the region this week.</p>'}</div>`,
    `<div class='license'>${licence}</div>`,
    credits,
    '</article>',
    `<aside>${p.sidebar ?? ''}</aside>`,
    '</body></html>',
  ].join('');
}

describe('E1 V6 · Global Voices admission on the article page', () => {
  it('T6 positive control: a bare "Written by <person>" original on the cleared host is ADMITTED', () => {
    expect(admitGlobalVoicesPage(URL_, page())).toEqual({
      outcome: 'ADMIT',
      admissionClass: 'A_GV_ORIGINAL',
      author: { name: 'Amara Okonjo', profileUrl: 'https://globalvoices.org/author/amara-okonjo/' },
      publishedOn: '2026-10-22',
      canonicalUrl: URL_,
      licence: GV_LICENCE,
      dropMedia: true,
    });
  });

  describe('T1 · the provenance markers are load-bearing (G W-2)', () => {
    const sharing =
      '<p>It is being published on Global Voices as part of a content-sharing agreement.</p>';

    it('a content-sharing sentence EXCLUDES even though the byline resolves', () => {
      const v = admitGlobalVoicesPage(URL_, page({ body: sharing }));
      expect(v.outcome).toBe('EXCLUDE');
      expect(v).toMatchObject({ reason: 'CONTENT_PROVENANCE_MARKER' });
    });

    it('mutation: the same page with that sentence stripped ADMITS — the marker alone decided', () => {
      expect(admitGlobalVoicesPage(URL_, page({ body: '<p>Power cuts.</p>' })).outcome).toBe(
        'ADMIT',
      );
    });

    it.each([
      'This story was originally published by Example Weekly.',
      'It is republished on Global Voices with thanks.',
      'Shared under a content partnership agreement.',
      'Shared under a content sharing agreement.',
      'Example Weekly is a content partner of Global Voices.',
      'This piece is published on Global Voices with permission.',
    ])('marker %p excludes', (sentence) => {
      expect(admitGlobalVoicesPage(URL_, page({ body: `<p>${sentence}</p>` })).outcome).toBe(
        'EXCLUDE',
      );
    });

    it('a republication with its markers stripped, footer only, is STILL refused (organisation byline)', () => {
      const v = admitGlobalVoicesPage(
        URL_,
        page({
          contributors: [
            {
              label: 'Written by',
              name: 'Example News Network',
              href: 'https://globalvoices.org/author/examplenews/',
            },
          ],
          body: '<p>Originally published on Global Voices.</p>',
        }),
      );
      expect(v.outcome).toBe('ATTRIBUTION_NOT_DETERMINISTIC');
    });

    it('never keys on "originally published" alone, nor on a funder "partnership" (W-3)', () => {
      for (const body of [
        '<p>Originally published on Global Voices.</p>',
        '<p>This report was produced in partnership with a civic fund.</p>',
        '<p>Les partenariats qui produisent des résultats mesurables.</p>',
      ]) {
        expect(admitGlobalVoicesPage(URL_, page({ body })).outcome).toBe('ADMIT');
      }
    });
  });

  it('T2: the author is the page byline — the feed dc:creator is never an input', () => {
    expect(admitGlobalVoicesPage.length).toBe(2);
    const v = admitGlobalVoicesPage(URL_, page());
    expect(v).toMatchObject({ author: { name: 'Amara Okonjo' } });
  });

  describe('T3 · C-GV5 + C-GV6 — translations and copy-time dates', () => {
    it('"Written (<Lang>) by" + a translator credit → EXCLUDE as B2 by default', () => {
      const v = admitGlobalVoicesPage(
        URL_,
        page({
          contributors: [
            {
              label: 'Written (Français) by',
              name: 'Jules Mbeki',
              href: 'https://fr.globalvoices.org/author/jules-mbeki/',
            },
            {
              label: 'Translated (English) by',
              name: 'Ana',
              href: 'https://globalvoices.org/author/ana-r/',
            },
          ],
          date: `Translation posted <a href='#'>19 October 2026</a>`,
        }),
      );
      expect(v).toEqual({ outcome: 'EXCLUDE', reason: 'TRANSLATION_B2_DEFAULT', dropMedia: true });
    });

    it('"Translation posted" alone is never a publication date — B2', () => {
      const v = admitGlobalVoicesPage(
        URL_,
        page({ date: `Translation posted <a href='#'>19 October 2026</a>` }),
      );
      expect(v).toMatchObject({ outcome: 'EXCLUDE', reason: 'TRANSLATION_B2_DEFAULT' });
    });

    it('no date, or an unparseable one → not deterministic, never a guessed date', () => {
      expect(admitGlobalVoicesPage(URL_, page({ date: null }))).toMatchObject({
        reason: 'NO_PUBLICATION_DATE',
      });
      expect(admitGlobalVoicesPage(URL_, page({ date: 'Posted 31 February 2026' }))).toMatchObject({
        reason: 'NO_PUBLICATION_DATE',
      });
    });
  });

  describe('T4 · C-GV2 — organisations, placeholders, desks → ATTRIBUTION_NOT_DETERMINISTIC', () => {
    it.each([
      ['Example Digital Rights', 'https://globalvoices.org/author/exampledigitalrights/'],
      ['Guest Contributor', 'https://globalvoices.org/author/guest-contributor/'],
      ['Example Media', 'https://globalvoices.org/author/example-media/'],
      ['Amara', 'https://globalvoices.org/author/amara/'],
      ['Amara Okonjo', 'https://globalvoices.org/author/someone-else/'],
      ['Amara Okonjo', 'https://advox.globalvoices.org/author/amara-okonjo/'],
      ['Amara‮ Okonjo', 'https://globalvoices.org/author/amara-okonjo/'],
    ])('%p (%s)', (name, href) => {
      const v = admitGlobalVoicesPage(
        URL_,
        page({ contributors: [{ label: 'Written by', name, href }] }),
      );
      expect(v.outcome).toBe('ATTRIBUTION_NOT_DETERMINISTIC');
    });

    it('no byline, two authors, or a non-bare label → not deterministic', () => {
      expect(admitGlobalVoicesPage(URL_, page({ contributors: [] }))).toMatchObject({
        reason: 'NO_BYLINE',
      });
      const two = [
        {
          label: 'Written by',
          name: 'Amara Okonjo',
          href: 'https://globalvoices.org/author/amara-okonjo/',
        },
        {
          label: 'Written by',
          name: 'Tomas Reyes',
          href: 'https://globalvoices.org/author/tomas-reyes/',
        },
      ];
      expect(admitGlobalVoicesPage(URL_, page({ contributors: two }))).toMatchObject({
        reason: 'MULTIPLE_CONTRIBUTORS',
      });
      const by = [
        {
          label: 'By',
          name: 'Amara Okonjo',
          href: 'https://globalvoices.org/author/amara-okonjo/',
        },
      ];
      expect(admitGlobalVoicesPage(URL_, page({ contributors: by }))).toMatchObject({
        reason: 'BYLINE_LABEL_NOT_BARE',
      });
    });

    it('a promo card elsewhere on the page with an organisation byline does not count', () => {
      const promo = `<div class='text-credits-section'><span class='credit-label'>Written by</span> <a href='https://globalvoices.org/author/exampledigitalrights/' class='user-link'>Example Digital Rights</a></div>`;
      expect(admitGlobalVoicesPage(URL_, page({ sidebar: promo })).outcome).toBe('ADMIT');
    });
  });

  describe('C-GV8 · canonical read from the raw HTML, cleared host only', () => {
    it.each([
      [null, 'CANONICAL_MISSING'],
      ['http://globalvoices.org/2026/10/22/a-synthetic-original-report/', 'CANONICAL_MISSING'],
      [
        'https://advox.globalvoices.org/2026/10/22/a-synthetic-original-report/',
        'CANONICAL_HOST_NOT_CLEARED',
      ],
      [
        'https://fr.globalvoices.org/2026/10/22/a-synthetic-original-report/',
        'CANONICAL_HOST_NOT_CLEARED',
      ],
      [
        'https://globalvoices.org.example/2026/10/22/a-synthetic-original-report/',
        'CANONICAL_HOST_NOT_CLEARED',
      ],
      ['https://globalvoices.org/2026/10/21/a-different-report/', 'CANONICAL_NOT_THIS_ITEM'],
    ])('canonical %p → %s', (canonical, reason) => {
      expect(admitGlobalVoicesPage(URL_, page({ canonical }))).toMatchObject({
        outcome: 'EXCLUDE',
        reason,
      });
    });

    it('a trailing-slash difference is the same article', () => {
      expect(admitGlobalVoicesPage(URL_.replace(/\/$/, ''), page()).outcome).toBe('ADMIT');
    });
  });

  it('F · the page licence must be CC BY 3.0 — any other or none excludes', () => {
    expect(admitGlobalVoicesPage(URL_, page({ licence: [] }))).toMatchObject({
      reason: 'LICENCE_NOT_CC_BY_3',
    });
    expect(
      admitGlobalVoicesPage(
        URL_,
        page({ licence: ['https://creativecommons.org/licenses/by-sa/4.0/'] }),
      ),
    ).toMatchObject({ reason: 'LICENCE_NOT_CC_BY_3' });
  });

  it('C-GV4 · media is dropped on every outcome', () => {
    for (const html of [page(), page({ canonical: null }), page({ contributors: [] })]) {
      expect(admitGlobalVoicesPage(URL_, html).dropMedia).toBe(true);
    }
  });

  it('T5 · mutating the resolver changes the verdict (the gate binds)', () => {
    const base = admitGlobalVoicesPage(URL_, page());
    const relabelled = admitGlobalVoicesPage(
      URL_,
      page().split("credit-label'>Written by<").join("credit-label'>Written (English) by<"),
    );
    expect(base.outcome).toBe('ADMIT');
    expect(relabelled.outcome).not.toBe('ADMIT');
  });
});
