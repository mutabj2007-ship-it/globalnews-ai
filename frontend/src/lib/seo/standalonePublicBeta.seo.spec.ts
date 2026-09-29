import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildPageMetadata } from './metadata';
import { ALL_ROUTES, classify, sitemapRoutes } from './routes';
import { ALPHA_ENVIRONMENT_ID } from './deploymentEnvironment';
import { ASK_SOCIAL_PREVIEW } from './socialPreview';
import sitemap from '@/app/sitemap';
import { SiteStructuredData } from '@/components/seo/SiteStructuredData';

/**
 * STANDALONE PUBLIC BETA CONVERGENCE R1 — SEO HARD GATE. Search discovery describes the
 * product being launched: Ask GlobalNewsAI at https://globalnewsai.live/.
 *
 * The host is NEVER hard-coded into the helpers: production obtains it from
 * NEXT_PUBLIC_SITE_URL. These tests set exactly that variable and prove what is emitted.
 */
const PUBLIC = 'https://globalnewsai.live';
const SRC = join(__dirname, '..', '..');
const APP = join(SRC, 'app');

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const previous: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    previous[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}
const production = { NEXT_PUBLIC_SITE_URL: PUBLIC, RAILWAY_ENVIRONMENT_ID: undefined };
const rootMeta = (language: 'en' | 'pl' = 'en') =>
  buildPageMetadata({
    path: '/',
    title: language === 'pl' ? 'Zapytaj GlobalNewsAI' : 'Ask GlobalNewsAI',
    description: 'D',
    language,
    image: ASK_SOCIAL_PREVIEW,
  });

describe('root Ask — the ONE indexable Ask canonical on globalnewsai.live', () => {
  it('canonical is https://globalnewsai.live, index/follow', () => {
    withEnv(production, () => {
      const meta = rootMeta();
      expect(meta.alternates?.canonical).toBe(PUBLIC);
      expect(meta.robots).toEqual({ index: true, follow: true });
    });
  });

  it('Open Graph url and Twitter both follow the public canonical; the 1200×630 preview is absolute on it', () => {
    withEnv(production, () => {
      const meta = rootMeta();
      const og = meta.openGraph as {
        url?: string;
        images?: { url: string; width: number; height: number }[];
      };
      expect(og.url).toBe(PUBLIC);
      expect(og.images).toEqual([
        expect.objectContaining({
          url: `${PUBLIC}/og/ask-globalnewsai-1200x630.png`,
          width: 1200,
          height: 630,
        }),
      ]);
      const tw = meta.twitter as { card?: string; images?: { url: string }[] };
      expect(tw.card).toBe('summary_large_image');
      expect(tw.images?.[0]?.url).toBe(`${PUBLIC}/og/ask-globalnewsai-1200x630.png`);
    });
  });

  it('root is wired to buildPageMetadata with the localized dictionary strings and the preview', () => {
    const page = readFileSync(join(APP, 'page.tsx'), 'utf8');
    expect(page).toMatch(/title: t\.askRootMetaTitle,\s*description: t\.askRootMetaDescription,/);
    expect(page).toContain('image: ASK_SOCIAL_PREVIEW');
    for (const dict of ['en', 'pl']) {
      const src = readFileSync(join(SRC, 'lib', 'i18n', 'dictionaries', `${dict}.ts`), 'utf8');
      expect(src).toMatch(/askRootMetaTitle: '[^']+'/);
      expect(src).toMatch(/askRootMetaDescription:\s*'[^']+'/);
    }
  });

  it('no fake hreflang: EN and PL share ONE URL (language is a preference, not a path)', () => {
    withEnv(production, () => {
      expect(rootMeta('en').alternates).toEqual({ canonical: PUBLIC });
      expect(rootMeta('pl').alternates).toEqual({ canonical: PUBLIC });
    });
  });

  it('Alpha stays globally noindex — no canonical, even for the root', () => {
    withEnv({ NEXT_PUBLIC_SITE_URL: PUBLIC, RAILWAY_ENVIRONMENT_ID: ALPHA_ENVIRONMENT_ID }, () => {
      const meta = rootMeta();
      expect(meta.robots).toEqual({ index: false, follow: false });
      expect(meta.alternates).toBeUndefined();
    });
  });
});

describe('/ask and every private surface — noindex, no canonical, out of the sitemap', () => {
  const PRIVATE = [
    '/ask',
    '/ask?operation=op-1',
    '/ask/recent',
    '/saved',
    '/account/settings',
    '/account/anything',
    '/support',
    '/admin',
    '/admin/ai/ask-intelligence',
    '/history',
    '/search',
    '/search?q=kenya',
    '/map',
  ];
  it.each(PRIVATE)('%s is noindex with no canonical', (path) => {
    withEnv(production, () => {
      const meta = buildPageMetadata({ path, title: 'T', description: 'D', language: 'en' });
      expect(classify(path).indexability).toBe('noindex');
      expect((meta.robots as { index: boolean }).index).toBe(false);
      expect(meta.alternates).toBeUndefined();
    });
  });

  it('the sitemap on globalnewsai.live is exactly the root Ask and the legal/source pages', () => {
    withEnv(production, () => {
      expect(
        sitemap()
          .map((e) => e.url)
          .sort(),
      ).toEqual([PUBLIC, `${PUBLIC}/privacy`, `${PUBLIC}/source-policy`, `${PUBLIC}/terms`].sort());
      expect(sitemapRoutes().map((r) => r.path)).not.toContain('/map');
      expect(sitemapRoutes().map((r) => r.path)).not.toContain('/ask');
    });
  });

  it('the ONLY indexable Ask surface in the registry is the root', () => {
    const indexable = ALL_ROUTES.filter((r) => r.indexability === 'index').map((r) => r.path);
    expect(indexable.sort()).toEqual(['/', '/privacy', '/source-policy', '/terms'].sort());
  });
});

describe('truthful structured data — and no invented content types', () => {
  it('WebSite + Organization on the public origin; no SearchAction, article, author, date, rating or review', () => {
    withEnv(production, () => {
      const el = SiteStructuredData() as { props: { dangerouslySetInnerHTML: { __html: string } } };
      const graph = JSON.parse(el.props.dangerouslySetInnerHTML.__html) as {
        '@graph': { '@type': string; url: string }[];
      };
      expect(graph['@graph'].map((n) => n['@type']).sort()).toEqual(['Organization', 'WebSite']);
      expect(graph['@graph'].every((n) => n.url === PUBLIC)).toBe(true);
      expect(JSON.stringify(graph)).not.toMatch(
        /SearchAction|NewsArticle|"Article"|author|datePublished|aggregateRating|review/i,
      );
    });
  });

  it('the host is never hard-coded into application source (only tests name it)', () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && !/\.spec\.tsx?$/.test(name))
          if (readFileSync(p, 'utf8').includes('globalnewsai.live')) offenders.push(p);
      }
    };
    walk(SRC);
    expect(offenders).toEqual([]);
  });
});
