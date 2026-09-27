'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
} from 'react';

/**
 * Shared expanding question/search composer.
 *
 * Keeps long pasted text readable without a visible native scrollbar, grows
 * smoothly until a bounded viewport-aware ceiling, then remains internally
 * scrollable (with the scrollbar visually hidden). On phones it reacts to the
 * VisualViewport so the active composer stays above the software keyboard.
 *
 * This component is presentation/interaction only. It never submits, navigates,
 * fetches, or starts AI by itself.
 */
export interface AdaptiveTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'> {
  /** Compact resting height for an empty / one-line composer. */
  minHeight?: number;
  /** Hard ceiling on large screens. */
  maxHeight?: number;
  /** Additional ceiling derived from the currently visible viewport. */
  maxViewportFraction?: number;
  /** Keep the active composer inside the visual viewport as keyboards resize it. */
  keepVisible?: boolean;
}

/**
 * SEARCH COMPOSER 1000-CHAR GEOMETRY R1 — the sizing arithmetic, moved VERBATIM
 * out of resize() below so it can be measured without a DOM. Behaviour for
 * every caller is unchanged: resize() now calls exactly these two functions.
 */
export function estimateComposerContentHeight(input: {
  readonly value: string;
  readonly clientWidth: number;
  readonly lineHeight: number;
  readonly padding: number;
}): number {
  const explicitLines = (input.value.match(/\n/g) ?? []).length + 1;
  const charsPerVisualLine = Math.max(28, Math.floor(input.clientWidth / 8.2));
  const estimatedLines = Math.max(explicitLines, Math.ceil(input.value.length / charsPerVisualLine));
  return estimatedLines * input.lineHeight + input.padding + 2;
}

export function computeComposerGeometry(input: {
  readonly visibleHeight: number;
  readonly minHeight: number;
  readonly maxHeight: number;
  readonly maxViewportFraction: number;
  /** max(scrollHeight, estimated content height) */
  readonly contentHeight: number;
}): { readonly height: number; readonly ceiling: number; readonly overflowY: 'auto' | 'hidden' } {
  const viewportCeiling = Math.floor(input.visibleHeight * input.maxViewportFraction);
  const ceiling = Math.max(input.minHeight, Math.min(input.maxHeight, viewportCeiling));
  const height = Math.max(input.minHeight, Math.min(input.contentHeight, ceiling));
  return { height, ceiling, overflowY: input.contentHeight > ceiling ? 'auto' : 'hidden' };
}

export const AdaptiveTextarea = forwardRef<HTMLTextAreaElement, AdaptiveTextareaProps>(
  function AdaptiveTextarea(
    {
      minHeight = 44,
      maxHeight = 280,
      maxViewportFraction = 0.38,
      keepVisible = true,
      className = '',
      value,
      onInput,
      onFocus,
      ...props
    },
    forwardedRef,
  ) {
    const localRef = useRef<HTMLTextAreaElement | null>(null);

    useImperativeHandle(forwardedRef, () => localRef.current as HTMLTextAreaElement, []);

    const visibleHeight = useCallback((): number => {
      if (typeof window === 'undefined') return maxHeight;
      return window.visualViewport?.height ?? window.innerHeight;
    }, [maxHeight]);

    const resize = useCallback((): void => {
      const node = localRef.current;
      if (node === null) return;

      /*
       * R2 — true elasticity.
       *
       * The first implementation trusted scrollHeight alone. In the live
       * Chromium build that still left long pasted questions looking like a
       * one-line/search control on some surfaces, and the dock fell back to a
       * tiny internally scrolling strip. Measure after layout, force wrapping,
       * and keep a content-length floor as a defensive fallback.
       */
      node.style.height = 'auto';
      node.style.whiteSpace = 'pre-wrap';
      node.style.overflowWrap = 'anywhere';

      const lineHeight = Number.parseFloat(window.getComputedStyle(node).lineHeight) || 22;
      const padding =
        Number.parseFloat(window.getComputedStyle(node).paddingTop) +
        Number.parseFloat(window.getComputedStyle(node).paddingBottom);
      const estimatedHeight = estimateComposerContentHeight({
        value: node.value,
        clientWidth: node.clientWidth,
        lineHeight,
        padding,
      });

      const contentHeight = Math.max(node.scrollHeight, estimatedHeight);
      const { height: desired, ceiling, overflowY } = computeComposerGeometry({
        visibleHeight: visibleHeight(),
        minHeight,
        maxHeight,
        maxViewportFraction,
        contentHeight,
      });

      node.style.height = `${desired}px`;
      node.style.maxHeight = `${ceiling}px`;
      node.style.overflowY = overflowY;
      node.style.overflowX = 'hidden';
      node.style.scrollbarWidth = 'none';
    }, [maxHeight, maxViewportFraction, minHeight, visibleHeight]);

    const keepInsideVisualViewport = useCallback(
      (behavior: ScrollBehavior = 'smooth'): void => {
        if (!keepVisible || typeof window === 'undefined') return;
        const node = localRef.current;
        if (node === null || document.activeElement !== node) return;

        const viewport = window.visualViewport;
        const viewportTop = viewport?.offsetTop ?? 0;
        const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
        const rect = node.getBoundingClientRect();
        const margin = 20;

        if (rect.bottom > viewportBottom - margin) {
          window.scrollBy({
            top: rect.bottom - (viewportBottom - margin),
            behavior,
          });
        } else if (rect.top < viewportTop + margin) {
          window.scrollBy({
            top: rect.top - (viewportTop + margin),
            behavior,
          });
        }
      },
      [keepVisible],
    );

    useLayoutEffect(() => {
      resize();
    }, [resize, value]);

    useEffect(() => {
      if (typeof window === 'undefined') return undefined;
      const viewport = window.visualViewport;
      const handleResize = (): void => {
        resize();
        requestAnimationFrame(() => keepInsideVisualViewport('auto'));
      };
      viewport?.addEventListener('resize', handleResize);
      viewport?.addEventListener('scroll', handleResize);
      window.addEventListener('resize', handleResize);
      return () => {
        viewport?.removeEventListener('resize', handleResize);
        viewport?.removeEventListener('scroll', handleResize);
        window.removeEventListener('resize', handleResize);
      };
    }, [keepInsideVisualViewport, resize]);

    return (
      <textarea
        {...props}
        ref={localRef}
        rows={1}
        value={value}
        onInput={(event) => {
          /*
           * Paste/input can update layout one frame after the event itself.
           * Resize now for responsive typing and again on the next frame for
           * reliable multi-paragraph paste geometry.
           */
          resize();
          requestAnimationFrame(resize);
          onInput?.(event);
        }}
        onFocus={(event) => {
          onFocus?.(event);
          resize();
          requestAnimationFrame(resize);
          if (!keepVisible) return;
          requestAnimationFrame(() => keepInsideVisualViewport());
          window.setTimeout(() => keepInsideVisualViewport(), 180);
        }}
        data-gn-adaptive-composer=""
        wrap="soft"
        className={`gn-adaptive-textarea resize-none overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words transition-[height] duration-150 ease-out motion-reduce:transition-none ${className}`}
      />
    );
  },
);

AdaptiveTextarea.displayName = 'AdaptiveTextarea';
