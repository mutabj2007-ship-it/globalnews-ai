import type { ReactNode } from 'react';

interface PageCanvasProps {
  children: ReactNode;
}

/**
 * M66.1 — THE CLAUDE DESIGN PAGE CANVAS.
 *
 * The shared presentation foundation every later home-surface milestone
 * (GN-CD-020→027, 040→076, 100→115, 130→156, 180→185, 200→204, 220→229)
 * renders inside. Authority: GN-CD-300 §F.1/§F.2/§G, GN-CD-301 §E/§I.1 and
 * GN-CD-302 §E.1, released 2026-08-18.
 *
 * WHAT IT ESTABLISHES
 *   - the `#04060c` page base                          GN-CD-300 §F.1
 *   - the released two-layer composite radial field     GN-CD-300 §F.2
 *   - the released 56px technical grid at
 *     `rgba(56,189,248,.045)`                           GN-CD-300 §G
 *   - the 1500px desktop presentation boundary          GN-CD-302 §E.1
 *   - desktop padding `20px 26px 60px`                  GN-CD-302 §E.1
 *   - mobile padding `12px 14px 22px`                   GN-CD-302 §E.1
 *   - the 18px desktop section rhythm                   GN-CD-302 §E.1/§W
 *   - the Claude Design body face and text colour,
 *     `IBM Plex Sans` / `#e8f1ff`                       GN-CD-301 §E/§I.1
 *   - the `cd-canvas` hook that scopes the GN-CD-306
 *     focus treatment to Claude Design surfaces         globals.css
 *
 * IT IS PRESENTATION INFRASTRUCTURE ONLY.
 * No data fetch. No API client. No application state. No timers. No routing.
 * No authentication. No fabricated intelligence of any kind. It renders its
 * children inside a styled boundary and does nothing else — it does not even
 * need to be a Client Component. Every decorative layer is `aria-hidden`,
 * `pointer-events-none`, takes no props and carries no meaning
 * (GN-CD-300 §P: "DATA SOURCE: NONE — PRESENTATION ONLY"; GN-CD-306 §O:
 * decorative layers must be aria-hidden and non-focusable).
 *
 * THE ONE AUTHORIZED DIVERGENCE — `min-width: 1360px` IS NOT REPRODUCED.
 * GN-CD-302 §E.1 authors `min-width:1360px` on the desktop wrapper, and §M
 * records that below that width the prototype "does not reflow; it scrolls
 * horizontally" — which the design itself flags `[UNRESOLVED]` as a product
 * behaviour (UNRESOLVED-002). Reproducing it would fail WCAG 2.1 SC 1.4.10
 * Reflow and break every viewport under 1360px. CTO decision D4 authorises the
 * divergence: the desktop composition stays faithful at desktop widths, and
 * below them the canvas reflows. `overflow-x-hidden` guarantees the foundation
 * itself can never introduce a horizontal scrollbar at 1280, 1024, 768, 390 or
 * 320px. `claudeDesignFoundation.spec.ts` locks both halves — the 1500px
 * maximum, and the absence of any 1360px minimum — so the divergence cannot be
 * silently "corrected" back into a defect.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * It does not touch any section's own width, padding or internal layout. Per
 * CTO decision D5 it establishes the OUTER boundary only; the homepage's five
 * competing content widths (1800/1600/1480/1280/`max-w-6xl`) and the sections'
 * existing vertical padding are corrected element-by-element against their own
 * GN-CD specifications. Until then the 18px rhythm below composes with the
 * padding each section still carries, so the gap between two sections reads as
 * 18px plus their existing insets. That is expected, and it resolves section by
 * section rather than through a homepage-wide rewrite this milestone forbids.
 */
export function PageCanvas({ children }: PageCanvasProps): JSX.Element {
  return (
    <div className="cd-canvas relative overflow-x-hidden bg-cd-void font-cd-body text-cd-ink-primary">
      {/*
        GN-CD-300 §F.2 — the composite page background. The two radial layers
        are the background IMAGE; the `#04060c` base beneath them is the
        background COLOUR on the root above, which composites identically to
        the specification's single shorthand declaration. GN-CD-300 §V requires
        exact gradient stop positions, so `70%` is preserved on both layers.
      */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-cd-page" />

      {/*
        GN-CD-300 §G — the page technical grid: `rgba(56,189,248,.045)` at
        `56px 56px`. Decorative, and decorative only: it carries no reading,
        no count and no state.
      */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-cd-grid-page bg-cd-grid-56" />

      {/* GN-CD-302 §E.1 — the bounded content wrapper. */}
      <div className="relative mx-auto w-full max-w-cd-page px-cd-14 pb-cd-22 pt-cd-12 lg:px-cd-26 lg:pb-cd-60 lg:pt-cd-20">
        <div className="flex flex-col lg:gap-cd-18">{children}</div>
      </div>
    </div>
  );
}
