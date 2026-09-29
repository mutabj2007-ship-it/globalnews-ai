'use client';

import { AskFrameScreen } from '@/components/ask-frame/AskFrameScreen';
import { askNavStringsFor, type AskNavLocale } from '@/lib/ask/askNavStrings';
import { useAskNav } from './AskNavShell';

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
export function AskShellFrame({ locale }: { readonly locale: AskNavLocale }): JSX.Element {
  const { open, setOpen } = useAskNav();
  const strings = askNavStringsFor(locale);
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
