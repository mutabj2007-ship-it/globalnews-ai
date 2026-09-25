'use client';

import type { JSX } from 'react';
import { useRouter } from 'next/navigation';

import type { LanguageCode } from '@globalnews-ai/shared';
import { LanguageSelector } from '@/components/search/LanguageSelector';
import { persistLanguageSelection } from '@/lib/i18n/languages';

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
}

export function HomeLanguageControl({
  language,
  label,
  actionLabel,
}: HomeLanguageControlProps): JSX.Element {
  const router = useRouter();

  function handleLanguageChange(next: LanguageCode): void {
    if (next === language) return;
    persistLanguageSelection(next);
    router.refresh();
  }

  return (
    <LanguageSelector
      value={language}
      onChange={handleLanguageChange}
      label={label}
      actionLabel={actionLabel}
      variant="desktop"
    />
  );
}
