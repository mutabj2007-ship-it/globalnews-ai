import type { JSX } from 'react';
import {
  ENGINE_DESKTOP,
  CONNECTOR_REST_DESKTOP,
  CONNECTOR_WIDTH_REST,
  FILLER_FILL,
  FILLER_OPACITY,
  FILLER_RADIUS,
  ANCHOR_OPACITY,
  fillerNodes,
  ringEngine,
  svgNum,
} from '@/components/home/intelligenceEngineGeometry';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * C5 · THE INTELLIGENCE-ENERGY FIELD
 * ════════════════════════════════════════════════════════════════════════════
 *
 * BETA HOME CLOSURE R2 increment C5. The contract asks for two things at once:
 * KEEP the nine visible module cards, and restore the glowing ring identity
 * that the retired `IntelligenceEngineSection` carried.
 *
 * ── WHY THIS IS A BACKDROP AND NOT THE RETIRED RING COMPONENT ────────────
 *
 * `IntelligenceEngineRing` was read first, as §13 requires. It cannot be
 * restored as-is here, and the reason is not aesthetic: it renders an
 * `IntelligenceModulePanel` for every module, so mounting it beside the
 * nine-card section would put NINE MORE module representations on the page —
 * eighteen in total, two per module, each a separate tab stop. "Keep the nine
 * cards" and "mount the ring that draws its own nine cards" cannot both be
 * satisfied by the same component.
 *
 * What made that section feel like an engine was never the panels, though. It
 * was the hub, the connector rays reaching out to each module, the travelling
 * pulses and the ring of filler nodes. That is what is restored here, as a
 * decorative field behind the real cards.
 *
 * ── IT USES THE RELEASED GEOMETRY, NOT A REDRAWING OF IT ─────────────────
 *
 * Every coordinate comes from `intelligenceEngineGeometry.ts` — the same
 * `ENGINE_DESKTOP` config, the same `ringEngine()` connector solver, the same
 * `fillerNodes()` ring and the same released connector colour and widths. So
 * the hub sits where GN-CD-152 puts it and each ray leaves at the module's true
 * angle. Nothing is eyeballed, and `engineGeometry.spec.ts` keeps guarding the
 * numbers this file consumes.
 *
 * The geometry module is pure arithmetic with no hooks, so this stays a SERVER
 * COMPONENT with zero client JavaScript — which matters, because the section it
 * sits behind is server-rendered and the page's quota guarantee rests on Home
 * shipping no code that can issue a request.
 *
 * ── DECORATIVE, AND HONEST ABOUT IT ──────────────────────────────────────
 *
 * `aria-hidden`, `pointer-events-none`, and it never draws a module's name,
 * state, count or route — the cards in front own all of that. A ray reaching a
 * module's position asserts nothing about that module; it is the same ambient
 * "the engine is connected" reading the retired section had.
 *
 * Every animation is pure CSS on `opacity` and `transform`, and all of it stops
 * under `prefers-reduced-motion` while the field itself stays visible.
 */

const CONFIG = ENGINE_DESKTOP;
const LINKS = ringEngine(CONFIG);
const NODES = fillerNodes(CONFIG);

export function EngineEnergyField(): JSX.Element {
  return (
    /*
      IT BLEEDS AROUND THE SECTION, because it cannot show through it. The
      modules section carries an opaque `bg-cd-engine` panel, and that file is
      the Gate A artifact and must not be touched — so a field sitting exactly
      behind it would be almost entirely hidden, which is what the first C5
      capture showed. Extending past the panel on all four sides turns it into a
      halo the engine sits inside. `PageCanvas` already clips overflow-x, so the
      horizontal bleed cannot add a scrollbar.
    */
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -inset-x-6 -inset-y-12 -z-10 overflow-hidden rounded-[3rem]"
    >
      {/* The bloom behind the hub — depth, so the rays read as emerging from it. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_50%,rgba(34,211,238,0.20),transparent_72%)]" />

      <svg
        viewBox={`0 0 ${CONFIG.canvasWidth} ${CONFIG.canvasHeight}`}
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full opacity-90"
        xmlns="http://www.w3.org/2000/svg"
      >
        <style>
          {`
            @keyframes gna-engine-breathe { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.85; } }
            @keyframes gna-engine-halo { 0%, 100% { opacity: 0.25; transform: scale(0.97); } 50% { opacity: 0.6; transform: scale(1.03); } }
            .gna-engine-ray { animation: gna-engine-breathe 6s ease-in-out infinite; }
            .gna-engine-halo { animation: gna-engine-halo 7s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
            @media (prefers-reduced-motion: reduce) {
              .gna-engine-ray, .gna-engine-halo {
                animation: none !important; opacity: 0.5 !important; transform: none !important;
              }
            }
          `}
        </style>

        {/* The connector rays, at each module's true angle from the hub. */}
        <g fill="none" stroke={CONNECTOR_REST_DESKTOP} strokeWidth={CONNECTOR_WIDTH_REST}>
          {LINKS.map((link) => (
            <path
              key={link.id}
              d={link.d}
              className="gna-engine-ray"
              /* The released per-position pulse offset, reused so the rays
                 breathe out of phase exactly as the engine's pulses did. */
              style={{ animationDelay: `${svgNum(link.begin)}s` }}
            />
          ))}
        </g>

        {/* The ring of filler nodes, at the released radius and opacity. */}
        <g fill={FILLER_FILL} opacity={FILLER_OPACITY}>
          {NODES.map((node) => (
            <circle key={`${node.x}-${node.y}`} cx={node.x} cy={node.y} r={FILLER_RADIUS} />
          ))}
        </g>

        {/* The hub: a soft halo, then the anchor circle at the released radius. */}
        <circle
          cx={CONFIG.cx}
          cy={CONFIG.cy}
          r={CONFIG.r * 1.55}
          fill="rgba(34,211,238,0.07)"
          className="gna-engine-halo"
        />
        <circle
          cx={CONFIG.cx}
          cy={CONFIG.cy}
          r={CONFIG.r}
          fill="none"
          stroke={CONNECTOR_REST_DESKTOP}
          strokeWidth={CONNECTOR_WIDTH_REST}
          opacity={ANCHOR_OPACITY}
        />
      </svg>
    </div>
  );
}
