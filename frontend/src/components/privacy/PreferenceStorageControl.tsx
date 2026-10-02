'use client';

import { useEffect, useState } from 'react';
import { PREFERENCE_COOKIES, PREFERENCE_LOCAL_KEYS } from '@/lib/privacy/storageInventory';
import { COOKIES_PAGE, type CookiesPageLocale } from '@/lib/privacy/cookiesPageStrings';

/**
 * TRUST R1 §12 / CTO addendum §4 — withdrawing a preference is as easy as setting it: one button
 * removes the language and appearance cookies and the language key in local storage. Nothing is
 * sent anywhere; necessary storage (sign-in, security, guest conversation) is not touched here.
 */
function storedPreferences(): string[] {
  const names = document.cookie.split(';').map((c) => c.trim().split('=')[0]);
  const found = PREFERENCE_COOKIES.filter((name) => names.includes(name));
  for (const key of PREFERENCE_LOCAL_KEYS) {
    try {
      if (window.localStorage.getItem(key) !== null) found.push(key);
    } catch {
      /* storage disabled: nothing stored there */
    }
  }
  return found;
}

export function removePreferenceStorage(): void {
  for (const name of PREFERENCE_COOKIES) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
  for (const key of PREFERENCE_LOCAL_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* best effort */
    }
  }
  document.documentElement.removeAttribute('data-gna-schedule');
}

export function PreferenceStorageControl({
  locale,
}: {
  readonly locale: CookiesPageLocale;
}): JSX.Element {
  const t = COOKIES_PAGE[locale];
  const [stored, setStored] = useState<string[] | null>(null);
  const [removed, setRemoved] = useState(false);
  useEffect(() => setStored(storedPreferences()), []);

  return (
    <div data-privacy="preferences" className="mt-3 flex flex-col items-start gap-2">
      {stored !== null && (
        <p data-privacy="stored" className="text-sm text-ink-secondary">
          {stored.length === 0 ? t.nothing : stored.join(', ')}
        </p>
      )}
      <button
        type="button"
        data-privacy="remove-preferences"
        disabled={stored !== null && stored.length === 0}
        onClick={() => {
          removePreferenceStorage();
          setRemoved(true);
          setStored([]);
          window.setTimeout(() => window.location.reload(), 1200);
        }}
        className="inline-flex min-h-[44px] items-center rounded-[10px] border border-white/30 px-4 text-sm font-semibold text-ink-primary hover:bg-white/10 disabled:opacity-50"
      >
        {t.remove}
      </button>
      {removed && (
        <p role="status" className="text-sm text-ink-secondary">
          {t.removed}
        </p>
      )}
    </div>
  );
}
