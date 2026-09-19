import type { JSX } from 'react';

/**
 * THE LOADING STATE, AND WHY IT DOES NOT SHIMMER.
 *
 * Part VII defines no loading state — a case-insensitive sweep of the whole accepted
 * package for `loading`, `skeleton` and `spinner` returns nothing — so this is an
 * unauthored surface rather than a forbidden one, and it is built to the smallest thing
 * that is true.
 *
 * It exists because `/market` is an async Server Component: it awaits the internal read
 * before it can render. Today that read resolves immediately and this frame is never
 * seen. The moment the read does real I/O against the stored observations, this is what a
 * reader waits on, and a route that only grows a loading state when it starts being slow
 * grows it under pressure.
 *
 * NO SHIMMER, NO PULSE, NO SPINNER. R10 rule 2 forbids any affordance that implies
 * real-time behaviour — *"no auto-tick, no flash-on-update, no ticker tape, no live-pulse
 * affordance, anywhere in Phase 1"* — and an animated skeleton on a market surface reads
 * as a feed arriving. This is a static frame that says what it is doing, once.
 *
 * It carries NO figure, no placeholder number and no grey bar shaped like a value. A
 * skeleton that mimes a populated card teaches a reader to expect one, and on a surface
 * whose honest answer is usually "nothing is held" that is a small lie told early.
 */
export default function MarketLoading(): JSX.Element {
  return (
    <div
      data-mkt="loading"
      role="status"
      aria-live="polite"
      style={{
        minHeight: '40vh',
        display: 'flex',
        alignItems: 'flex-start',
        padding: '24px 20px',
        color: '#8b94a1',
        fontFamily: "var(--ar-family, 'IBM Plex Mono', monospace)",
        fontSize: '12px',
        letterSpacing: '0.09em',
        textTransform: 'uppercase',
      }}
    >
      Loading market observations
    </div>
  );
}
