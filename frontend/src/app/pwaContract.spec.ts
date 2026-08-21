import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { en } from '@/lib/i18n/dictionaries/en';

/**
 * PWA-1 — INSTALLABILITY FOUNDATION CONTRACT.
 *
 * Source-reading structural tests, matching the convention already
 * established by legalPages.spec.ts and footerNavHud.spec.ts rather than
 * introducing a new testing approach. No React render, no DOM, no network —
 * every assertion below reads a real file off disk and checks a real byte.
 *
 * WHAT THIS FILE IS ACTUALLY FOR. Two of the five groups are ordinary
 * correctness checks (manifest shape, icon dimensions). The other three exist
 * to make specific, named regressions impossible:
 *
 *   - §3 COLOURS pins theme_color/background_color to the tailwind `void`
 *     token by READING tailwind.config.ts, so the hex is never a second
 *     hardcoded literal that can silently drift from the design system.
 *
 *   - §4 METADATA asserts `themeColor` lives in the Viewport export and NOT in
 *     the Metadata object. Next 14 deprecated the latter; without this test the
 *     deprecation is a build warning nobody reads.
 *
 *   - §5 LOCALIZATION PRESERVATION is the one that matters. PWA-1 edits
 *     layout.tsx, which is the file M66.13 made request-aware so the tab title
 *     and description localize. These assertions prove PWA-1 did not
 *     accidentally revert that to a static `export const metadata`, and did not
 *     smuggle a hardcoded English literal into a file whose whole point is that
 *     it has none.
 *
 * SCOPE. This file covers the installability foundation only — manifest,
 * icons, colours, metadata and the localization guarantee. Everything about the
 * service worker, its cache policy and the offline page lives in
 * src/components/pwa/serviceWorkerContract.spec.ts, next to the code it tests.
 */

const appDir = __dirname;
const frontendDir = join(appDir, '..', '..');
const publicDir = join(frontendDir, 'public');

const layoutPath = join(appDir, 'layout.tsx');
const manifestPath = join(publicDir, 'manifest.webmanifest');
const iconSvgPath = join(appDir, 'icon.svg');
const appleIconPath = join(appDir, 'apple-icon.png');
const tailwindConfigPath = join(frontendDir, 'tailwind.config.ts');

const layoutSource = readFileSync(layoutPath, 'utf-8');
const manifestRaw = readFileSync(manifestPath, 'utf-8');

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}
interface WebManifest {
  id: string;
  name: string;
  short_name: string;
  description: string;
  lang: string;
  dir: string;
  start_url: string;
  scope: string;
  display: string;
  orientation: string;
  background_color: string;
  theme_color: string;
  categories?: string[];
  icons: ManifestIcon[];
}

const manifest = JSON.parse(manifestRaw) as WebManifest;

/**
 * Minimal PNG header reader. A PNG is an 8-byte signature followed by the IHDR
 * chunk: length (4) + type (4) + width (4) + height (4) + bit depth (1) +
 * colour type (1). Reading it directly means the declared `sizes` in the
 * manifest is checked against the file's ACTUAL pixels, and it adds no
 * dependency to do it.
 *
 * Colour type 2 = truecolour with no alpha channel. Colour type 6 = truecolour
 * with alpha. iOS renders a transparent apple-touch icon's alpha as black, so
 * that file must be type 2 — see §2.
 */
function readPngHeader(path: string): { width: number; height: number; colourType: number } {
  const buffer = readFileSync(path);
  const signature = buffer.subarray(0, 8).toString('hex');
  expect(signature).toBe('89504e470d0a1a0a');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colourType: buffer[25],
  };
}

/**
 * Comment-stripped view of layout.tsx.
 *
 * WHY THIS EXISTS. layout.tsx is one of the most heavily documented files in
 * the repository — its doc comments quote the very code they explain, including
 * the literal text `preload: false` twice while describing why the three Claude
 * Design families carry it. A raw grep therefore counts five occurrences of a
 * thing that appears three times in code.
 *
 * This is the same false-positive class M66.10B recorded when its own doc
 * comments tripped three of its checkers. Counting executable code means
 * stripping comments first, and stripping comments means not being fooled by a
 * `//` or `/*` that lives inside a string literal.
 *
 * Used only where prose could interfere with a count or an absence check.
 * Presence checks read the raw source, because a doc comment cannot fake a
 * declaration into existing.
 */
function stripComments(source: string): string {
  let out = '';
  let index = 0;
  let quote: string | null = null;

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (quote) {
      if (char === '\\') {
        out += char + (next ?? '');
        index += 2;
        continue;
      }
      if (char === quote) quote = null;
      out += char;
      index += 1;
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      out += char;
      index += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end === -1 ? source.length : end + 2;
      out += ' ';
      continue;
    }

    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', index);
      index = end === -1 ? source.length : end;
      out += ' ';
      continue;
    }

    out += char;
    index += 1;
  }

  return out;
}

/**
 * Decodes \uXXXX escapes so a comparison sees the character a reader sees.
 *
 * WHY. en.ts writes its prose with escapes — homeMetaTitle is stored as
 * 'GlobalNews AI \u2014 Understand today\u2019s world in seconds.' — while the
 * imported value carries the real em dash and right quote. A hardcoded copy of
 * that string pasted into layout.tsx in ESCAPED form would therefore not match
 * the imported one, and the "no hardcoded English copy" assertion below would
 * pass while the regression it exists to catch had already happened.
 *
 * Found by running that assertion against a deliberately regressed layout.tsx
 * during dry-run verification, where it was the one check that failed to fire.
 */
function decodeUnicodeEscapes(source: string): string {
  return source.replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

const layoutCode = stripComments(layoutSource);
const layoutCodeDecoded = decodeUnicodeEscapes(layoutCode);

/**
 * The body of generateMetadata(), isolated so §4 can assert what is NOT in it.
 *
 * Guarded: if the function is missing entirely — the exact regression §5 exists
 * to catch — this is an empty string rather than a nonsense slice from a -1
 * index, so §4 fails with a readable message instead of a confusing one.
 */
const generateMetadataStart = layoutCode.indexOf('export async function generateMetadata');
const generateMetadataEnd = layoutCode.indexOf('export default function RootLayout');
const generateMetadataBody =
  generateMetadataStart === -1 || generateMetadataEnd === -1
    ? ''
    : layoutCode.slice(generateMetadataStart, generateMetadataEnd);

describe('PWA-1 §1 — web app manifest', () => {
  it('manifest.webmanifest exists and is valid JSON', () => {
    expect(existsSync(manifestPath)).toBe(true);
    expect(() => JSON.parse(manifestRaw)).not.toThrow();
  });

  it('carries every field required for installability', () => {
    for (const key of [
      'id',
      'name',
      'short_name',
      'description',
      'lang',
      'dir',
      'start_url',
      'scope',
      'display',
      'orientation',
      'background_color',
      'theme_color',
      'icons',
    ] as const) {
      expect(manifest[key]).toBeDefined();
    }
  });

  it('short_name fits a launcher label', () => {
    // 'GlobalNews AI' is 13 characters and overruns the ~12-char budget
    // launchers allow before truncating. 'GlobalNews' is 10.
    expect(manifest.short_name).toBe('GlobalNews');
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
  });

  it('pins app identity so a later display/start_url change is not a new app', () => {
    expect(manifest.id).toBe('/');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
  });

  it('declares standalone display', () => {
    expect(manifest.display).toBe('standalone');
  });

  it('does NOT lock orientation', () => {
    // The homepage is authored per viewport — heroGeometry.spec.ts holds the
    // composition from 1240px to 2560px, plus a separately authored compact
    // viewport. Locking 'portrait' would break the released landscape
    // composition on tablets. This assertion exists to stop that being added
    // later as a well-meaning "mobile app feel" change.
    expect(manifest.orientation).toBe('any');
  });

  it('description is byte-identical to the English dictionary', () => {
    // Deliberate coupling. A static manifest cannot read the language cookie,
    // so its description is a COPY of dictionary text. If the localization lane
    // rewrites homeMetaDescription, this test fails until the manifest is
    // updated to match — which is the intended outcome, not a nuisance. The
    // right single quotation mark must survive the copy: en.ts writes it as a
    // ’ escape and the manifest carries the literal character.
    expect(manifest.description).toBe(en.homeMetaDescription);
  });
});

describe('PWA-1 §2 — icons', () => {
  it('declares exactly four manifest icons', () => {
    expect(manifest.icons).toHaveLength(4);
  });

  it('covers 192 and 512 in both any and maskable', () => {
    const declared = manifest.icons.map((icon) => `${icon.sizes} ${icon.purpose}`).sort();
    expect(declared).toEqual(
      ['192x192 any', '192x192 maskable', '512x512 any', '512x512 maskable'].sort(),
    );
  });

  it('every declared icon file exists on disk', () => {
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith('/icons/')).toBe(true);
      expect(existsSync(join(publicDir, icon.src.replace(/^\//, '')))).toBe(true);
    }
  });

  it('every icon is really the number of pixels it claims to be', () => {
    for (const icon of manifest.icons) {
      const [declaredWidth, declaredHeight] = icon.sizes.split('x').map(Number);
      const header = readPngHeader(join(publicDir, icon.src.replace(/^\//, '')));
      expect(header.width).toBe(declaredWidth);
      expect(header.height).toBe(declaredHeight);
    }
  });

  it('maskable icons are distinct files from their any counterparts', () => {
    // A maskable icon differs from an `any` icon only by its inset: the emblem
    // is centred in a 50-unit canvas (80% artwork, exactly the safe-zone
    // circle) instead of a 44-unit one. Copying one over the other is an easy,
    // invisible mistake that reintroduces launcher clipping on Android.
    for (const size of ['192', '512']) {
      const plain = readFileSync(join(publicDir, 'icons', `icon-${size}.png`));
      const maskable = readFileSync(join(publicDir, 'icons', `icon-${size}-maskable.png`));
      expect(plain.equals(maskable)).toBe(false);
    }
  });

  it('src/app/icon.svg exists and is a static, non-animated emblem', () => {
    expect(existsSync(iconSvgPath)).toBe(true);
    const svg = readFileSync(iconSvgPath, 'utf-8');
    expect(svg).toContain('<svg');
    // The React emblem animates via three CSS classes and scopes its gradient
    // and filter ids with useId(). A standalone icon file must carry neither.
    expect(svg).not.toContain('<animate');
    expect(svg).not.toContain('animation:');
    expect(svg).not.toContain('useId');
    expect(svg).not.toContain('animate-emblem-scan');
    expect(svg).not.toContain('animate-cd-emb-ring');
    expect(svg).not.toContain('animate-cd-emb-core');
  });

  it('src/app/apple-icon.png is 180x180 with NO alpha channel', () => {
    // iOS does not composite transparency on the home screen — it renders the
    // alpha region as black, producing a halo around the emblem. Colour type 2
    // is truecolour without alpha; type 6 would fail this.
    expect(existsSync(appleIconPath)).toBe(true);
    const header = readPngHeader(appleIconPath);
    expect(header.width).toBe(180);
    expect(header.height).toBe(180);
    expect(header.colourType).toBe(2);
  });
});

describe('PWA-1 §3 — colours come from the design system, not a second literal', () => {
  const tailwindSource = readFileSync(tailwindConfigPath, 'utf-8');

  it('theme_color equals background_color', () => {
    expect(manifest.theme_color).toBe(manifest.background_color);
  });

  it('both equal the tailwind `void` token that <body className="bg-void"> renders', () => {
    const match = tailwindSource.match(/\n\s*void:\s*'(#[0-9a-fA-F]{6})'/);
    expect(match).not.toBeNull();
    const voidToken = (match as RegExpMatchArray)[1];
    expect(manifest.theme_color).toBe(voidToken);
    expect(manifest.background_color).toBe(voidToken);
  });

  it('introduces no colour literal outside the approved token', () => {
    const literals = manifestRaw.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    for (const literal of literals) {
      expect(literal.toLowerCase()).toBe('#080b12');
    }
  });
});

describe('PWA-1 §4 — layout metadata', () => {
  it('exports a separate Viewport carrying themeColor', () => {
    expect(layoutSource).toMatch(/export const viewport: Viewport = \{/);
    expect(layoutSource).toMatch(/themeColor:\s*'#080b12'/);
    expect(layoutSource).toMatch(/width:\s*'device-width'/);
  });

  it('does NOT set the UA colour-scheme field — M66.11 owns that', () => {
    // nativeControlScheme.spec.ts asserts layout.tsx contains no `colorScheme`
    // and no `color-scheme`, because M66.11 made the `:root` declaration in
    // globals.css the single source of truth and explicitly names a Next
    // metadata field as the competing mechanism it forbids. This assertion is
    // the same guarantee stated from the PWA side, so a future PWA change
    // cannot reintroduce it without failing its own contract first.
    expect(layoutSource).not.toMatch(/colorScheme/);
    expect(layoutSource).not.toMatch(/color-scheme/);
  });

  it('does NOT put themeColor inside the Metadata object', () => {
    // Next 14 moved themeColor out of Metadata and into Viewport. Leaving it in
    // Metadata still "works" but emits a deprecation warning at build time,
    // which is exactly the kind of warning that survives for a year.
    expect(generateMetadataBody).not.toContain('themeColor');
  });

  it('links the manifest', () => {
    expect(generateMetadataBody).toMatch(/manifest:\s*'\/manifest\.webmanifest'/);
  });

  it('declares appleWebApp capability', () => {
    expect(generateMetadataBody).toMatch(/appleWebApp:\s*\{/);
    expect(generateMetadataBody).toMatch(/capable:\s*true/);
  });

  it('sets NO icons key — icons come from the file convention only', () => {
    // src/app/icon.svg and src/app/apple-icon.png are auto-wired by Next.
    // Setting metadata.icons as well would emit a second set of <link> tags
    // whose precedence is a Next implementation detail. One source of truth.
    expect(generateMetadataBody).not.toMatch(/\bicons:\s*\{/);
  });
});

describe('PWA-1 §5 — M66.13 localization is preserved exactly', () => {
  it('metadata is still request-aware, not a static export', () => {
    expect(layoutSource).toMatch(/export async function generateMetadata\(\): Promise<Metadata>/);
    expect(layoutCode).not.toMatch(/export const metadata\s*[:=]/);
  });

  it('still reads the language cookie and the dictionary', () => {
    expect(generateMetadataBody).toContain('cookies().get(LANGUAGE_COOKIE_NAME)');
    expect(generateMetadataBody).toContain('isActiveLanguageCode(languageCookie)');
    expect(generateMetadataBody).toContain('getDictionary(language)');
  });

  it('title and description still resolve from the dictionary', () => {
    expect(generateMetadataBody).toMatch(/title:\s*t\.homeMetaTitle/);
    expect(generateMetadataBody).toMatch(/description:\s*t\.homeMetaDescription/);
  });

  it('smuggles no hardcoded English copy into layout.tsx', () => {
    // The only English literals PWA-1 adds are the brand name itself
    // (applicationName / appleWebApp.title), which Logo.tsx already renders
    // identically in both languages. Prose must never appear here.
    // Compared against the DECODED source, so a copy pasted in escaped form
    // ('...AI \u2014 Understand...') is caught too — the dictionary stores these
    // strings escaped, so an escaped paste is the likely shape of this mistake.
    expect(layoutCodeDecoded).not.toContain(en.homeMetaTitle);
    expect(layoutCodeDecoded).not.toContain(en.homeMetaDescription);
  });

  it('<html lang> still reflects the resolved language', () => {
    expect(layoutSource).toContain('<html lang={language} className={fontVariables}>');
  });

  it('the body class list is untouched', () => {
    expect(layoutSource).toContain(
      '<body className="bg-void font-body text-ink-primary antialiased">',
    );
  });

  it('all six font families and their weight lists are untouched', () => {
    for (const declaration of [
      'const displayFont = Space_Grotesk({',
      'const bodyFont = Inter({',
      'const monoFont = IBM_Plex_Mono({',
      'const claudeDesignDisplayFont = Space_Grotesk({',
      'const claudeDesignBodyFont = IBM_Plex_Sans({',
      'const claudeDesignMonoFont = IBM_Plex_Mono({',
    ]) {
      expect(layoutSource).toContain(declaration);
    }
    // M66.1 put preload: false on exactly the three Claude Design families so
    // routes that render none of those glyphs do not pay to preload them.
    expect(layoutCode.match(/preload:\s*false/g)).toHaveLength(3);
  });

  it('mounts the service-worker registrar exactly once, and nothing else', () => {
    // The registrar returns null (asserted in serviceWorkerContract.spec.ts),
    // so mounting it adds no element to the document. This assertion exists to
    // catch the opposite mistake: a second mount, or a wrapper element quietly
    // introduced around {children}, either of which would put something
    // between <body> and the Claude Design tree.
    expect(layoutCode.match(/<ServiceWorkerRegistrar \/>/g)).toHaveLength(1);

    // Read the <body> element's entire contents and normalize: drop the empty
    // braces left where stripComments removed the JSX comment, then collapse
    // whitespace. What remains must be the registrar and {children}, in that
    // order, and nothing else — no wrapper, no provider, no second mount.
    const bodyOpenTag = '<body className="bg-void font-body text-ink-primary antialiased">';
    const bodyStart = layoutCode.indexOf(bodyOpenTag);
    expect(bodyStart).toBeGreaterThan(-1);
    const bodyInner = layoutCode
      .slice(bodyStart + bodyOpenTag.length, layoutCode.indexOf('</body>'))
      .replace(/\{\s*\}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    expect(bodyInner).toBe('<ServiceWorkerRegistrar /> {children}');
  });
});
