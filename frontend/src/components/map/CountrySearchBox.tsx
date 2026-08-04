'use client';

import { useId, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { Search } from 'lucide-react';
import { searchCountriesByName, type CountryMeta } from '@globalnews-ai/shared';

interface CountrySearchBoxProps {
  onSelectCountry: (country: CountryMeta) => void;
}

export function CountrySearchBox({ onSelectCountry }: CountrySearchBoxProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CountryMeta[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const listboxId = useId();

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const value = event.target.value;
    setQuery(value);
    const matches = searchCountriesByName(value, 8);
    setResults(matches);
    setActiveIndex(matches.length > 0 ? 0 : -1);
    setIsOpen(matches.length > 0);
  }

  function selectResult(country: CountryMeta): void {
    onSelectCountry(country);
    setQuery(country.name);
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (!isOpen || results.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0) selectResult(results[activeIndex]);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  }

  return (
    <div className="relative w-full max-w-sm">
      <label htmlFor="country-search-input" className="sr-only">
        Search for a country by name
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2.5 focus-within:border-signal">
        <Search size={16} className="shrink-0 text-ink-tertiary" strokeWidth={2} />
        <input
          id="country-search-input"
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 120)}
          placeholder="Search for a country (e.g. Spain)"
          className="w-full bg-transparent text-sm text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
        />
      </div>

      {isOpen && results.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-border-strong bg-surface shadow-lg"
        >
          {results.map((country, index) => (
            <li
              key={country.iso3}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
            >
              <button
                type="button"
                onMouseDown={(event: MouseEvent) => event.preventDefault()}
                onClick={() => selectResult(country)}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                  index === activeIndex
                    ? 'bg-surface-hover text-signal-bright'
                    : 'text-ink-primary hover:bg-surface-hover'
                }`}
              >
                <span>{country.name}</span>
                <span className="font-mono text-[11px] text-ink-tertiary">{country.iso3}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
