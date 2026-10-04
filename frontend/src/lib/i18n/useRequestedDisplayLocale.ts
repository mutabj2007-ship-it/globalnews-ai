import { useEffect, useState } from 'react';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { readStoredDisplayLocale } from '@/lib/i18n/displayLocale';

/**
 * T2 · WHAT A LANGUAGE CONTROL SHOWS AS SELECTED — the reader's REQUESTED locale, not the
 * surface's effective one.
 *
 * Selectors receive the surface's EFFECTIVE locale as a prop (that is what the page renders in).
 * On a surface that fell back to English, showing that value as "selected" would tell a reader who
 * chose Français that English is their choice — and, worse, the `next === current` guard in every
 * selector would then make choosing English a silent no-op, so the reader could never switch back.
 *
 * The first render returns `rendered` (so the server HTML and the first client render agree — no
 * hydration mismatch); after mount it reads the stored choice through the one display-locale
 * authority and shows that.
 */
export function useRequestedDisplayLocale(rendered: DisplayLocale): DisplayLocale {
  const [requested, setRequested] = useState<DisplayLocale>(rendered);
  useEffect(() => {
    setRequested(readStoredDisplayLocale() ?? rendered);
  }, [rendered]);
  return requested;
}
