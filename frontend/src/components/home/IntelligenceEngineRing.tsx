'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import type { LanguageCode } from '@globalnews-ai/shared';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { pluralWithForms } from '@/lib/i18n/pluralize';
import { INTELLIGENCE_MODULES, type IntelligenceModuleConfig } from '@/lib/intelligenceModules';
import { IntelligenceModulePanel } from '@/components/home/IntelligenceModulePanel';
import {
  ACK_KEY_TIMES,
  ANCHOR_OPACITY,
  CARD_ACK_PHASE,
  CARD_NODE_OPACITY,
  CONNECTOR_REST_DESKTOP,
  CONNECTOR_REST_MOBILE,
  CONNECTOR_WIDTH_HOVER,
  CONNECTOR_WIDTH_REST,
  ENGINE_DESKTOP,
  ENGINE_MOBILE,
  FILLER_FILL,
  FILLER_OPACITY,
  FILLER_RADIUS,
  HOVER_NODE_RATIO,
  HUB_ACK_PHASE,
  MODULE_IDENTITY,
  PULSE_FADE_TIMES,
  PULSE_FADE_VALUES,
  PULSE_KEY_POINTS,
  PULSE_KEY_TIMES,
  RING_ORDER,
  cardAckValues,
  cardNodeRadius,
  fillerNodes,
  hubAckValues,
  ringEngine,
  svgNum,
  type EngineConfig,
  type EngineLink,
  type RingItem,
} from '@/components/home/intelligenceEngineGeometry';

interface IntelligenceEngineRingProps {
  language?: LanguageCode;
}

/**
 * M66.5 — GN-CD-145 → GN-CD-147, GN-CD-152/154/155: the engine itself.
 *
 * EVERY COORDINATE IS GENERATED. `ringEngine()` runs on the released
 * configuration literals once per render; not one connector path, node
 * position or pulse offset is transcribed. GN-CD-145: "Why it must stay
 * generated: every connector's angle is the module's own angle, so
 * extending any connector backwards passes through the hub centre.
 * Hardcoding paths guarantees drift the first time a card moves."
 *
 * EVERY FACT STILL COMES FROM ONE PLACE. The nine cards, their order,
 * their states and their destinations all derive from the canonical
 * `INTELLIGENCE_MODULES` configuration, which this milestone does not
 * touch. The hub's capability line is computed from that same array
 * rather than maintained as an independent claim — CTO decision D-11
 * keeps the truthful derived `9 modules · 4 active` and rejects the
 * design's `9 MODULES · LIVE` literal, because no engine-health signal
 * exists to back the word LIVE.
 *
 * EVERYTHING DECORATIVE IS DECLARED DECORATIVE. GN-CD §N.1: the engine
 * SVG is entirely decorative — every fact it carries is also in the card
 * list. Connectors, all 42 nodes, all 9 pulses, the HUD and the hub
 * rings are `aria-hidden`, take no props, consume no data and issue no
 * request. GN-CD-147 is explicit that the pulses "do not represent
 * measured traffic and must never be presented as live telemetry". No
 * Signals API is called, created or implied.
 *
 * THE NINE CARDS EXIST EXACTLY ONCE IN THE DOM. All three compositions
 * are produced from ONE card list by switching layout, never by
 * rendering a second hidden copy. That matters for GN-CD §V.5 ("Keyboard
 * Tab reaches all nine cards"): a per-breakpoint duplicate would put 18
 * or 27 cards in the tab order. The retired presentation did duplicate
 * them; this one does not.
 *
 * DOM ORDER IS THE RELEASED GEOMETRY ORDER (`RING_ORDER`), per CTO
 * decision D-9 A resolving UNRESOLVED-018 — World, AI Research, Country,
 * Evidence, Market, Economy, Timeline, Conflict, Forecast. Reading order
 * therefore matches visual order rather than registry order.
 *
 * REDUCED MOTION — GN-CD-155 and GN-CD-305 §L.2. CSS alone cannot stop
 * SMIL, which is why M66.1 recorded the logic guard as owed by "the
 * engine and trending milestones". It is paid here: under
 * `prefers-reduced-motion: reduce` every `animateMotion` and `animate`
 * is emitted with `begin="indefinite"` so it is never scheduled, and
 * each pulse carries `.cd-motion-pulse`, this repository's released name
 * for the design's `.gn-pulse`, which `globals.css` removes with
 * `display:none`. Connectors, nodes, cards and the hub are unchanged, so
 * the static engine still reads as a radial network with zero layout
 * shift. The media query is SUBSCRIBED to rather than memoised, per
 * GN-CD-305 §O — the same pattern M66.4 ships in GlobalDevelopments.
 *
 * NO DOM MEASUREMENT: no getBoundingClientRect, no ResizeObserver, no
 * requestAnimationFrame. One media-query listener and one hover state.
 */

/** GN-CD-156 — desktop hover illuminates the whole relationship, not just the card. */
type Hovered = string | null;

/** One card: its canonical configuration plus its released slot on each viewport. */
interface RingCard {
  module: IntelligenceModuleConfig;
  desktop: RingItem;
  mobile: RingItem;
}

function identityOf(id: string): string {
  return MODULE_IDENTITY[id]?.hex ?? FILLER_FILL;
}

/**
 * GN-CD-147 — the acknowledgement envelope.
 *
 * DOCUMENTED ONE-ATTRIBUTE DEVIATION, deliberately not silent. The
 * released `keyTimes` is `0;0.08;0.3`. SVG requires the last `keyTimes`
 * entry to be `1` when `calcMode` is linear (the default here), so the
 * released three-stop form is invalid and browsers drop the animation
 * outright — which would silently fail GN-CD §V behavioural check 3
 * ("Hub anchor node visibly swells on pulse arrival"). The released
 * stops and their released times are preserved EXACTLY and a fourth
 * stop is appended that holds the base radius from 0.3 to 1 — which is
 * precisely what the released envelope means for the rest of the cycle.
 * Rendered result is identical to the released intent; the attribute is
 * merely completed so it is valid. Recorded as
 * M66.5-DESIGN-FEEDBACK-005 and reversible in one line.
 */
function ackValues(released: string): string {
  const stops = released.split(';');
  return `${released};${stops[stops.length - 1]}`;
}
const ACK_KEY_TIMES_VALID = `${ACK_KEY_TIMES};1`;

interface NetworkProps {
  config: EngineConfig;
  links: EngineLink[];
  /** Desktop consumes hover state; mobile has none (GN-CD-145). */
  hovered: Hovered;
  interactive: boolean;
  /** GN-CD-146 — desktop applies computed node opacity; the mobile template omits it. */
  applyNodeOpacity: boolean;
  restStroke: string;
  reduced: boolean;
  className: string;
}

/**
 * The engine SVG for one viewport. Emitted in the released Z-order —
 * Z04 connectors, Z05 nodes, Z06 pulses — with no `z-index` anywhere,
 * because GN-CD-151 records that this family declares none and stacking
 * is pure DOM order.
 */
function EngineNetwork({
  config,
  links,
  hovered,
  interactive,
  applyNodeOpacity,
  restStroke,
  reduced,
  className,
}: NetworkProps): JSX.Element {
  const anchorR = config.nodeR;
  const cardR = cardNodeRadius(config);
  const hubAck = ackValues(hubAckValues(config));
  const cardAck = ackValues(cardAckValues(config));
  const begin = (seconds: number): string => (reduced ? 'indefinite' : `${seconds.toFixed(2)}s`);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${config.canvasWidth} ${config.canvasHeight}`}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={{ overflow: 'visible' }}
    >
      {/* Z04 — GN-CD-145, connector paths. */}
      {links.map((link) => {
        const lit = interactive && hovered === link.id;
        return (
          <path
            key={`c-${link.id}`}
            d={link.d}
            fill="none"
            stroke={lit ? identityOf(link.id) : restStroke}
            strokeWidth={lit ? CONNECTOR_WIDTH_HOVER : CONNECTOR_WIDTH_REST}
          />
        );
      })}

      {/*
        Z05a — GN-CD-146 §16c, the 24 filler circumference nodes at
        exactly 15°. Indices 0, 6, 12 and 18 coincide with the four
        cardinal module anchors; GN-CD-146 records that as intentional,
        so they are NOT de-duplicated. Never animated.
      */}
      {fillerNodes(config).map((node, index) => (
        <circle
          key={`f-${index}`}
          cx={node.x}
          cy={node.y}
          r={FILLER_RADIUS}
          fill={FILLER_FILL}
          opacity={applyNodeOpacity ? FILLER_OPACITY : undefined}
        />
      ))}

      {/* Z05b — GN-CD-146 §16a, the nine hub anchor nodes, with their arrival swell. */}
      {links.map((link) => {
        const lit = interactive && hovered === link.id;
        return (
          <circle
            key={`a-${link.id}`}
            cx={link.anchor.x}
            cy={link.anchor.y}
            r={lit ? Number((anchorR * HOVER_NODE_RATIO).toFixed(2)) : anchorR}
            fill={identityOf(link.id)}
            opacity={applyNodeOpacity ? (lit ? 1 : ANCHOR_OPACITY) : undefined}
          >
            <animate
              attributeName="r"
              dur={`${link.dur}s`}
              begin={begin(link.begin + link.dur * HUB_ACK_PHASE)}
              repeatCount="indefinite"
              values={hubAck}
              keyTimes={ACK_KEY_TIMES_VALID}
            />
          </circle>
        );
      })}

      {/* Z05c — GN-CD-146 §16b, the nine card-edge nodes, with their return swell. */}
      {links.map((link) => (
        <circle
          key={`e-${link.id}`}
          cx={link.edge.x}
          cy={link.edge.y}
          r={cardR}
          fill={identityOf(link.id)}
          opacity={applyNodeOpacity ? CARD_NODE_OPACITY : undefined}
        >
          <animate
            attributeName="r"
            dur={`${link.dur}s`}
            begin={begin(link.begin + link.dur * CARD_ACK_PHASE)}
            repeatCount="indefinite"
            values={cardAck}
            keyTimes={ACK_KEY_TIMES_VALID}
          />
        </circle>
      ))}

      {/*
        Z06 — GN-CD-147, the travelling bidirectional pulses. The motion
        path is the connector REVERSED: out to the hub by 0.3, dwelling
        to 0.4, back to the card by 0.7, resting invisible to 1. Three
        durations across nine staggered starts is what stops the network
        reading as a loop.
      */}
      {links.map((link) => (
        <circle
          key={`p-${link.id}`}
          r={svgNum(config.pulseR)}
          fill={identityOf(link.id)}
          className="cd-motion-pulse"
        >
          <animateMotion
            dur={`${link.dur}s`}
            begin={begin(link.begin)}
            repeatCount="indefinite"
            path={link.motion}
            calcMode="linear"
            keyPoints={PULSE_KEY_POINTS}
            keyTimes={PULSE_KEY_TIMES}
          />
          <animate
            attributeName="opacity"
            dur={`${link.dur}s`}
            begin={begin(link.begin)}
            repeatCount="indefinite"
            values={PULSE_FADE_VALUES}
            keyTimes={PULSE_FADE_TIMES}
          />
        </circle>
      ))}
    </svg>
  );
}

export function IntelligenceEngineRing({ language = 'en' }: IntelligenceEngineRingProps): JSX.Element {
  const [hovered, setHovered] = useState<Hovered>(null);
  const [reduced, setReduced] = useState(false);
  const t = getDictionary(language).intelligenceModules;

  /**
   * GN-CD-305 §O — subscribe to the media query rather than memoise it,
   * so a preference changed mid-session takes effect. Same pattern M66.4
   * already ships in GlobalDevelopments.tsx.
   */
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const handleChange = (event: MediaQueryListEvent): void => setReduced(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  // Derived from the canonical configuration — never a hardcoded
  // capability claim. If a module's state changes in
  // intelligenceModules.ts, this line changes with it.
  const totalCount = INTELLIGENCE_MODULES.length;
  const activeCount = INTELLIGENCE_MODULES.filter((moduleItem) => moduleItem.state === 'active').length;
  const capabilityCountLabel = `${pluralWithForms(totalCount, language, t.moduleForms)} · ${pluralWithForms(
    activeCount,
    language,
    t.activeForms,
  )}`;

  const desktopLinks = ringEngine(ENGINE_DESKTOP);
  const mobileLinks = ringEngine(ENGINE_MOBILE);

  const byId = new Map<string, IntelligenceModuleConfig>(
    INTELLIGENCE_MODULES.map((moduleItem) => [moduleItem.id, moduleItem]),
  );
  const desktopById = new Map(ENGINE_DESKTOP.items.map((item) => [item.id, item]));
  const mobileById = new Map(ENGINE_MOBILE.items.map((item) => [item.id, item]));

  /**
   * The nine cards, in released geometry order. A module named in
   * RING_ORDER that no longer exists in the registry, or a ring slot with
   * no coordinates, surfaces here as a MISSING card rather than silently
   * shifting the whole composition — the same fail-loud property the
   * M65.1 id-keyed slot table had, kept deliberately.
   */
  const cards: RingCard[] = [];
  for (const id of RING_ORDER) {
    const moduleItem = byId.get(id);
    const desktop = desktopById.get(id);
    const mobile = mobileById.get(id);
    if (moduleItem && desktop && mobile) {
      cards.push({ module: moduleItem, desktop, mobile });
    }
  }

  /**
   * GN-CD-143/144 — the hub core content, rendered ONCE.
   *
   * CTO decision D-8 B / D-8a: the three-line title duplicates the
   * section's own <h2>, so it is decorative and `aria-hidden`; the
   * derived capability line is real information that appears nowhere
   * else, so it stays in the accessibility tree at every viewport.
   * GN-CD-144 authors the status label as desktop-only, which is why it
   * is `sr-only` below `md` — visually absent as released, still
   * announced.
   *
   * DOCUMENTED DIVERGENCE: GN-CD-143 authors three lines via explicit
   * <br />. That is safe only for the English literal it was written
   * against; splitting a localized string at fixed points would break
   * Polish. The released type sizes and line-heights are applied to a
   * constrained box instead, which reproduces the three-line read in
   * English without inventing line breaks in any other language.
   */
  const hubCore = (
    <div className="flex flex-col items-center justify-center gap-cd-4 px-cd-4 text-center md:px-cd-18">
      <span
        aria-hidden="true"
        className="max-w-full font-cd-display text-cd-core-title-m text-cd-ink-primary md:text-cd-core-title"
      >
        {t.hubLabel}
      </span>
      <span className="sr-only font-cd-mono text-cd-mono-core-sub uppercase text-cd-ink-core-sub md:not-sr-only">
        {capabilityCountLabel}
      </span>
    </div>
  );

  return (
    <div
      className="relative mx-auto mt-cd-10 h-[340px] w-[310px] md:mt-cd-22 md:h-auto md:w-full cd-engine:h-[520px] cd-engine:w-[1240px]"
    >
      {/* GN-CD-154 — mobile network. Hardcoded rest stroke, no hover, no node opacity (UNRESOLVED-017, reproduced as released). */}
      <EngineNetwork
        config={ENGINE_MOBILE}
        links={mobileLinks}
        hovered={null}
        interactive={false}
        applyNodeOpacity={false}
        restStroke={CONNECTOR_REST_MOBILE}
        reduced={reduced}
        className="md:hidden"
      />

      {/* GN-CD-152 — desktop network. Consumes hover; applies the computed node opacities. */}
      <EngineNetwork
        config={ENGINE_DESKTOP}
        links={desktopLinks}
        hovered={hovered}
        interactive
        applyNodeOpacity
        restStroke={CONNECTOR_REST_DESKTOP}
        reduced={reduced}
        className="hidden cd-engine:block"
      />

      {/*
        GN-CD-137 → GN-CD-143 — the central engine hub, ONE element with
        three geometries. Below `md` the released 66×66 mobile hub at
        (122,141); from `md` to `cd-engine` the RETAINED intermediate hub,
        unchanged from what ships today (D-3 C); at `cd-engine` the
        released 296×296 desktop hub at (472,102).

        GN-CD §E, the geometric invariant: the anchor radius IS the hub's
        visual radius — 296/2 − 41 = 107 and 66/2 = 33 — so connectors
        terminate exactly on the breathing ring (desktop) and the core
        edge (mobile), never in empty space.
      */}
      <div className="absolute left-[122px] top-[141px] grid h-[66px] w-[66px] place-items-center md:static md:mx-auto md:mb-cd-28 md:h-[168px] md:w-[168px] cd-engine:absolute cd-engine:left-[472px] cd-engine:top-[102px] cd-engine:mb-0 cd-engine:h-[296px] cd-engine:w-[296px]">
        {/* GN-CD-138 — outer orbit. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-cd-hub-outer-m rounded-full border border-dashed border-cd-edge-section md:animate-cd-engine-orbit md:border-cd-hud-sky-13"
        />
        {/* GN-CD-140 — segmented radar band. Released at both authored viewports; absent from the retained intermediate hub. */}
        <span
          aria-hidden="true"
          className="absolute inset-[4px] animate-cd-hub-radar-m rounded-full border border-cd-hud-cyan-20 bg-cd-radar-m md:hidden cd-engine:inset-[22px] cd-engine:block cd-engine:animate-cd-engine-radar cd-engine:border-cd-hud-cyan-16 cd-engine:bg-cd-radar"
        />
        {/* GN-CD-141 — breathing ring. Desktop: this ring's radius IS the connector anchor radius. */}
        <span
          aria-hidden="true"
          className="absolute inset-[7px] animate-cd-engine-breath rounded-full border border-cd-hub-breath-m md:hidden cd-engine:inset-[41px] cd-engine:block cd-engine:border-cd-hub-breath"
        />
        {/* GN-CD-139 — inner dashed orbit. Desktop only; GN-CD verifies its absence on mobile as deliberate. */}
        <span
          aria-hidden="true"
          className="absolute inset-[55px] hidden rounded-full border border-dashed border-cd-hub-dash cd-engine:block cd-engine:animate-cd-engine-dashed"
        />
        {/* The retained intermediate hub ring — unchanged from the shipping composition (D-3 C). */}
        <span
          aria-hidden="true"
          className="absolute inset-0 hidden rounded-full border border-dashed border-cd-hub-breath md:block cd-engine:hidden"
        />
        {/* GN-CD-142/137 — core disc. Its second shadow IS the hub's outer glow; GN-CD-137 warns against implementing that twice. */}
        <div className="relative grid h-[52px] w-[52px] place-items-center rounded-full border border-cd-hub-core-m bg-cd-core-m shadow-cd-core-glow-m md:h-[76%] md:w-[76%] md:border-cd-hub-core md:bg-cd-core md:shadow-cd-core-glow cd-engine:h-[158px] cd-engine:w-[158px]">
          {hubCore}
        </div>
      </div>

      {/*
        GN-CD §D — the two-level card mount. The outer full-size layer is
        `pointer-events:none`; each card re-enables `pointer-events:auto`.
        "Both levels are required; collapsing them breaks either placement
        or hit-testing." In the retained intermediate band the same outer
        layer becomes the stacked grid.
      */}
      <div className="pointer-events-none absolute inset-0 md:pointer-events-auto md:static md:grid md:grid-cols-2 md:gap-cd-12 cd-engine:pointer-events-none cd-engine:absolute cd-engine:inset-0 cd-engine:block">
        {cards.map(({ module: moduleItem, desktop, mobile }) => (
          <div
            key={moduleItem.id}
            style={
              {
                '--mx': `${mobile.x - ENGINE_MOBILE.cardW / 2}px`,
                '--my': `${mobile.y - ENGINE_MOBILE.cardH / 2}px`,
                '--dx': `${desktop.x - ENGINE_DESKTOP.cardW / 2}px`,
                '--dy': `${desktop.y - ENGINE_DESKTOP.cardH / 2}px`,
              } as CSSProperties
            }
            className="pointer-events-auto absolute left-[var(--mx)] top-[var(--my)] h-[56px] w-[108px] md:static md:left-auto md:top-auto md:h-auto md:w-full cd-engine:absolute cd-engine:left-[var(--dx)] cd-engine:top-[var(--dy)] cd-engine:h-[82px] cd-engine:w-[340px]"
          >
            <IntelligenceModulePanel
              module={moduleItem}
              language={language}
              onEmphasisChange={setHovered}
              isEmphasized={hovered === moduleItem.id}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
