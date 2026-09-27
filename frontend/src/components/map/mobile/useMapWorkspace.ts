'use client';

import { useEffect, useMemo, useState, type RefObject } from 'react';
import type { SheetStop } from './MobileBottomSheet';
import {
  NAV_BLOCK_FALLBACK_PX,
  computeMapWorkspace,
  isKeyboardOpen,
  raisesKeyboard,
  type MapWorkspaceLayout,
  type WorkspaceDetents,
} from '@/lib/map/spatial/mapWorkspace';

interface ViewportReading {
  readonly layoutHeight: number;
  readonly visualHeight: number;
  readonly bottomOcclusionPx: number;
}

const UNMEASURED: ViewportReading = { layoutHeight: 0, visualHeight: 0, bottomOcclusionPx: 0 };

/*
  visualViewport where the browser has it, innerHeight as the safe fallback.
  The occlusion is the part of the layout viewport the visual viewport does
  not reach — the keyboard, on browsers that do not resize the layout.
*/
function readViewport(): ViewportReading {
  const layoutHeight = window.innerHeight;
  const visual = window.visualViewport;
  const visualHeight = visual ? visual.height : layoutHeight;
  const visualBottom = visual ? visual.offsetTop + visual.height : layoutHeight;

  return {
    layoutHeight,
    visualHeight,
    bottomOcclusionPx: Math.max(0, Math.round(layoutHeight - visualBottom)),
  };
}

/**
 * MAP MOBILE INTERACTION R1 — the measured inputs of the one workspace model.
 *
 * Reads the real visible viewport, whether the keyboard is up, and the bottom
 * nav's REAL rendered height (safe area included). The nav is measured while
 * it is visible and the last measurement is kept while it is hidden, so hiding
 * it at FULL never feeds a zero back into the geometry it is leaving.
 */
export function useMapWorkspace(
  stop: SheetStop,
  navHostRef: RefObject<HTMLElement>,
  detents: WorkspaceDetents,
  /** The shell's PERMANENT_HUD_PX: top bar + Change Strip, all permanent top chrome. */
  permanentHudPx: number,
): MapWorkspaceLayout {
  const [viewport, setViewport] = useState<ViewportReading>(UNMEASURED);
  const [editableFocused, setEditableFocused] = useState(false);
  const [navBlockPx, setNavBlockPx] = useState(NAV_BLOCK_FALLBACK_PX);

  useEffect(() => {
    const measure = (): void => setViewport(readViewport());
    const visual = window.visualViewport;

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    visual?.addEventListener('resize', measure);
    visual?.addEventListener('scroll', measure);

    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      visual?.removeEventListener('resize', measure);
      visual?.removeEventListener('scroll', measure);
    };
  }, []);

  useEffect(() => {
    const onFocusChange = (): void => setEditableFocused(raisesKeyboard(document.activeElement as HTMLElement | null));

    onFocusChange();
    document.addEventListener('focusin', onFocusChange);
    document.addEventListener('focusout', onFocusChange);

    return () => {
      document.removeEventListener('focusin', onFocusChange);
      document.removeEventListener('focusout', onFocusChange);
    };
  }, []);

  useEffect(() => {
    const nav = navHostRef.current?.querySelector('nav');
    if (!nav) return;

    const measure = (): void => {
      const height = nav.getBoundingClientRect().height;
      /* Hidden reads 0: keep the last real height, never adopt the zero. */
      if (height > 0) setNavBlockPx(Math.ceil(height));
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(measure);
    observer.observe(nav);

    return () => observer.disconnect();
  }, [navHostRef]);

  const keyboardOpen = isKeyboardOpen(editableFocused, viewport.layoutHeight, viewport.visualHeight);

  return useMemo(
    () =>
      computeMapWorkspace(
        stop,
        {
          visualViewportHeight: viewport.visualHeight,
          permanentHudPx,
          bottomOcclusionPx: viewport.bottomOcclusionPx,
          navBlockPx,
          keyboardOpen,
        },
        detents,
      ),
    [stop, viewport, navBlockPx, keyboardOpen, detents, permanentHudPx],
  );
}
