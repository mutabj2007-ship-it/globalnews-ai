'use client';

import { useEffect, useLayoutEffect, useRef, useState, type JSX } from 'react';
import Link from 'next/link';
import type { DisplayLocale } from '@globalnews-ai/shared';
import { ASK_PRIMARY_SECTIONS, type AskPrimarySectionId } from '@/lib/askNavModel';
import { askPrimaryNavStrings } from '@/lib/ask/askPrimaryNavStrings';
import { followStrings } from '@/lib/ask/followStrings';
import { askShellStrings } from '@/lib/ask/shell/askShellCatalogue';
import { isPlainClick } from '@/lib/ask/askCleanNavigation';
import styles from './askNav.module.css';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK R3 NAVIGATION / USABILITY R1 — THE R3 PRIMARY NAVIGATION (Ask · My updates · Saved)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * R3 HANDOFF.md §3 L74: phone header ☰ · [Ask | My updates | Saved] · +, no bottom tab bar.
 * Restored on phone AND desktop (CTO R3 conformity rulings, 2026-10-10). One component, used by
 * the Ask frame's header (/ask), the continuity phone header and the desktop bar of the other
 * Ask pages, so the three can never drift.
 *
 * - Destinations come from the model (`ASK_PRIMARY_SECTIONS`); this file hard-codes no href.
 * - The current section is `aria-current="page"`; a plain click on it changes nothing.
 * - No badge and no count: unreviewed state does not exist in the backend (B2).
 * - FITS IN EVERY LOCALE: the full labels render; when they would not fit (R3 §7: "Updates" at
 *   320, and longer locales earlier), the control switches to the short My updates label. The
 *   control itself clips (overflow hidden), so it can never push the page into horizontal scroll.
 *   Zero network: a layout measurement only.
 */
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function AskPrimaryNav({
  locale,
  current,
}: {
  readonly locale: DisplayLocale;
  /** The section this page belongs to; null on pages outside the three (Help, Settings, Recent). */
  readonly current: AskPrimarySectionId | null;
}): JSX.Element {
  const t = askPrimaryNavStrings(locale);
  const shell = askShellStrings(locale);
  const label: Record<AskPrimarySectionId, string> = {
    ask: t.ask,
    updates: followStrings(locale).myUpdates,
    saved: shell.askContinuityStrings.savedTitle,
  };
  const ref = useRef<HTMLElement | null>(null);
  const fullWidth = useRef(0);
  const [compact, setCompact] = useState(false);

  useIsoLayoutEffect(() => {
    const node = ref.current;
    if (node === null) return undefined;
    const parent = node.parentElement;
    /* The width the navigation may take: its row, minus the other visible controls and gaps. */
    const available = (): number => {
      if (parent === null) return node.clientWidth;
      const style = getComputedStyle(parent);
      const gap = Number.parseFloat(style.columnGap) || 0;
      let used = 0;
      let count = 0;
      for (const child of Array.from(parent.children)) {
        if (!(child instanceof HTMLElement)) continue;
        const cs = getComputedStyle(child);
        if (cs.display === 'none' || cs.position === 'absolute' || cs.position === 'fixed') continue;
        count += 1;
        if (child === node) continue;
        /* natural width (a sibling the row has already shrunk still needs its content), and no
           margins: an auto margin resolves to the row's free space, which is not "used" */
        used += Math.max(child.getBoundingClientRect().width, child.scrollWidth);
      }
      const padding = (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0);
      return parent.clientWidth - padding - used - gap * Math.max(0, count - 1);
    };
    const measure = (): void => {
      /* the full labels' natural width, read while they are rendered (items never shrink then) */
      if (node.dataset.compact !== 'true') fullWidth.current = node.scrollWidth;
      const next = fullWidth.current > available() + 0.5;
      if ((node.dataset.compact === 'true') !== next) setCompact(next);
    };
    measure();
    /* web fonts change the labels' width without resizing the row: measure again once loaded */
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) measure();
    });
    if (typeof ResizeObserver === 'undefined') {
      return () => {
        live = false;
      };
    }
    const observer = new ResizeObserver(measure);
    observer.observe(parent ?? node);
    /* its own items (fonts) and every sibling in the row (e.g. the account control appearing
       once the session read resolves) change its room without resizing the row itself */
    for (const item of Array.from(node.children)) observer.observe(item);
    for (const sibling of Array.from(parent?.children ?? [])) observer.observe(sibling);
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [locale]);

  return (
    <nav
      ref={ref}
      aria-label={t.navLabel}
      data-ask-nav="primary"
      data-compact={compact ? 'true' : 'false'}
      className={styles.primaryNav}
    >
      {ASK_PRIMARY_SECTIONS.map((section) => {
        const here = section.id === current;
        return (
          <Link
            key={section.id}
            href={section.href}
            prefetch={false}
            data-ask-nav-primary={section.id}
            aria-current={here ? 'page' : undefined}
            className={styles.primaryItem}
            onClick={(event) => {
              /* Already here: nothing to navigate to (an open conversation stays open). */
              if (here && isPlainClick(event)) event.preventDefault();
            }}
          >
            {section.id === 'updates' ? (
              <>
                <span className={styles.primaryFull}>{label.updates}</span>
                {/* the short label is visual only; the link's name stays the full label */}
                <span aria-hidden="true" className={styles.primaryShort}>
                  {t.myUpdatesShort}
                </span>
              </>
            ) : (
              label[section.id]
            )}
          </Link>
        );
      })}
    </nav>
  );
}
