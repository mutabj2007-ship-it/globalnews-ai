'use client';

import { AskFrameScreen } from '@/components/ask-frame/AskFrameScreen';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { askNavStringsFor } from '@/lib/ask/askNavStrings';
import { askLanguageDisposition } from '@/lib/ask/askLocale';
import { useAskNav } from './AskNavShell';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';

/**
 * THE SEAM BETWEEN THE SHELL'S STATE AND D25's HEADER.
 *
 * `app/ask/page.tsx` is a Server Component, so it cannot build the
 * `AskShellMenuControl` — that object carries a callback. This three-line client
 * wrapper does, reading the same context the bar and the drawer read, so one
 * piece of state drives two mount points: the trigger inside D25's phone header
 * and the drawer rendered beside the bar.
 *
 * IT ADDS NO DOM. A client component that returns another component's element
 * contributes no wrapper node, so `<main class="frame">` remains a DIRECT CHILD
 * of `.page` and keeps `flex: 1 1 0` — which is what makes the composer clipping
 * fix from PR #66 hold. A wrapping <div> here would silently break it.
 */
export function AskShellFrame({ locale }: { readonly locale: DisplayLocale }): JSX.Element {
  const { open, setOpen, cleared } = useAskNav();
  /* R4 · the menu's aria labels come from the two-locale nav catalogue; the frame below gets
     the reader's own locale. Both read one disposition. */
  const strings = askShellStrings(askLanguageDisposition(locale).catalogueLocale).askNavStrings;
  /*
    ALPHA VISUAL ACCEPTANCE REPAIR R1 — New question / Sign out: the conversation is gone
    from the screen at once, before the clean document load replaces the page. Same shape as
    the route's Suspense fallback, so the page column is unchanged.
  */
  if (cleared) return <main data-ask="cleared" className="min-h-0 flex-1 bg-void" />;
  return (
    <AskFrameScreen
      locale={locale}
      shellMenu={{
        open,
        openLabel: strings.openMenuAriaLabel,
        closeLabel: strings.closeMenuAriaLabel,
        onToggle: () => setOpen(!open),
      }}
    />
  );
}
