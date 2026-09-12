'use client';

import { useEffect, useState } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { FailureSurface } from '@/components/layout/FailureSurface';
import { getFailureCopy } from '@/lib/i18n/failureCopy';
import { readLanguageCookie } from '@/lib/i18n/languages';

/**
 * MVP FAILURE FLOOR — THE ROUTE-SEGMENT ERROR BOUNDARY.
 *
 * Next renders this when anything below the root layout throws. The shell is
 * intact here, so this file renders INSIDE `app/layout.tsx` and can use the
 * released canvas, the released fonts and `next/link` exactly like any page.
 *
 * ── WHY IT IS A CLIENT COMPONENT, AND WHAT THAT COSTS THE LANGUAGE ────────
 *
 * Next requires `'use client'` on an error boundary — it has to hold the
 * `reset` closure. That means `cookies()` is unavailable here, and the
 * language has to come from `document.cookie`, which does not exist during
 * the server render of this boundary.
 *
 * So the first render is English on BOTH sides, and the effect corrects it
 * after mount. That ordering is deliberate: resolving the cookie in the
 * initial client render instead would make the client's first output disagree
 * with the server's and produce a hydration mismatch on a page whose entire
 * job is to be reliable. The honest cost, stated rather than hidden: a Polish
 * reader sees one English frame before the copy switches. A flash is a smaller
 * failure than a mismatch, and neither the recovery route nor the retry
 * depends on which language won.
 *
 * `readLanguageCookie` is the RELEASED reader — the same function Hero uses —
 * so there is no second cookie parser anywhere in this lane.
 *
 * ── THE ERROR OBJECT IS NOT PUT ON SCREEN ─────────────────────────────────
 *
 * Only `error.digest` is rendered, and only when Next supplies one. The
 * message and stack stay off the page: they are ours, they routinely name
 * internals, and Next already redacts them in production for that reason.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  const [language, setLanguage] = useState<LanguageCode>('en');

  useEffect(() => {
    setLanguage(readLanguageCookie() ?? 'en');
  }, []);

  const copy = getFailureCopy(language).error;

  return (
    <FailureSurface
      eyebrow={copy.eyebrow}
      heading={copy.heading}
      body={copy.body}
      retryLabel={copy.retry}
      onRetry={reset}
      homeLabel={copy.home}
      reference={error.digest}
      referenceLabel={getFailureCopy(language).referenceLabel}
    />
  );
}
