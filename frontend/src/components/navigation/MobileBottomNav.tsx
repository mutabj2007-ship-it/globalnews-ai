import { Home, Globe2, Search, Sparkles } from 'lucide-react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

interface MobileBottomNavProps {
  language?: LanguageCode;
}

/**
 * Master Frontend Recomposition, Checkpoint 5 — persistent mobile
 * bottom navigation. Deliberately 4 items, not the 5-item reference
 * mockup: "Trending/News" and "Profile" are omitted rather than
 * faked. There is no trending signal in this product (the whole
 * point of the earlier M51 "no unsupported Trending semantics"
 * correction, still in force) and no authentication/profile
 * infrastructure exists — inventing either destination here would be
 * exactly the fabricated-navigation problem this milestone explicitly
 * forbids.
 *
 * "Intelligence" links to the homepage's own #intelligence-modules
 * section anchor — a real, existing part of the page, not a
 * fabricated /intelligence route.
 *
 * Server Component: every link here is a plain `<a>`; no client JS is
 * needed for basic navigation. `env(safe-area-inset-bottom)` padding
 * handles the iPhone home-indicator area without covering content.
 */
const NAV_ITEMS = [
  { key: 'home', href: '/', Icon: Home },
  { key: 'worldMap', href: '/map', Icon: Globe2 },
  { key: 'ask', href: '/ask', Icon: Search },
  { key: 'intelligence', href: '#intelligence-modules', Icon: Sparkles },
] as const;

export function MobileBottomNav({ language = 'en' }: MobileBottomNavProps): JSX.Element {
  const t = getDictionary(language).mobileBottomNav;

  return (
    <nav
      aria-label={t.navigationAriaLabel}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-cyan-500/15 bg-void/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex items-stretch justify-around">
        {NAV_ITEMS.map(({ key, href, Icon }) => (
          <li key={key} className="flex-1">
            <a
              href={href}
              /*
                C9, as ruled: "Use 12px labels with minimum 44px touch targets.
                Do not solve fit problems by making controls unreadably small."

                R5.1 NAVIGATION.md sets the shell this sits in -- "bottom bar
                58px ... Labels 13/16px, always visible, up to two lines" and
                "Targets >=44px everywhere; the bottom bar cell is >=90x58px at
                360px". The label was 10px, which R5.1 itself names as the
                current Beta behaviour it wanted changed (N11).

                `min-h-[56px]` plus the padding clears 44px on its own, and at
                360px four equal cells are 90px wide, so the >=90x58 cell holds
                at the narrowest supported width. `leading-tight` lets a long
                PL label take a second line instead of being clipped.
              */
              className="flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-ink-tertiary transition-colors hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
            >
              <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
              <span className="text-center font-mono text-[12px] uppercase leading-tight tracking-tight">{t[key]}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
