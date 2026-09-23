import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * CHECKPOINT I — LANGUAGE / AUTH (frontend halves)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ─── LANGUAGE-PERSISTENCE-ON-REFRESH ──────────────────────────────────────
 *
 * The product keeps one preference in TWO stores. `localStorage` is the
 * long-lived client record; the cookie is the only thing a Server Component can
 * read. They agree while both survive, and when the cookie alone is missing,
 * they do not.
 *
 * The homepage has always reconciled them — `Hero` compares what the client
 * resolves against what the server actually used and refreshes on disagreement.
 * NOTHING ELSE DID. So a reader whose cookie was cleared, or whose browser is
 * Polish and who arrives directly on `/map`, got English, and REFRESHING NEVER
 * FIXED IT: the refresh re-read the same absent cookie. Only a detour through
 * the homepage repaired it.
 *
 * That is the item exactly: PL did not survive a refresh anywhere but home.
 *
 * ─── AUTH RETURN-STATE, AND THE CONTRACT THAT FORBIDS THE OBVIOUS FIX ─────
 *
 * Every sign-in link on the map passed the bare string `'/map'`, so a reader
 * who had selected a country, set a period and framed a camera came back to an
 * empty world map with the thing they were acting on gone.
 *
 * The obvious repair — return to `/map?sel=…` — IS FORBIDDEN, and correctly so.
 * `return-destination.util.ts` rejects `?` and `#` outright:
 *
 *     "no query string and no fragment are accepted at all. The contract is
 *      'return to the originating PAGE' … so no state needs to survive the
 *      redirect and none is allowed to." (CTO requirement 9)
 *
 * That gate exists because `returnTo` is attacker-authored by definition, and a
 * redirect target taken from a request is the classic open-redirect primitive —
 * most dangerous here, where the reader arrives having just completed a real
 * Google sign-in and is primed to trust what follows.
 *
 * SO THE STATE NEVER ENTERS THE REDIRECT. It is kept in `sessionStorage`, which
 * survives the same-tab round trip, is scoped to that tab, and dies with it.
 * `returnTo` stays exactly `/map` and passes the allowlist unchanged — the
 * three gates govern precisely what they governed before, and no new input
 * reaches the server.
 */

const src = (...parts: string[]): string =>
  readFileSync(join(__dirname, '..', '..', ...parts), 'utf-8');

const stripComments = (value: string): string =>
  value
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

const sync = src('components', 'i18n', 'LanguageSync.tsx');
const mapRoute = src('app', 'map', 'page.tsx');
const hero = src('components', 'home', 'Hero.tsx');
const returnState = src('lib', 'map', 'state', 'signInReturnState.ts');
const mapReturn = src('components', 'map', 'MapSignInReturn.tsx');
const card = stripComments(src('components', 'map', 'shell', 'EvidenceSelectionCard.tsx'));
const callout = stripComments(src('components', 'map', 'shell', 'SelectionCallout.tsx'));
const shell = stripComments(src('components', 'map', 'shell', 'GlobalMapShell.tsx'));

describe('I — PL survives a refresh on the map, not only on the homepage', () => {
  describe('THE RECONCILIATION IS THE RELEASED ONE, NOT A SECOND MECHANISM', () => {
    it('it compares the client resolution against the cookie the server used', () => {
      expect(sync).toContain("const effectiveServerLanguage = readLanguageCookie() ?? 'en';");
      expect(sync).toContain('const resolved = resolveInitialLanguage();');
    });

    it('and applies the SAME fallback the routes apply', () => {
      /* If the two disagreed about the default, they would fight every render. */
      expect(sync).toContain("?? 'en'");
      expect(mapRoute).toContain("isActiveLanguageCode(languageCookie) ? languageCookie : 'en'");
    });

    it('it persists and refreshes only on disagreement', () => {
      expect(sync).toMatch(
        /if \(resolved !== effectiveServerLanguage\) \{\s*persistLanguageSelection\(resolved\);\s*router\.refresh\(\);\s*\}/,
      );
    });

    it('which is why it cannot loop', () => {
      /*
        The cookie is written BEFORE the refresh, so the next run finds the two
        in agreement. The condition is the guard.
      */
      const body = sync.slice(sync.indexOf('useEffect'));

      expect(body.indexOf('persistLanguageSelection')).toBeLessThan(body.indexOf('router.refresh'));
    });

    it('it writes no preference store of its own', () => {
      /* The CODE, not the prose — the doc comment names both stores on purpose. */
      const code = stripComments(sync);

      expect(code).not.toContain('document.cookie');
      expect(code).not.toContain('localStorage');
    });

    it('and it reads localStorage in an effect, never in render', () => {
      /* M65 — reading it during render is a hydration mismatch. */
      expect(sync).toContain('useEffect(() => {');
      expect(sync.indexOf('useEffect')).toBeLessThan(sync.indexOf('resolveInitialLanguage()'));
    });
  });

  describe('AND IT IS MOUNTED WHERE THE GAP WAS', () => {
    it('the map route mounts it', () => {
      expect(mapRoute).toContain('<LanguageSync />');
    });

    it('the homepage keeps its own, untouched', () => {
      /*
        Hero's effect is pinned by its own spec and is not moved or removed —
        this adds a route that had none rather than relocating one that worked.
      */
      expect(hero).toContain("const effectiveServerLanguage = readLanguageCookie() ?? 'en';");
    });

    it('the component renders nothing, so it cannot affect layout', () => {
      expect(sync).toContain('): null {');
      expect(sync).toContain('return null;');
    });
  });
});

describe('I — the selected geography survives sign-in, without touching returnTo', () => {
  describe('THE SECURITY CONTRACT IS NOT WIDENED', () => {
    it('every map sign-in link still returns to the bare allowlisted path', () => {
      /*
        ══ TWO SURFACES NOW, NOT THREE — R2-B §5 ══════════════════════════

        The callout carried a third sign-in link because it carried a Follow
        control. The 2026-09-19 ruling removes Follow from the map popup and
        makes it a compact selection anchor, so the link went with it.

        THE CONTRACT IS UNCHANGED AND IS ASSERTED ON WHAT REMAINS. Fewer
        sign-in entry points is a smaller attack surface, not a weaker rule —
        and the assertion below proves the callout has no sign-in URL of any
        shape rather than trusting that it has none.
      */
      expect(shell).toContain("const FOLLOW_RETURN_DESTINATION = '/map';");
      expect(card).toContain("const FOLLOW_RETURN_DESTINATION = '/map';");
    });

    it('and the compact anchor holds no sign-in path at all', () => {
      expect(callout).not.toContain('RETURN_DESTINATION');
      expect(callout).not.toContain('accountSignInUrl');
    });

    it('no map sign-in URL carries a query string', () => {
      /*
        The backend rejects `?` outright. A returnTo with one is not merely
        refused — it silently degrades to the homepage, which would be worse
        than the defect being fixed.
      */
      /* The callout no longer has a sign-in link — see the assertion above. */
      for (const surface of [shell, card]) {
        expect(surface).not.toMatch(/accountSignInUrl\([^)]*\?/);
        expect(surface).not.toMatch(/RETURN_DESTINATION = '\/map\?/);
      }
    });
  });

  describe('THE STATE IS KEPT IN THE BROWSER INSTEAD', () => {
    it('it is stored in sessionStorage, which dies with the tab', () => {
      expect(returnState).toContain('window.sessionStorage.setItem(KEY, search);');
    });

    it('both remaining map sign-in affordances remember before navigating', () => {
      /*
        SUPERSEDED BY R2-B §5 — three became two when the compact anchor lost
        its Follow control. The rule is untouched for every surface that still
        navigates to sign-in.
      */
      for (const surface of [shell, card]) {
        expect(surface).toContain('rememberMapStateForSignIn(window.location.search)');
      }
    });

    it('and the anchor does not navigate anywhere, so it has nothing to remember', () => {
      expect(callout).not.toContain('rememberMapStateForSignIn');
    });

    it('the route’s own query string is copied verbatim, never re-encoded', () => {
      /*
        So this module cannot disagree with mapUrl.ts about what any key means:
        it copies a string and hands it back.
      */
      expect(returnState).not.toContain('URLSearchParams');
      expect(returnState).not.toContain('encodeSelection');
    });

    it('an empty query is not stored', () => {
      /* Storing it would "restore" a bare map over whatever the URL said. */
      expect(returnState).toContain("if (search.length === 0 || search === '?') return;");
    });

    it('and every access is guarded, so disabled storage loses the convenience only', () => {
      expect(returnState.match(/try \{/g) ?? []).toHaveLength(3);
      expect(returnState).toContain("if (typeof window === 'undefined') return;");
    });
  });

  describe('THE RESTORE IS NARROW, AND HAPPENS ONCE', () => {
    it('it restores only onto a bare map', () => {
      /*
        A URL that already carries state was asked for deliberately — by a
        link, a bookmark or Back — and is the authority.
      */
      expect(mapReturn).toContain('if (current.length > 1) return;');
    });

    it('the stored value is read-and-cleared', () => {
      expect(returnState).toContain('window.sessionStorage.removeItem(KEY);');
      expect(mapReturn).toContain('const restored = consumeMapStateAfterSignIn();');
    });

    it('a value that is not a query string is ignored rather than routed from', () => {
      expect(returnState).toContain("return stored.startsWith('?') ? stored : null;");
    });

    it('it replaces rather than pushes, so Back does not return to the empty map', () => {
      expect(mapReturn).toContain('router.replace(');
      expect(mapReturn).not.toContain('router.push(');
    });

    it('and it is mounted on the route', () => {
      expect(mapRoute).toContain('<MapSignInReturn />');
    });
  });

  describe('THE HAPPY PATH IS UNCHANGED', () => {
    it('the sign-in URL builder is untouched', () => {
      const accountBase = src('lib', 'api', 'accountLinks.ts');

      expect(accountBase).toContain('const base = `${ACCOUNT_API_PATH_PREFIX}/auth/google`;');
      expect(accountBase).toContain('returnTo=${encodeURIComponent(returnTo)}');
    });

    it('the activation panel’s callback is optional, so the accepted panel is unchanged', () => {
      const panel = src('components', 'map', 'shell', 'monetization', 'ActivationPanel.tsx');

      expect(panel).toContain('readonly onSignIn?: (() => void) | undefined;');
    });
  });
});
