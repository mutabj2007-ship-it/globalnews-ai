'use client';

import { useEffect, useId, useRef, useState, type JSX } from 'react';

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
  const [short, setShort] = useState(false);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');

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

  /* Typing: hidden while the VISIBLE height is under 480 (a phone with its keyboard open). */
  useEffect(() => {
    if (state !== 'typing') {
      setShort(false);
      return;
    }
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    const viewport = window.visualViewport ?? undefined;
    const measure = () => {
      const height = viewport?.height ?? window.innerHeight;
      setShort(typeof height === 'number' && height < 480);
    };
    measure();
    viewport?.addEventListener('resize', measure);
    window.addEventListener('resize', measure);
    return () => {
      viewport?.removeEventListener('resize', measure);
      window.removeEventListener('resize', measure);
    };
  }, [state]);

  if (gone) return null;
  return (
    <div
      ref={node}
      aria-hidden="true"
      data-ask="emblem"
      data-ask-emblem-state={state}
      data-ask-emblem-placement={placement}
      data-ask-emblem-paused={paused ? 'true' : undefined}
      data-ask-emblem-short={short ? 'true' : undefined}
      className="gna-ask-emblem"
    >
      <svg viewBox="0 0 40 40" width="40" height="40" overflow="visible" focusable="false">
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
        <g className="gna-arc gna-ask-emblem-arc">
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
        <g className="gna-sweep gna-ask-emblem-sweep">
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
          cx="20"
          cy="20"
          r="4.6"
          fill="#22d3ee"
          filter={`url(#${id}-blur)`}
        />
      </svg>
    </div>
  );
}
