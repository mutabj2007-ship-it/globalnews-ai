'use client';

import type { LanguageCode } from '@globalnews-ai/shared';
import type { ChangeEvent } from 'react';
import { ACTIVE_LANGUAGES, LANGUAGE_NATIVE_LABELS } from '@/lib/i18n/languages';

interface LanguageSelectorProps {
  value: LanguageCode;
  onChange: (language: LanguageCode) => void;
  label: string;
  className?: string;
}

/**
 * Milestone #47 (runtime correction) — extracted from SearchPageClient
 * into its own small, reusable component so the SAME selector (and,
 * critically, the SAME ACTIVE_LANGUAGES list / persistence utilities)
 * can be placed on the homepage as well, without creating a second,
 * independently-drifting language state. Only the two production-
 * active languages (see i18n/languages.ts's ACTIVE_LANGUAGES) are ever
 * rendered as options — sw/fr/es/ar/rw remain LanguageCode members
 * only, never selectable here, regardless of how many languages the
 * backend retrieval-strategy resolver already knows about.
 *
 * This component does not itself decide WHERE the selected language is
 * persisted or how it travels to the next page — the caller (homepage
 * or SearchPageClient) is responsible for calling
 * persistLanguageSelection() (see i18n/languages.ts) in its own
 * onChange handler, exactly as SearchPageClient already does. Because
 * both pages read the SAME localStorage key via resolveInitialLanguage()
 * on mount, a homepage selection is automatically picked up by the
 * search page without any additional URL/query-param plumbing — one
 * shared source of truth, not two unrelated states.
 */
export function LanguageSelector({ value, onChange, label, className = '' }: LanguageSelectorProps): JSX.Element {
  return (
    <label className={`flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-ink-tertiary ${className}`}>
      {label}
      <select
        value={value}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value as LanguageCode)}
        className="rounded-md border border-border bg-surface px-2 py-1 text-ink-primary"
        aria-label={label}
      >
        {ACTIVE_LANGUAGES.map((code) => (
          <option key={code} value={code}>
            {LANGUAGE_NATIVE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
