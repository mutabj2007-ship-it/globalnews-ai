import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { STORAGE_INVENTORY, PREFERENCE_COOKIES, PREFERENCE_LOCAL_KEYS } from './storageInventory';
import { COOKIES_PAGE } from './cookiesPageStrings';

/**
 * TRUST R1 §12 + CTO addendum — the Cookies notice is checked against the CODE in both directions:
 *   1  every inventory row names storage that really exists in the code, and
 *   2  every storage key / cookie name written by the code is in the inventory.
 * A new cookie or storage key therefore fails this suite until it is disclosed.
 */
const ROOT = join(__dirname, '..', '..', '..', '..');
const FRONTEND = join(ROOT, 'frontend', 'src');
const BACKEND = join(ROOT, 'backend', 'src');
const SW = join(ROOT, 'frontend', 'public', 'sw.js');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory())
      return entry === 'generated' || entry === 'node_modules' ? [] : files(path);
    return /\.(ts|tsx|js)$/.test(entry) && !/\.spec\.|\.test\./.test(entry) ? [path] : [];
  });
}

const sources = [...files(FRONTEND), ...files(BACKEND), SW].map((path) => ({
  path,
  text: readFileSync(path, 'utf8'),
}));
const all = sources.map((s) => s.text).join('\n');
const names = new Set(STORAGE_INVENTORY.map((item) => item.name));

describe('every disclosed item exists in the code', () => {
  it.each(STORAGE_INVENTORY.map((i) => [i.name]))('%s', (name) => {
    /* the service worker builds its cache names from a version constant */
    const literal = name.startsWith('gna-pwa-')
      ? name.replace(/-v\d+-/, '-').replace('gna-pwa-', '')
      : name;
    expect(all.includes(name) || all.includes(literal)).toBe(true);
  });
});

describe('every storage key the code writes is disclosed', () => {
  const STORAGE_FILE =
    /localStorage|sessionStorage|document\.cookie|\.cookie\(|COOKIE_NAME|caches\.open/;
  const KEY = /['"`]((?:gna|gn)[._:-][A-Za-z0-9._:-]+|globalnews-ai[:-][A-Za-z0-9:-]+)['"`]/g;
  /* Identifiers with those prefixes that are NOT storage (DOM ids, events, header names). */
  const NOT_STORAGE = new Set<string>([
    'gn-today-pulse-3', // a CSS animation class in WatchPanel, not storage
    'gna-pwa-v7', // the service-worker VERSION prefix the two disclosed cache names are built from
  ]);

  it('finds no undisclosed key', () => {
    const undisclosed = new Set<string>();
    for (const { path, text } of sources) {
      if (!STORAGE_FILE.test(text)) continue;
      for (const match of text.matchAll(KEY)) {
        const key = match[1];
        if (!names.has(key) && !NOT_STORAGE.has(key))
          undisclosed.add(`${key} (${path.slice(ROOT.length)})`);
      }
    }
    expect([...undisclosed].sort()).toEqual([]);
  });
});

describe('no fictional categories, and withdrawal covers every preference', () => {
  it('only the categories that exist are shown; no analytics or marketing category', () => {
    expect([...new Set(STORAGE_INVENTORY.map((i) => i.category))].sort()).toEqual([
      'PREFERENCES',
      'STRICTLY_NECESSARY',
    ]);
    expect(JSON.stringify(COOKIES_PAGE)).not.toMatch(/Accept all|Akceptuj wszystkie/);
  });

  it('the remove control clears the language and theme cookies and the language key', () => {
    expect(PREFERENCE_COOKIES.sort()).toEqual(['globalnews-ai-language', 'globalnews-ai-theme']);
    expect(PREFERENCE_LOCAL_KEYS).toEqual(['globalnews-ai:language']);
  });

  it('no analytics / advertising SDK is a dependency', () => {
    const pkg = readFileSync(join(ROOT, 'frontend', 'package.json'), 'utf8');
    expect(pkg).not.toMatch(
      /gtag|google-analytics|googletagmanager|posthog|plausible|segment|mixpanel|hotjar|clarity|@sentry|@vercel\/analytics|facebook|pixel/i,
    );
  });
});
