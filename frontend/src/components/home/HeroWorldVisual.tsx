import { getCountryFeatureCollection, type CountryFeature } from '@/lib/map/countryGeometry';
import { geometryToPathD, type ProjectionViewport } from '@/lib/geo/equirectangularProjection';
import { HUD_PANEL_CLIP } from '@/components/home/hudPanelGeometry';

/**
 * CTO Visual Acceptance correction — "a plain cyan political map" was
 * explicitly rejected; this rewrite substantially enriches visual
 * density while keeping the SAME real-geography technical foundation
 * (getCountryFeatureCollection + equirectangularProjection, both
 * unchanged) and the SAME zero-client-JS Server Component approach.
 *
 * Added this round: layered atmospheric glow, category-colored
 * ambient nodes (cyan/blue/green/amber/red/violet/yellow — not one
 * flat cyan), soft halos per node, ONE larger "selected-style" node
 * with concentric targeting rings (purely decorative — never implies
 * a real selected country), a few restrained curved arc paths
 * connecting node pairs, and a subtle radar-sweep wedge in addition
 * to the existing linear scan. Every node position remains fixed and
 * arbitrary — never derived from real article/country data (that
 * remains the Global Situation Map's job).
 */
const VIEWPORT: ProjectionViewport = { width: 560, height: 340 };
const KEEP_EVERY_NTH_POINT = 4;

interface AmbientNode {
  x: number;
  y: number;
  color: string;
  size: number;
}

/** Fixed, arbitrary decorative node positions and colors — never derived from real article/country data. */
const AMBIENT_NODES: AmbientNode[] = [
  { x: 130, y: 95, color: '#22d3ee', size: 3.2 },
  { x: 270, y: 68, color: '#34d399', size: 2.6 },
  { x: 360, y: 135, color: '#fbbf24', size: 2.8 },
  { x: 190, y: 190, color: '#a78bfa', size: 2.6 },
  { x: 420, y: 200, color: '#22d3ee', size: 2.8 },
  { x: 95, y: 235, color: '#f472b6', size: 2.4 },
  { x: 310, y: 230, color: '#60a5fa', size: 2.6 },
  { x: 450, y: 90, color: '#fb923c', size: 2.4 },
];

/** The single, visually larger "focus" node with concentric targeting rings — decorative emphasis only, not a real selection. */
const FOCUS_NODE = { x: 250, y: 150, color: '#22d3ee' };

/** A few restrained curved connector arcs between node pairs — ambient "network" texture. */
const ARC_PAIRS: Array<[AmbientNode, AmbientNode]> = [
  [AMBIENT_NODES[0], AMBIENT_NODES[1]],
  [AMBIENT_NODES[2], AMBIENT_NODES[4]],
  [AMBIENT_NODES[3], AMBIENT_NODES[6]],
];

function arcPath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2 - 30;
  return `M ${a.x} ${a.y} Q ${midX} ${midY} ${b.x} ${b.y}`;
}

export function HeroWorldVisual(): JSX.Element {
  const collection = getCountryFeatureCollection();

  return (
    <div
      aria-hidden="true"
      className={`relative h-full w-full overflow-hidden rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-[#040914] via-[#050c1a] to-[#020509] shadow-[0_0_90px_-20px_rgba(34,211,238,0.35)] ${HUD_PANEL_CLIP}`}
    >
      {/* Layered atmospheric glow — depth behind the geometry. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_45%_40%,rgba(34,211,238,0.38),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(2,7,13,0.5)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_75%,rgba(52,211,153,0.08),transparent_55%)]" />

      <svg viewBox={`0 0 ${VIEWPORT.width} ${VIEWPORT.height}`} className="relative h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <style>
          {`
            @keyframes gna-hero-scan { 0% { transform: translateY(-10%); opacity: 0; } 10% { opacity: 0.4; } 90% { opacity: 0.4; } 100% { transform: translateY(110%); opacity: 0; } }
            @keyframes gna-hero-pulse { 0%, 100% { opacity: 0.35; r: var(--r-min); } 50% { opacity: 1; r: var(--r-max); } }
            @keyframes gna-hero-ring { 0% { opacity: 0.6; transform: scale(0.9); } 50% { opacity: 0.1; transform: scale(1.08); } 100% { opacity: 0.6; transform: scale(0.9); } }
            @keyframes gna-hero-radar { 0% { transform: rotate(0deg); opacity: 0.25; } 100% { transform: rotate(360deg); opacity: 0.25; } }
            @keyframes gna-hero-arc { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.55; } }
            .gna-hero-scan-line { animation: gna-hero-scan 10s linear infinite; }
            .gna-hero-node { animation: gna-hero-pulse 3s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
            .gna-hero-focus-ring { animation: gna-hero-ring 5s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
            .gna-hero-radar-sweep { animation: gna-hero-radar 14s linear infinite; transform-box: fill-box; transform-origin: center; }
            .gna-hero-arc { animation: gna-hero-arc 4.5s ease-in-out infinite; }
            @media (prefers-reduced-motion: reduce) {
              .gna-hero-scan-line, .gna-hero-node, .gna-hero-focus-ring, .gna-hero-radar-sweep, .gna-hero-arc {
                animation: none !important; opacity: 0.4 !important; transform: none !important;
              }
            }
          `}
        </style>

        {/* Lat/long grid */}
        <g stroke="#22d3ee" strokeWidth="0.4" opacity="0.25">
          {[0.2, 0.4, 0.6, 0.8].map((f) => (
            <line key={`lon-${f}`} x1={VIEWPORT.width * f} y1={0} x2={VIEWPORT.width * f} y2={VIEWPORT.height} />
          ))}
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={`lat-${f}`} x1={0} y1={VIEWPORT.height * f} x2={VIEWPORT.width} y2={VIEWPORT.height * f} />
          ))}
        </g>

        {/* Real world geometry — luminous coastline outlines */}
        <g stroke="#22d3ee" strokeWidth="1.1" fill="#0e7490" fillOpacity="0.18" opacity="1">
          {collection.features.map((feature: CountryFeature) => (
            <path
              key={feature.properties.numericId}
              d={geometryToPathD(
                feature.geometry as { type: 'Polygon' | 'MultiPolygon'; coordinates: any },
                VIEWPORT,
                KEEP_EVERY_NTH_POINT,
              )}
            />
          ))}
        </g>

        {/* Ambient connector arcs */}
        <g fill="none" strokeWidth="0.6">
          {ARC_PAIRS.map(([a, b], index) => (
            <path key={index} d={arcPath(a, b)} stroke={a.color} className="gna-hero-arc" style={{ animationDelay: `${index * 0.8}s` }} />
          ))}
        </g>

        {/* Radar sweep wedge, centered on the focus node */}
        <g opacity="0.5">
          <path
            className="gna-hero-radar-sweep"
            d={`M ${FOCUS_NODE.x} ${FOCUS_NODE.y} L ${FOCUS_NODE.x + 90} ${FOCUS_NODE.y - 20} A 90 90 0 0 0 ${FOCUS_NODE.x + 90} ${FOCUS_NODE.y + 20} Z`}
            fill="url(#gna-radar-gradient)"
          />
        </g>

        {/* Orbit ring */}
        <ellipse
          cx={VIEWPORT.width / 2}
          cy={VIEWPORT.height / 2}
          rx={VIEWPORT.width * 0.44}
          ry={VIEWPORT.height * 0.42}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="1"
          opacity="0.45"
        />

        {/* Faint dot-matrix texture — low-opacity circuit/grid character beyond the coarse lat/long lines. */}
        <g fill="#22d3ee" opacity="0.35">
          {Array.from({ length: 12 }).map((_, row) =>
            Array.from({ length: 20 }).map((_, col) => (
              <circle key={`${row}-${col}`} cx={col * 28 + 10} cy={row * 28 + 10} r="0.5" />
            )),
          )}
        </g>

        {/* Micro-particles — a second, sparser, varied-size layer distinct from the dense dot-matrix grid, adding scattered depth. Fixed deterministic positions, not random-per-render. */}
        <g fill="#67e8f9">
          {[
            { x: 60, y: 40, r: 0.7, o: 0.5 },
            { x: 210, y: 30, r: 1, o: 0.4 },
            { x: 340, y: 55, r: 0.6, o: 0.6 },
            { x: 480, y: 45, r: 0.9, o: 0.35 },
            { x: 150, y: 150, r: 0.8, o: 0.5 },
            { x: 400, y: 165, r: 0.6, o: 0.45 },
            { x: 40, y: 200, r: 1, o: 0.4 },
            { x: 260, y: 260, r: 0.7, o: 0.5 },
            { x: 500, y: 250, r: 0.8, o: 0.4 },
            { x: 330, y: 290, r: 0.6, o: 0.55 },
          ].map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={p.r} opacity={p.o} />
          ))}
        </g>

        {/* Radial ticks — small technical marks around the ring, matching the reference's technical framing language. */}        <g stroke="#38bdf8" strokeWidth="0.6" opacity="0.4">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const cx = VIEWPORT.width / 2;
            const cy = VIEWPORT.height / 2;
            const rx = VIEWPORT.width * 0.44;
            const ry = VIEWPORT.height * 0.42;
            const x1 = cx + rx * Math.cos(rad);
            const y1 = cy + ry * Math.sin(rad);
            const x2 = cx + (rx + 6) * Math.cos(rad);
            const y2 = cy + (ry + 6) * Math.sin(rad);
            return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
        </g>

        {/* Category-colored ambient nodes with soft halos */}
        {AMBIENT_NODES.map((node, index) => (
          <g key={index}>
            <circle cx={node.x} cy={node.y} r={node.size * 4} fill={node.color} opacity="0.25" />
            <circle
              cx={node.x}
              cy={node.y}
              r={node.size}
              fill={node.color}
              className="gna-hero-node"
              style={{ animationDelay: `${index * 0.4}s`, ['--r-min' as any]: `${node.size * 0.7}`, ['--r-max' as any]: `${node.size * 1.4}` }}
            />
          </g>
        ))}

        {/* Focus node — larger, with concentric targeting rings. Decorative emphasis only. */}
        <g>
          <circle cx={FOCUS_NODE.x} cy={FOCUS_NODE.y} r="14" fill="none" stroke={FOCUS_NODE.color} strokeWidth="0.8" className="gna-hero-focus-ring" opacity="0.5" />
          <circle cx={FOCUS_NODE.x} cy={FOCUS_NODE.y} r="9" fill="none" stroke={FOCUS_NODE.color} strokeWidth="0.6" opacity="0.4" />
          <circle cx={FOCUS_NODE.x} cy={FOCUS_NODE.y} r={3.2} fill={FOCUS_NODE.color} />
        </g>

        <rect className="gna-hero-scan-line" x="0" y="0" width={VIEWPORT.width} height="2" fill="url(#gna-scan-gradient)" />
        <defs>
          <linearGradient id="gna-scan-gradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="gna-radar-gradient">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020509]/60 via-transparent to-[#020509]/20" />

      {/* HUD corner brackets — Section 4 framing language. */}
      <span aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 border-l-2 border-t-2 border-cyan-400/50" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 border-b-2 border-l-2 border-cyan-400/50" />
    </div>
  );
}
