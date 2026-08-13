import type { LanguageCode, NewsCategory } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';

export type CategoryFilterValue = NewsCategory | 'all';

const VALUES: CategoryFilterValue[] = ['all', 'world', 'politics', 'business', 'technology', 'science', 'health'];

interface CategoryFilterBarProps {
  value: CategoryFilterValue;
  onChange: (value: CategoryFilterValue) => void;
  disabled?: boolean;
  /** Milestone #49 — defaults to 'en', so every pre-M49 caller renders exactly as before. */
  language?: LanguageCode;
}

/**
 * Milestone #49 — category labels ('All', 'World', 'Politics', ...)
 * are GlobalNews AI UI copy (Category A), now looked up from the new
 * `map.categories` dictionary group by the SAME NewsCategory value
 * already used everywhere else in this codebase — no new category
 * taxonomy introduced, only its presentation label localized.
 */
export function CategoryFilterBar({
  value,
  onChange,
  disabled = false,
  language = 'en',
}: CategoryFilterBarProps): JSX.Element {
  const categories = getDictionary(language).map.categories;
  const t = getDictionary(language).map;

  return (
    <div
      role="group"
      aria-label={t.categoryFilterAriaLabel}
      className="flex flex-wrap gap-2"
    >
      {VALUES.map((optionValue) => {
        const isActive = optionValue === value;
        return (
          <button
            key={optionValue}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => onChange(optionValue)}
            className={`rounded-full border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isActive
                ? 'border-signal bg-signal/15 text-signal-bright'
                : 'border-border-strong bg-surface text-ink-tertiary hover:text-ink-primary'
            }`}
          >
            {categories[optionValue] ?? optionValue}
          </button>
        );
      })}
    </div>
  );
}
