'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * R4 SUPPORT UX CLOSURE — the support category selector, dark when open.
 *
 * WHY THIS IS NOT A NATIVE `<select>`.
 *
 * It was one. Closed, it inherited the page and looked correct; opened, the
 * browser painted its option list from the platform's LIGHT palette, which is
 * the defect this replaces. That popup is not part of the page's compositing
 * tree, so no class on the control can reach it — a fact this codebase already
 * established the hard way. `globals.css` declares `color-scheme: dark` at
 * `:root`, which is the only standards-based lever available and which already
 * applies to this control; it was integrated for exactly this problem and then
 * FAILED visual acceptance, because what it produces is a dark PLATFORM menu
 * rather than GlobalNews AI chrome, and because Windows forced-colors mode and
 * Safari override it outright. Declaring it a second time is not an option
 * either: `nativeControlScheme.spec.ts` asserts the file carries exactly one
 * such declaration.
 *
 * So the control is authored, and it follows the pattern already shipped in
 * `search/LanguageSelector.tsx` rather than inventing a second one: a
 * `role="combobox"` trigger plus an authored `role="listbox"`, with FOCUS
 * STAYING ON THE TRIGGER for the whole interaction and the active row
 * communicated by `aria-activedescendant`. No new dependency — this project
 * has no Radix, no Headless UI, and does not acquire one for a dropdown.
 *
 * WHAT KEEPS IT ACCESSIBLE, and what the spec beside this file asserts:
 *   - the trigger is a real `<button type="button">`, so it is reachable and
 *     operable by keyboard and by assistive technology without help;
 *   - Up/Down/Home/End move the active row WITHOUT committing, so a screen
 *     reader user can hear the list before choosing;
 *   - Enter and Space commit; Escape closes and commits nothing;
 *   - a click outside closes it, and focus returns to the trigger;
 *   - every surface is opaque and dark, and the palette is the same one the
 *     rest of the Support surface already uses.
 *
 * IT RENDERS THE OPTIONS IT IS GIVEN. The category vocabulary stays in
 * `NewSupportRequestForm`, which maps `SUPPORT_CATEGORIES` — this file names
 * no category and would not notice one being added.
 */

export interface CategorySelectOption<TValue extends string> {
  value: TValue;
  label: string;
}

export function CategorySelect<TValue extends string>({
  value,
  options,
  placeholder,
  label,
  labelledBy,
  invalid,
  describedBy,
  onChange,
}: {
  value: TValue | '';
  options: ReadonlyArray<CategorySelectOption<TValue>>;
  /** Shown on the trigger while nothing is chosen. */
  placeholder: string;
  /** The visible field label, reused as the listbox's accessible name. */
  label: string;
  /** id of the visible label element, which names the trigger. */
  labelledBy: string;
  invalid?: boolean;
  describedBy?: string;
  onChange: (next: TValue) => void;
}): JSX.Element {
  const instance = useId();
  const listboxId = `${instance}-listbox`;
  const optionId = (option: string): string => `${instance}-option-${option}`;

  const [isOpen, setIsOpen] = useState(false);
  const [activeValue, setActiveValue] = useState<TValue | ''>(value);
  /**
   * Whether the active row was reached by keyboard. A pointer hover moves the
   * row too, but it must not paint the keyboard focus ring, or a mouse user
   * sees a focus indicator that does not describe where focus is.
   */
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const selected = options.find((option) => option.value === value);
  const activeIndex = options.findIndex((option) => option.value === activeValue);

  /*
    CLOSE ON A CLICK OUTSIDE. `pointerdown` rather than `click`, so the
    list is gone before a click on something behind it resolves. The
    listener exists only while the list is open, and is always removed.
  */
  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent): void => {
      const wrapper = wrapperRef.current;
      if (wrapper && event.target instanceof Node && !wrapper.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen]);

  const open = (keyboard: boolean): void => {
    setActiveValue(value === '' ? (options[0]?.value ?? '') : value);
    setIsKeyboardActive(keyboard);
    setIsOpen(true);
  };

  const close = (): void => {
    setIsOpen(false);
    setIsKeyboardActive(false);
    triggerRef.current?.focus();
  };

  /** The ONLY path that changes the value. Arrow keys never reach it. */
  const commit = (next: TValue): void => {
    onChange(next);
    setActiveValue(next);
    setIsOpen(false);
    setIsKeyboardActive(false);
    triggerRef.current?.focus();
  };

  const moveActive = (delta: number): void => {
    if (options.length === 0) return;
    const from = activeIndex < 0 ? 0 : activeIndex;
    const next = (from + delta + options.length) % options.length;
    setActiveValue(options[next].value);
    setIsKeyboardActive(true);
  };

  const jumpActive = (edge: 'first' | 'last'): void => {
    if (options.length === 0) return;
    setActiveValue(edge === 'first' ? options[0].value : options[options.length - 1].value);
    setIsKeyboardActive(true);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (!isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter') {
        event.preventDefault();
        open(true);
      }
      return;
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        close();
        return;
      case 'ArrowDown':
        event.preventDefault();
        moveActive(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        moveActive(-1);
        return;
      case 'Home':
        event.preventDefault();
        jumpActive('first');
        return;
      case 'End':
        event.preventDefault();
        jumpActive('last');
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (activeValue !== '') commit(activeValue);
        return;
      case 'Tab':
        setIsOpen(false);
        setIsKeyboardActive(false);
        return;
      default:
        return;
    }
  };

  /*
    EVERY SURFACE HERE IS OPAQUE. bg-surface (#0f1420) and
    bg-surface-raised (#161d2c) are the Support surface's own tokens, over
    bg-void (#080b12). Nothing is translucent and nothing inherits the
    platform, which is the whole point of replacing the native popup.
  */
  const triggerClass = [
    'flex w-full items-center justify-between gap-3 rounded border px-3 py-2 text-left',
    'bg-surface text-ink-primary',
    invalid ? 'border-red-400' : 'border-cyan-500/20',
  ].join(' ');

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={isOpen && activeValue !== '' ? optionId(activeValue) : undefined}
        aria-labelledby={labelledBy}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className={triggerClass}
        onClick={() => (isOpen ? close() : open(false))}
        onKeyDown={onKeyDown}
      >
        <span className={selected ? 'text-ink-primary' : 'text-ink-secondary'}>
          {selected ? selected.label : placeholder}
        </span>
        <span aria-hidden="true" className="text-ink-secondary">
          ▾
        </span>
      </button>

      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-72 overflow-y-auto rounded border border-border-strong bg-surface py-1 shadow-lg"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            const isActive = option.value === activeValue;

            const rowClass = [
              'cursor-pointer px-3 py-2 text-sm',
              isActive ? 'bg-surface-raised text-ink-primary' : 'text-ink-primary',
              isActive && isKeyboardActive ? 'shadow-[inset_0_0_0_1px_rgba(108,147,255,0.9)]' : '',
              isSelected ? 'font-medium' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <li
                key={option.value}
                id={optionId(option.value)}
                role="option"
                aria-selected={isSelected}
                className={rowClass}
                onPointerEnter={() => {
                  setActiveValue(option.value);
                  setIsKeyboardActive(false);
                }}
                onClick={() => commit(option.value)}
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
