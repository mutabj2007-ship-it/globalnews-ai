import type { NewsCategory } from '@globalnews-ai/shared';

export type CategoryFilterValue = NewsCategory | 'all';

const OPTIONS: Array<{ value: CategoryFilterValue; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'world', label: 'World' },
  { value: 'politics', label: 'Politics' },
  { value: 'business', label: 'Business' },
  { value: 'technology', label: 'Technology' },
  { value: 'science', label: 'Science' },
  { value: 'health', label: 'Health' },
];

interface CategoryFilterBarProps {
  value: CategoryFilterValue;
  onChange: (value: CategoryFilterValue) => void;
  disabled?: boolean;
}

export function CategoryFilterBar({
  value,
  onChange,
  disabled = false,
}: CategoryFilterBarProps): JSX.Element {
  return (
    <div
      role="group"
      aria-label="Filter this country's coverage by category"
      className="flex flex-wrap gap-2"
    >
      {OPTIONS.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={`rounded-full border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isActive
                ? 'border-signal bg-signal/15 text-signal-bright'
                : 'border-border-strong bg-surface text-ink-tertiary hover:text-ink-primary'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
