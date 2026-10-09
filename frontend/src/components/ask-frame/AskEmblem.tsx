'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type JSX } from 'react';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ASK READING EXPERIENCE R1 — THE OWNER-APPROVED EMBLEM, IDLE ONLY
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Authority: H-FREEZE `EMBLEM-FREEZE.md` over Design `MOTION_SPEC.md`
 * (GLOBALNEWSAI-ASK-READING-EXPERIENCE-R1-DESIGN.zip, SHA-256 e06a8278…3bf1).
 *
 * PROVENANCE OF THE INLINED GEOMETRY. The drawing below is the drawing payload of
 *   assets/emblem/gna-emblem-navy-idle.svg   SHA-256 c1c6573ba67ec9bad519ad0dbc59e54a434176e68c454d6fdc3ad73b7542c33a
 * with its C2PA `<metadata>` manifest stripped (7,737 of 9,577 bytes; it documents the design
 * artefact and has no function in a bundle). Geometry and navy colours are byte-for-byte the
 * source's. The light adaptation
 *   assets/emblem/gna-emblem-light-idle.svg  SHA-256 81e8be90eed8bae3275bf651002b8c51922fa9e90270c98ba4be38736d7d5601
 * differs in exactly three colour values, and only those three are applied in a light scope,
 * from `--ask-read-emblem-*` tokens: glow outer stop #22d3ee · sweep #0e7490 at .85 · arc #0e9fb5.
 * Owner source: Claude Design project 0cde14f5-5874-4199-8fad-6f5dc4c861af, Emblem.dc.html
 * v1786981298669628 (SHA-256 af9f35e3…aa12). The product mark (Logo.tsx) is not used here.
 *
 * IDLE IS NOT RESEARCH. The emblem renders only in the ready and typing states. When a request
 * starts it fades out (200 ms) with its motion stopped and then UNMOUNTS — it is never left in
 * the DOM hidden, and its sweep is never a loading indicator. Motion is CSS on three hooks (globals.css, `gna-ask-emblem*`)
 * (`gna-sweep` 32 s, `gna-arc` 96 s, `gna-core` 8 s), composited properties only, paused when
 * the tab is hidden or the mark is off-screen, and off entirely under reduced motion, where the
 * mark rests at the canonical sweep-000 pose. Decorative: `aria-hidden`, nothing announced.
 */
export type AskEmblemState = 'ready' | 'typing' | 'leaving';

const LEAVE_MS = 200;

/**
 * PHONE TYPING EMBLEM REPAIR R1 — how the typing mark fits a short VISIBLE viewport.
 *
 * The approved Design keeps an understated emblem visible while typing; only a SUBMIT removes it.
 * The previous rule hid it outright whenever `visualViewport.height < 480`, which is exactly the
 * iPhone Safari keyboard-open state, so the mark vanished on iOS while other phones kept it.
 *
 * The decision is now made from the SPACE the mark actually has, never from a device or a single
 * height threshold: inside its scroll container (the Ask reader / the dock body) the free space is
 * `container height − (content height without the emblem's own box)`. The composer lives outside
 * that container, so it always keeps its place above the keyboard; the emblem only ever adapts:
 *   full     the CSS typing size fits — nothing changes (desktop, tablets, taller phones);
 *   compact  it does not: the emblem's own spacing goes first, then the mark shrinks toward
 *            COMPACT_MIN_PX, using exactly the space there is;
 *   none     not even COMPACT_MIN_PX fits (e.g. a landscape phone with the keyboard open): the
 *            composer wins and the mark steps aside — the last resort, not the rule.
 */
export type AskEmblemFit = 'full' | 'compact' | 'none';
export const COMPACT_MIN_PX = 48;
/** The emblem's resting bottom margin (`.gna-ask-emblem`), released first when space is short. */
const RESTING_MARGIN_PX = 4;

/**
 * Pure fit decision. `free` is the vertical space available to the emblem's box including its
 * margin; `nominal` is the CSS typing size for this placement and container width.
 */
export function emblemTypingFit(free: number, nominal: number): { fit: AskEmblemFit; size: number } {
  if (!Number.isFinite(free) || !Number.isFinite(nominal) || nominal <= 0) return { fit: 'full', size: nominal };
  if (free >= nominal + RESTING_MARGIN_PX) return { fit: 'full', size: nominal };
  const size = Math.floor(Math.min(nominal, free));
  if (size >= COMPACT_MIN_PX) return { fit: 'compact', size };
  return { fit: 'none', size: 0 };
}

/** The nearest ancestor that scrolls vertically — the box the emblem has to fit inside. */
function scrollContainerOf(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node !== null) {
    const overflowY = window.getComputedStyle(node).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Free vertical space for the emblem's box inside `container`: its inner height minus the height
 * of everything else it holds. Measured from the children's boxes (not `scrollHeight`), so a
 * bottom-aligned column whose content overflows upward is still measured correctly.
 */
function freeSpaceFor(el: HTMLElement, container: HTMLElement): number {
  const style = window.getComputedStyle(container);
  const inner =
    container.clientHeight - (parseFloat(style.paddingTop) || 0) - (parseFloat(style.paddingBottom) || 0);
  let top = Infinity;
  let bottom = -Infinity;
  for (const child of Array.from(container.children)) {
    const box = child.getBoundingClientRect();
    if (box.height === 0 && box.width === 0) continue;
    top = Math.min(top, box.top);
    bottom = Math.max(bottom, box.bottom);
  }
  const content = Number.isFinite(top) ? bottom - top : 0;
  const own = el.getBoundingClientRect().height + (parseFloat(window.getComputedStyle(el).marginBottom) || 0);
  return inner - (content - own);
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

export function AskEmblem({
  state,
  placement,
}: {
  /** `leaving` = a request just started: fade out, motion stopped, then unmount. */
  readonly state: AskEmblemState;
  /** `dock` is always the phone layout's dock sizes; `page` sizes from the Ask root container. */
  readonly placement: 'page' | 'dock';
}): JSX.Element | null {
  const node = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);
  const [paused, setPaused] = useState(false);
  const [fit, setFit] = useState<{ fit: AskEmblemFit; size: number }>({ fit: 'full', size: 0 });
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  /* Leaving keeps the size it had (typing, almost always): it fades, it never grows back. */
  const from = useRef<'ready' | 'typing'>('ready');
  if (state !== 'leaving') from.current = state;

  /* Leaving: unmount after the fade — at once under reduced motion (no transition to wait for). */
  useEffect(() => {
    if (state !== 'leaving') {
      setGone(false);
      return;
    }
    if (prefersReducedMotion()) {
      setGone(true);
      return;
    }
    const timer = setTimeout(() => setGone(true), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [state]);

  /* Pause when the tab is hidden or the mark is outside the viewport. */
  useEffect(() => {
    const el = node.current;
    /* A non-browser renderer (tests, SSR) has no document events or observers: nothing to pause. */
    if (el === null || typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
    let offscreen = false;
    const sync = () => setPaused(document.hidden || offscreen);
    document.addEventListener('visibilitychange', sync);
    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver === 'function' && typeof Element !== 'undefined' && el instanceof Element) {
      observer = new IntersectionObserver((entries) => {
        offscreen = entries.every((entry) => !entry.isIntersecting);
        sync();
      });
      observer.observe(el);
    }
    sync();
    return () => {
      document.removeEventListener('visibilitychange', sync);
      observer?.disconnect();
    };
  }, [gone]);

  /*
    PHONE TYPING EMBLEM REPAIR R1 — typing fits the mark to the space it has (see emblemTypingFit).
    Ready is never measured (136 is the Design's entry size); leaving keeps the fit it had while it
    fades, so a compact mark never grows back for its last 200 ms.
  */
  useEffect(() => {
    if (state === 'leaving') return;
    if (state !== 'typing') {
      setFit({ fit: 'full', size: 0 });
      return;
    }
    const el = node.current;
    /* Only a laid-out DOM element can be measured (not SSR, not a test renderer's mock ref). */
    if (typeof HTMLElement === 'undefined' || !(el instanceof HTMLElement)) return;
    const container = scrollContainerOf(el);
    if (container === null) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      /* The CSS typing size for this placement and container width (64 · 72 · 48 dock). */
      const nominal = parseFloat(window.getComputedStyle(el).getPropertyValue('--emblem-typing-size')) || 0;
      const next = emblemTypingFit(freeSpaceFor(el, container), nominal);
      setFit((prev) => (prev.fit === next.fit && prev.size === next.size ? prev : next));
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(measure);
    };
    measure();
    const viewport = window.visualViewport ?? undefined;
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(schedule);
      observer.observe(container);
      for (const child of Array.from(container.children)) observer.observe(child);
    }
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
    };
  }, [state]);

  if (gone) return null;
  return (
    <div
      ref={node}
      aria-hidden="true"
      data-ask="emblem"
      data-ask-emblem-state={state}
      data-ask-emblem-from={state === 'leaving' ? from.current : undefined}
      data-ask-emblem-placement={placement}
      data-ask-emblem-paused={paused ? 'true' : undefined}
      data-ask-emblem-fit={fit.fit === 'full' ? undefined : fit.fit}
      style={fit.fit === 'compact' ? ({ '--emblem-fit-size': `${fit.size}px` } as CSSProperties) : undefined}
      className="gna-ask-emblem"
    >
      <AskEmblemSvg id={id} />
    </div>
  );
}

/**
 * ASK DESIGN COMPLETENESS R1 — the ONE inlined drawing of the owner-approved emblem, shared by
 * the animated welcome emblem above and the static header mark below, so the geometry exists
 * exactly once in the bundle. Classes are the motion hooks; whether they move is decided by
 * the wrapper (`gna-ask-emblem` animates them only under reduced-motion: no-preference; the
 * header mark never does).
 */
function AskEmblemSvg({
  id,
  size = 40,
  still = false,
}: {
  readonly id: string;
  readonly size?: number;
  /** The header mark: the motion hooks keep their light-adaptation classes but never animate. */
  readonly still?: boolean;
}): JSX.Element {
  const motion = still ? { style: { animation: 'none' } } : {};
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} overflow="visible" focusable="false">
      <defs>
        <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity=".42" />
          <stop offset="55%" stopColor="#0e7490" stopOpacity=".16" />
          <stop offset="100%" stopColor="#04060c" stopOpacity="0" className="gna-ask-emblem-glow-edge" />
        </radialGradient>
        <filter id={`${id}-blur`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="20" cy="20" r="19" fill={`url(#${id}-glow)`} />
      <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(34,211,238,.62)" strokeWidth="1.3" />
      <g className="gna-arc gna-ask-emblem-arc" {...motion}>
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          stroke="rgba(103,232,249,.95)"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeDasharray="15 98"
        />
      </g>
      <circle cx="20" cy="20" r="13.5" fill="none" stroke="rgba(34,211,238,.3)" strokeWidth="1" />
      <circle
        cx="20"
        cy="20"
        r="9"
        fill="none"
        stroke="rgba(34,211,238,.5)"
        strokeWidth="1"
        strokeDasharray="3 5"
      />
      <g stroke="rgba(103,232,249,.75)" strokeWidth="1.2" strokeLinecap="round">
        <path d="M20 0.6 v3.4" />
        <path d="M20 36 v3.4" />
        <path d="M0.6 20 h3.4" />
        <path d="M36 20 h3.4" />
      </g>
      <g className="gna-sweep gna-ask-emblem-sweep" {...motion}>
        <path
          d="M20 20 L20 4.5"
          stroke="rgba(103,232,249,.55)"
          strokeWidth="1.1"
          strokeLinecap="round"
          fill="none"
        />
      </g>
      {/* The source's expanding "ping" ring is NOT used in Ask: static at r7, opacity .55. */}
      <circle cx="20" cy="20" r="7" fill="none" stroke="#67e8f9" strokeWidth="1" opacity=".55" />
      <circle
        className="gna-core gna-ask-emblem-core"
          {...motion}
        cx="20"
        cy="20"
        r="4.6"
        fill="#22d3ee"
        filter={`url(#${id}-blur)`}
      />
    </svg>
  );
}

/**
 * ASK DESIGN COMPLETENESS R1 — THE HEADER MARK (MOTION_SPEC "Header mark": 24 px, every state,
 * opacity 1, no motion — the static file). It sits beside the wordmark in the 56 px header, is
 * decorative (`aria-hidden`) and carries none of the idle motion hooks' animation: the
 * `gna-ask-emblem-mark` scope has no animation rule, so nothing here can ever read as progress.
 */
export function AskEmblemMark(): JSX.Element {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <span aria-hidden="true" data-ask="emblem-mark" className="gna-ask-emblem-mark inline-flex h-6 w-6 shrink-0">
      <AskEmblemSvg id={id} size={24} still />
    </span>
  );
}

/**
 * ASK DESIGN AUTHORITY R3 — THE WORDMARK (Design header, every frame): Space Grotesk 500 18 px,
 * -0.01em, ink, with the trailing "AI" in `--wordmark-ai` (teal light / signal-blue navy). The
 * TEXT is the one canonical product name (CTO brand ruling); only the Design's two-tone
 * treatment is applied to it. A name without a trailing "AI" renders in one colour.
 */
export function AskWordmark({ name }: { readonly name: string }): JSX.Element {
  const match = /^(.*?)(AI)$/.exec(name);
  return (
    <span data-ask="wordmark" className="gna-ask-wordmark">
      {match === null ? (
        name
      ) : (
        <>
          {match[1]}
          <span className="gna-ask-wordmark-ai">{match[2]}</span>
        </>
      )}
    </span>
  );
}

/**
 * ASK R3 PROGRESS R1 — THE WORKING EMBLEM (Claude Design R3 PROGRESS_MOTION_SPEC.md, addendum §5:
 * "The ORIGINAL radar logo performs a gentle sweep/pulse beside the currently active line").
 *
 * The same original geometry as the welcome emblem and the header mark (no redraw), 24 px, under
 * the separate working-motion scope `gna-ask-working-emblem` (2.4 s sweep, 7.2 s arc, 1.6 s core).
 * It exists only while a request is really in flight: the caller mounts it for the running row and
 * unmounts it the moment that row completes, so its motion can never outlive the work it marks.
 * Paused while the document is hidden; static under reduced motion (CSS).
 */
export function AskWorkingEmblem(): JSX.Element {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
    const sync = (): void => setHidden(document.visibilityState === 'hidden');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  return (
    <span
      aria-hidden="true"
      data-ask="working-emblem"
      data-ask-paused={hidden ? 'true' : 'false'}
      className="gna-ask-working-emblem inline-flex h-6 w-6 shrink-0"
    >
      <AskEmblemSvg id={id} size={24} />
    </span>
  );
}

/**
 * ASK R3 PROGRESS R1 — the collapsed "Search activity" mark (ProgressPanel.dc.html: the static
 * emblem, 18 px, opacity .8). Still: a finished search never animates again.
 */
export function AskStaticEmblem({ size = 18 }: { readonly size?: number }): JSX.Element {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <span aria-hidden="true" data-ask="static-emblem" className="inline-flex shrink-0" style={{ opacity: 0.8 }}>
      <AskEmblemSvg id={id} size={size} still />
    </span>
  );
}
