'use client';

import { useEffect, useRef } from 'react';

/**
 * PART IV §2.2 — THE CALM-MAP CONSTRAINT, MADE STRUCTURAL.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RULE THIS COMPONENT EXISTS TO MAKE UNBREAKABLE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * "Layering is never solved by adding permanent rail content or vertical
 * scrolling. Permanent rail content is capped at what fits ONE VIEWPORT without
 * scroll. Every new capability must earn its place by REPLACING rail content,
 * opening a DRAWER OVER IT, or moving to the WORKSPACE — never by extending the
 * column."
 *
 * Part IV adds four sustained surfaces — composer, timeline, watchboard, source
 * list — and any one of them appended to the rail would break that rule on its
 * own. All four arrive through here instead.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY IT IS AN OVERLAY AND NOT A CONDITIONAL RENDER
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * "Opens OVER the rail, not in addition to it."
 *
 * Rendering the drawer INSTEAD of the rail would lose the reader's scroll
 * position and the card's own state every time they opened a timeline — the
 * rail would have to be rebuilt on close, and a rebuilt card is a card that
 * forgot where it was. So the rail stays mounted underneath, the drawer covers
 * it absolutely, and closing is a genuine return rather than a re-render.
 *
 * It also means the drawer occupies EXACTLY the rail's box. It never widens the
 * column, never overlaps the map, and never becomes a modal — §12.2 forbids a
 * modal on selection or navigation, and a drawer that escaped its column would
 * be one in everything but name.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DISMISSAL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Escape closes, and focus moves into the drawer on open so a keyboard user is
 * not left behind the panel they just opened. Clicking away is NOT a dismissal
 * here: this container carries sustained configuration — a composer the user is
 * part-way through — and losing that to a stray click on the map would be the
 * opposite of calm. Anchored popups, which are the seconds-long surfaces, do
 * dismiss on outside click; that is `AnchoredPopover`'s job, not this one.
 */

export interface RailDrawerProps {
  readonly open: boolean;
  readonly title: string;
  readonly closeLabel: string;
  readonly onClose: () => void;
  /** Marks the drawer for the guards and for per-surface styling hooks. */
  readonly surface: 'composer' | 'timeline' | 'watchboard' | 'activation';
  readonly children: React.ReactNode;
}

export function RailDrawer({
  open,
  title,
  closeLabel,
  onClose,
  surface,
  children,
}: RailDrawerProps): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKey);
    /* The heading, not the close button: a reader should hear what opened. */
    panelRef.current?.focus();

    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-label={title}
      data-gn="rail-drawer"
      data-gn-surface={surface}
      /*
        `absolute inset-0` — the drawer IS the rail's box, never larger. The
        opaque background is what makes it a cover rather than a translucent
        layer over text, which would be unreadable on the petrol surface.

        `aria-modal="false"` is deliberate: the map beside it stays live and
        operable, because the reader is configuring something ABOUT the map and
        needs to see it. A true modal would contradict §12.2.
      */
      className="absolute inset-0 z-30 flex flex-col overflow-hidden border-s border-sp-line-2 bg-sp-panel outline-none"
    >
      <header className="flex shrink-0 items-center justify-between gap-[10px] border-b border-sp-line px-[14px] py-[11px]">
        <h2 className="font-gn-mono text-[10px] uppercase tracking-[0.16em] text-sp-ink-2">
          {title}
        </h2>
        <button
          type="button"
          data-gn="rail-drawer-close"
          onClick={onClose}
          aria-label={closeLabel}
          className="flex h-[28px] w-[28px] items-center justify-center rounded-[2px] border border-sp-line-2 font-gn-mono text-[12px] leading-none text-sp-ui-idle outline-none transition-colors hover:border-sp-cyan/45 hover:text-sp-cyan focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-sp-cyan"
        >
          ×
        </button>
      </header>

      {/*
        THE DRAWER SCROLLS; THE RAIL DOES NOT. That is not a contradiction of the
        calm-map rule — the rule caps PERMANENT rail content at one viewport, and
        a drawer is a place the reader deliberately opened for a task that has a
        length. A composer with five chain links has to go somewhere.
      */}
      <div
        data-gn="rail-drawer-body"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[14px] py-[12px]"
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The seconds-long container from §2.2 — "one question, one answer, then gone".
 *
 * Anchored to the thing it describes and DISMISSIBLE BY CLICKING AWAY, which is
 * the behavioural difference from the drawer above: nothing here is being built,
 * so nothing is lost by dismissing it. Used by the change-state explainer, the
 * sensitivity picker and the action-cost prompt.
 */
export interface AnchoredPopoverProps {
  readonly open: boolean;
  readonly label: string;
  readonly onDismiss: () => void;
  readonly align?: 'left' | 'right';
  readonly children: React.ReactNode;
}

export function AnchoredPopover({
  open,
  label,
  onDismiss,
  align = 'left',
  children,
}: AnchoredPopoverProps): JSX.Element | null {
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onDismiss();
    };
    const onPointer = (event: PointerEvent): void => {
      const box = boxRef.current;

      if (box !== null && !box.contains(event.target as Node)) onDismiss();
    };

    window.addEventListener('keydown', onKey);
    /*
      Capture phase, and on pointerDOWN rather than click: a click that starts
      inside the popover and ends outside — a text selection drag — must not
      dismiss it, and only the down event tells us where the gesture began.
    */
    window.addEventListener('pointerdown', onPointer, true);

    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label={label}
      data-gn="anchored-popover"
      className={`absolute top-[calc(100%+6px)] z-40 w-[260px] rounded-[3px] border border-sp-line-2 bg-sp-panel-2 p-[11px] shadow-[0_10px_28px_rgba(2,6,9,.6)] ${
        align === 'right' ? 'right-0' : 'left-0'
      }`}
    >
      {children}
    </div>
  );
}
