import { readFileSync } from 'fs';
import { join } from 'path';
import { ASK_NAV_EXCLUDED_LABELS } from '@/lib/askNavModel';

/**
 * STANDALONE CONTINUITY SHELL CLOSURE — /ask/recent and /saved are standalone Ask
 * surfaces: the standalone Ask navigation only, never the platform NavBar, and no
 * read of the wider My Intelligence Saved Stories substrate anywhere in the
 * continuity journey (Recent → reopen, Saved → reopen).
 */
const src = join(__dirname, '..', '..');
const read = (...parts: string[]): string => readFileSync(join(src, ...parts), 'utf-8');
/** Code only — a comment that NAMES NavBar or StoryBookmark is not a use of it. */
const code = (text: string): string =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const recentPage = read('app', 'ask', 'recent', 'page.tsx');
const savedPage = read('app', 'saved', 'page.tsx');
const header = read('components', 'ask-nav', 'AskContinuityHeader.tsx');
const shell = read('components', 'ask-nav', 'AskNavShell.tsx');
const navCss = read('components', 'ask-nav', 'askNav.module.css');
const sourcesColumn = read('components', 'ask-frame', 'AskSourcesColumn.tsx');
const turnView = read('components', 'ask-frame', 'AskR2TurnView.tsx');
const frameScreen = read('components', 'ask-frame', 'AskFrameScreen.tsx');
const compact = read('components', 'ask', 'AskCompactResult.tsx');
const dock = read('components', 'ask', 'AskAiDock.tsx');

describe('Recent and Saved use the standalone Ask navigation, never the platform NavBar', () => {
  it.each([
    ['/ask/recent', recentPage, 'AskRecentClient', 'recent'],
    ['/saved', savedPage, 'SavedClient', 'saved'],
  ])('%s', (_route, page, client, surface) => {
    const body = code(page);
    expect(body).not.toMatch(/NavBar/);
    expect(body).not.toMatch(/components\/navigation\//);
    expect(body).toContain("from '@/components/ask-nav/AskNavShell'");
    expect(body).toMatch(
      new RegExp(
        /* ALPHA VISUAL ACCEPTANCE REPAIR R1 — the body sits inside AskClearedBoundary (Sign out / New question). */
        String.raw`<AskNavProvider>\s*<AskNavShell language=\{locale\} />\s*<AskContinuityHeader locale=\{locale\} surface="${surface}" />\s*<AskClearedBoundary>\s*<${client} locale=\{locale\} />\s*</AskClearedBoundary>\s*</AskNavProvider>`,
      ),
    );
  });

  it('the pages stay noindex', () => {
    for (const page of [recentPage, savedPage]) {
      expect(page).toContain('robots: { index: false, follow: false }');
    }
  });

  it('the platform dock unmounts on both continuity routes, as on /ask', () => {
    expect(code(dock)).toContain('`${ASK_CANONICAL_ROUTE}/recent`');
    expect(code(dock)).toContain("'/saved'");
    expect(code(dock)).toContain(
      'if (pathname !== null && ASK_CONTINUITY_ROUTES.has(pathname)) return null;',
    );
  });
});

describe('the continuity phone header is narrow and drives the ONE Ask drawer', () => {
  it('takes a surface name, never a React node', () => {
    /* ALPHA VISUAL ACCEPTANCE REPAIR R1 — Help & feedback and Settings joined; still names only. */
    expect(header).toContain(
      "export type AskContinuitySurface = 'recent' | 'saved' | 'help' | 'settings';",
    );
    expect(header).not.toMatch(/ReactNode|children/);
  });

  it('its trigger is the handle AskNavShell returns focus to, and opens the shared drawer state', () => {
    expect(header).toContain('data-ask="shell-menu"');
    expect(shell).toContain(
      `document.querySelector<HTMLElement>('[data-ask="shell-menu"]')?.focus();`,
    );
    expect(header).toContain('const { open, setOpen } = useAskNav();');
    expect(header).toContain('aria-expanded={open}');
    expect(header).toContain('onClick={() => setOpen(!open)}');
  });

  it('the title is localized from the continuity catalogue and is not a second <h1>', () => {
    expect(code(header)).toMatch(
      /surface === 'recent'\s*\? t\.recentTitle\s*: surface === 'saved'\s*\? t\.savedTitle\s*: surface === 'help'\s*\? nav\.help\s*: nav\.settings/,
    );
    expect(code(header)).not.toMatch(/<h1/);
  });

  it('56px below the full-screen threshold, hidden above it — the exact inverse of the 62px bar', () => {
    const query = '@media (max-width: 860px), (orientation: portrait) and (max-width: 1100px) {';
    expect(navCss.split(query)).toHaveLength(2);
    expect(navCss).toMatch(/\.continuityHeader \{\s*display: none;\s*\}/);
    const inside = navCss.slice(navCss.indexOf(query));
    expect(inside).toMatch(/\.shell \{\s*display: none;\s*\}/);
    expect(inside).toMatch(/\.continuityHeader \{[^}]*display: flex;[^}]*height: 56px;/);
    expect(inside).toMatch(/\.continuityHeader \{[^}]*position: sticky;/);
  });

  it('no platform label can appear in it', () => {
    for (const label of ASK_NAV_EXCLUDED_LABELS) {
      expect(header).not.toContain(`'${label}'`);
    }
  });
});

describe('no Saved STORIES read in the standalone Ask journey', () => {
  /**
   * The runtime cause: every source row of an Ask answer rendered StoryBookmark, whose
   * hook loads the My Intelligence Saved Stories store (GET /users/me/saved/stories).
   * Reopening a Saved or Recent question lands on that answer.
   */
  it('the standalone Sources column renders no story bookmark', () => {
    expect(code(sourcesColumn)).not.toMatch(/StoryBookmark/);
  });

  /*
    R2C — the frame now has ONE path (the canonical turn view; the legacy path is retired). The turn
    view forwards a \`storyBookmarks\` prop that defaults OFF, and the frame never turns it on.
  */
  it('the standalone frame turns the compact result story bookmarks off, on both paths', () => {
    expect(code(turnView)).toMatch(/storyBookmarks = false,/);
    expect(code(turnView)).toMatch(/<AskCompactResult[^>]*storyBookmarks=\{storyBookmarks\}/);
    expect(code(frameScreen)).not.toMatch(/<AskCompactResult/);
    expect(code(frameScreen)).not.toMatch(/storyBookmarks/);
  });

  it('the platform dock keeps them — the prop defaults on and gates the only render', () => {
    expect(compact).toContain('storyBookmarks = true,');
    const body = code(compact);
    expect(body.split('<StoryBookmark ')).toHaveLength(2);
    expect(body).toMatch(/\{storyBookmarks && \(\s*<span[^>]*>\s*<StoryBookmark /);
  });

  it('nothing on the continuity surfaces imports the saved-stories store', () => {
    for (const file of [
      recentPage,
      savedPage,
      header,
      read('components', 'ask', 'AskRecentClient.tsx'),
      read('components', 'ask', 'SavedClient.tsx'),
    ]) {
      expect(file).not.toMatch(/savedStoriesStore|myIntelligence\/hooks|StoryBookmark/);
    }
  });
});
