'use client';

import type { JSX } from 'react';
import { useRouter } from 'next/navigation';

import type { DisplayLocale, LanguageCode } from '@globalnews-ai/shared';
import { LanguageSelector } from '@/components/search/LanguageSelector';
import { persistLanguageSelection, displayLocaleOf } from '@/lib/i18n/languages';
import { useRequestedDisplayLocale } from '@/lib/i18n/useRequestedDisplayLocale';

/**
 * The Home header's language control.
 *
 * `LanguageSelector` needs a change handler, which needs a client boundary.
 * Rather than turn the whole Beta Home header into a Client Component for one
 * control, the boundary is drawn around the control itself: the header stays a
 * Server Component and only this wrapper ships to the browser.
 *
 * The behaviour is `NavBar`'s, unchanged and deliberately so — persist the
 * selection, then `router.refresh()` so the Server Components on this route
 * re-render against the freshly written cookie. That is what makes the feed,
 * the page shell and `<html lang>` all follow the selection, and it must not
 * diverge between the two headers.
 */
interface HomeLanguageControlProps {
  language: LanguageCode;
  label: string;
  actionLabel: string;
  /** HOME R1 · STAGE A — the phone top bar uses the compact (mobile) selector. Default unchanged. */
  variant?: 'desktop' | 'mobile';
}

export function HomeLanguageControl({
  language,
  label,
  actionLabel,
  variant = 'desktop',
}: HomeLanguageControlProps): JSX.Element {
  const router = useRouter();
  /* T2 · show the REQUESTED locale; the page may be rendering a declared English fallback. */
  const selectedLocale = useRequestedDisplayLocale(displayLocaleOf(language));

  /* R4 · the control speaks DisplayLocale; the cookie is a string and always was. */
  function handleLanguageChange(next: DisplayLocale): void {
    if (next === selectedLocale) return;
    persistLanguageSelection(next);
    router.refresh();
  }

  return (
    <LanguageSelector
      value={selectedLocale}
      onChange={handleLanguageChange}
      label={label}
      actionLabel={actionLabel}
      variant={variant}
    />
  );
}
