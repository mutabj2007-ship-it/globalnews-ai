'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ENERGY_GATES,
  ENERGY_SHEET_STAGES,
  ENERGY_SUBSTRATES,
  ENERGY_WINDOWS,
  effectiveWindow,
  nextSheetStage,
  windowFallsBackToSevenDay,
  type EnergySheetStage,
  type EnergySubstrate,
  type EnergyTier,
  type EnergyWindow,
} from '@/lib/energy/energyFrame';
import {
  ENERGY_INK,
  ENERGY_LAYOUT,
  ENERGY_LINE,
  ENERGY_RADIUS,
  ENERGY_SCRIPT_TOKEN_CSS,
  ENERGY_SEMANTIC,
  ENERGY_SURFACE,
  ENERGY_TYPE,
} from '@/lib/energy/energyTokens';
import { MachineReadable } from '@/lib/typography/runBoundary';
import { energyHref, type EnergyUrlState } from '@/lib/energy/energyUrl';
import { ENERGY_ABSENT, formatEnergyString, type EnergyStrings } from '@/lib/energy/energyStrings';
import { findSubject, type EnergyFrameData } from '@/lib/energy/energyModel';
import {
  AbsenceBlock,
  ChangeStateTokens,
  DataTierBadge,
  ENERGY_TONE_HEX,
  FrameBanner,
  Meta,
  PrecisionBadge,
  SectionLabel,
  StateChip,
  WatchControl,
  mono,
} from '@/components/energy/EnergyParts';
import { EnergySpatialSubstrate } from '@/components/energy/EnergySpatialSubstrate';
import { EnergyChangeGrid } from '@/components/energy/EnergyChangeGrid';
import { EnergyFlowDetail, EnergyFlowSankey } from '@/components/energy/EnergyFlowSankey';
import { EnergyAskOverlay } from '@/components/energy/EnergyAskOverlay';
import { EnergyLensDetail, EnergySituationLens, EnergySubjectDrawer, EnergySubjectHud } from '@/components/energy/EnergySubjectSurfaces';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE PERMANENT SHELL — ONE SHELL, FOUR REGIONS, THREE SUBSTRATES IN ONE SLOT
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   "Context bar with contextual return, substrate switcher, time window, tier
 *    state, Sand affordance; module rail; ONE substrate slot; ONE right region.
 *    NOTHING ELSE IS PERMANENT — evidence, Watch configuration, history,
 *    cross-domain and deep analysis are all transient."
 *
 * ── THE RIGHT REGION NEVER DOUBLES ───────────────────────────────────────
 *
 * R02 records the collision and its resolution: the drawer and the change
 * region both want the single right slot, "resolved BY REPLACEMENT, not a
 * second region". So `showChangeRegion` is literally `subject === null`, and
 * closing the drawer restores the change region untouched. There is no second
 * slot in this file for one to be added to.
 *
 * ── ONE URL WRITER ───────────────────────────────────────────────────────
 *
 * `writeUrl` below is the only place this shell touches the address bar. Every
 * interaction funnels through it. Two writers racing is the original H-C2
 * defect, and the accepted `/map` lineage pins exactly one writer for the same
 * reason.
 *
 * ── WHAT IS SHELL STATE AND WHAT IS URL STATE ────────────────────────────
 *
 *   URL      substrate · subject · window   (shareable; survives a reload)
 *   SHELL    lens · ask · sheet stage · reduced motion · tier · layers panel
 *
 * The split is the design's: "D is NOT A ROUTE", and a sheet stage is a gesture
 * position rather than a statement about the world. A reload lands the reader
 * on the same substrate, subject and window — with every transient surface
 * closed, which is what transient means.
 */

interface EnergyShellProps {
  readonly data: EnergyFrameData;
  readonly strings: EnergyStrings;
  readonly urlState: EnergyUrlState;
  readonly locale: string;
}

export function EnergyShell({ data, strings, urlState, locale }: EnergyShellProps): JSX.Element {
  const router = useRouter();

  /* ── SHELL-ONLY STATE ─────────────────────────────────────────────────── */
  const [lensOpen, setLensOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [hudId, setHudId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<EnergySheetStage>('half');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  /* M05 — entitlement is the Product Owner's. The shell defaults to FREE and does not grant. */
  const [tier, setTier] = useState<EnergyTier>('free');
  const [viewportWidth, setViewportWidth] = useState<number>(ENERGY_LAYOUT.reflowWidth);
  const [watchOverrides, setWatchOverrides] = useState<Readonly<Record<string, boolean>>>({});
  const substrateRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const measure = (): void => setViewportWidth(window.innerWidth);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  /* The platform honours the OS preference before any in-shell toggle is touched. */
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const listener = (event: MediaQueryListEvent): void => setReducedMotion(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  const compact = viewportWidth < ENERGY_LAYOUT.compactMaxWidth;
  const tight = viewportWidth < ENERGY_LAYOUT.reflowWidth;
  const abbreviate = viewportWidth < ENERGY_LAYOUT.abbreviateWidth;

  const subject = findSubject(data, urlState.subject);
  const hudSubject = findSubject(data, hudId);
  const watched = (id: string, fallback: boolean): boolean => watchOverrides[id] ?? fallback;

  /* ── THE SINGLE URL WRITER ────────────────────────────────────────────── */
  const writeUrl = useCallback(
    (next: Partial<EnergyUrlState>): void => {
      router.replace(energyHref({ ...urlState, ...next }), { scroll: false });
    },
    [router, urlState],
  );

  const setSubstrate = (substrate: EnergySubstrate): void => {
    setHudId(null);
    writeUrl({ substrate });
  };
  const setSubject = (id: string | null): void => {
    setHudId(null);
    writeUrl({ subject: id });
  };

  /**
   * ESCAPE CLOSES THE TOPMOST TRANSIENT SURFACE ONLY, in the order the state
   * board fixes: HUD → drawer → lens → Ask. One press is one dismissal, so a
   * reader who opened three surfaces gets three presses back rather than being
   * dropped to the substrate from any depth.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (askOpen) setAskOpen(false);
      else if (lensOpen) setLensOpen(false);
      else if (hudId !== null) setHudId(null);
      else if (urlState.subject !== null) setSubject(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  /* ── THE WINDOW, AND M05'S EXPLICIT FALLBACK ──────────────────────────── */
  const fallingBack = windowFallsBackToSevenDay(urlState.window, data.hasVisitCheckpoint);
  const activeWindow = effectiveWindow(urlState.window, data.hasVisitCheckpoint);
  const windowLabel = fallingBack ? strings.windowFallbackLabel : strings.window[activeWindow];

  const mapWidth = Math.max(viewportWidth - ENERGY_LAYOUT.railWidth - ENERGY_LAYOUT.rightRegionWidth, 240);
  const layersAsChip = mapWidth < ENERGY_LAYOUT.layersChipMapWidth;
  const changeColumns = viewportWidth < ENERGY_LAYOUT.reflowWidth ? ENERGY_LAYOUT.changeColumnsNarrow : ENERGY_LAYOUT.changeColumnsWide;

  /* A stable frame for the substrate camera; the governed frame has no corridors to fit. */
  const bbox = useMemo<readonly [number, number, number, number]>(() => [-14, 62, 70, 8], []);

  const toggleWatch = (id: string, current: boolean): void => {
    setWatchOverrides((previous) => ({ ...previous, [id]: !current }));
  };

  /**
   * §E — THE SCRIPT-SCOPED TOKENS, DECLARED ONCE.
   *
   * `:root` carries the frozen Latin values; `:root:lang(ar), [lang|="ar"]`
   * raises the metadata floor to 11px and neutralises tracking, for Arabic
   * script only. No component branches on locale — they read `var(--ene-meta-fs)`
   * — so no surface that reuses a component can forget the override.
   *
   * ── R4 · WHY THIS IS `dangerouslySetInnerHTML` AND NOT A TEXT CHILD ──────
   *
   * It was `<style>{ENERGY_SCRIPT_TOKEN_CSS}</style>` from R2 to R3, and that
   * was the whole of the `/energy` hydration failure. **A text child of any
   * element is escaped by React**, so the server wrote
   *
   *     [lang|=&quot;ar&quot;]        server
   *     [lang|="ar"]               client
   *
   * — one text node that disagrees, which React reports as `Text content did
   * not match` and then answers by throwing away the server HTML for the whole
   * document and re-rendering it on the client.
   *
   * **AND THE SERVER-RENDERED CSS WAS ACTUALLY BROKEN, WHICH IS THE WORSE
   * HALF.** A `<style>` element's content is RAWTEXT in the HTML parser:
   * character references inside it are NOT decoded. So the browser's CSS
   * parser received the literal `&quot;`, which is not a valid attribute
   * value, and **an invalid selector invalidates the entire selector list** —
   * taking `:root:lang(ar)` down with it. The Arabic 11px override did not
   * exist in the server-rendered stylesheet at all; it only appeared once
   * hydration had replaced the document. Measured: the R3 build's `/energy`
   * HTML contains `lang|=&quot;ar&quot;` once and `lang|="ar"` zero times.
   *
   * So this is a CORRECTNESS fix, not a warning silenced. The two values were
   * never designed to differ — they are designed to be byte-identical, and
   * React's text escaping is the only thing that made them differ.
   * `dangerouslySetInnerHTML` is the primitive that says "this content is raw
   * text", which is exactly what a stylesheet is. `suppressHydrationWarning`
   * would have hidden the warning and LEFT THE BROKEN SELECTOR IN PLACE.
   *
   * The CSS itself is unchanged, deliberately: dropping the quotes to dodge
   * the escape would fix this one character and leave the next `>` combinator
   * to reintroduce the defect silently. Guard §25 renders both forms through
   * `react-dom/server` and asserts the escape is real and this form is exact.
   */
  const scriptTokens = <style dangerouslySetInnerHTML={{ __html: ENERGY_SCRIPT_TOKEN_CSS }} />;

  /* ══ COMPACT ═══════════════════════════════════════════════════════════ */
  if (compact) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: ENERGY_SURFACE.void }} data-energy-shell="compact" lang={locale}>
        {scriptTokens}
        <div
          style={{
            height: `${ENERGY_LAYOUT.compactBarHeight}px`,
            flex: 'none',
            borderBottom: `1px solid ${ENERGY_LINE.hairline}`,
            background: ENERGY_SURFACE.chrome,
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            gap: '10px',
          }}
        >
          <button
            type="button"
            onClick={() => (subject === null ? setSubstrate('spatial') : setSubject(null))}
            style={{ ...mono(11, ENERGY_SEMANTIC.cyan), background: 'none', border: 'none', minWidth: '44px', minHeight: '44px', textAlign: 'left', cursor: 'pointer' }}
          >
            ← {subject === null ? strings.returnToEnergy : strings.substrateCrumb[urlState.substrate]}
          </button>
          <div style={{ flex: 1, minWidth: 0 }} />
          <TierChip tier={tier} strings={strings} onToggle={() => setTier(tier === 'free' ? 'professional' : 'free')} short />
        </div>

        <div data-energy-substrate={urlState.substrate} style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden', background: ENERGY_SURFACE.substrate }}>
          <EnergySpatialSubstrate data={data} reducedMotion={reducedMotion} bbox={bbox} />
          <div style={{ position: 'absolute', top: '12px', left: '14px', right: '14px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={{ ...mono(undefined, ENERGY_INK.meta), letterSpacing: '.16em', textShadow: '0 1px 6px #000' }}>
              {strings.substrateEyebrow[urlState.substrate]}
            </span>
            <span style={{ fontSize: '15px', fontWeight: 600, lineHeight: 1.3, color: ENERGY_INK.primary, textShadow: '0 1px 8px rgba(0,0,0,.9)' }}>
              {subject === null ? strings.substrateHeadline[urlState.substrate] : subject.name}
            </span>
          </div>
          <div style={{ position: 'absolute', bottom: '8px', left: '14px', right: '14px' }}>
            {subject?.geometry != null ? (
              <PrecisionBadge precision={subject.geometry.precision} strings={strings} />
            ) : (
              <Meta tone={ENERGY_INK.quiet}>{strings.precisionRule}</Meta>
            )}
          </div>
        </div>

        {/* ONE SHEET, THREE STAGES. No desktop panel is scaled, and no HUD floats over evidence. */}
        <div
          data-energy-sheet={sheet}
          style={{
            flex: 'none',
            height: sheet === 'peek' ? `${ENERGY_LAYOUT.sheetPeekPx}px` : sheet === 'half' ? ENERGY_LAYOUT.sheetHalfPct : ENERGY_LAYOUT.sheetFull,
            background: ENERGY_SURFACE.chrome,
            borderTop: `1px solid ${ENERGY_LINE.panel}`,
            borderRadius: '14px 14px 0 0',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            transition: reducedMotion ? 'none' : 'height .22s ease',
          }}
        >
          <button
            type="button"
            onClick={() => setSheet(nextSheetStage(sheet))}
            aria-label={`${strings.sheetStage[sheet]} · ${ENERGY_SHEET_STAGES.join(' / ')}`}
            style={{ height: '34px', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <span style={{ width: '44px', height: '4px', borderRadius: '2px', background: 'rgba(141,162,184,.45)' }} />
          </button>
          <div style={{ padding: '0 16px 10px', flex: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Meta>{subject === null ? strings.substrateHeadline.change : strings.lensTitle}</Meta>
            <div style={{ flex: 1 }} />
            <MachineReadable>
              <Meta>{strings.sheetStage[sheet]}</Meta>
            </MachineReadable>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {subject === null ? (
              <>
                <CompactFeed data={data} strings={strings} onSelect={(id) => { setSubject(id); setSheet('half'); }} />
                <AbsenceLegend strings={strings} />
              </>
            ) : (
              <CompactSubject
                data={data}
                strings={strings}
                subjectId={subject.id}
                watched={watched(subject.id, subject.watched)}
                onToggleWatch={() => toggleWatch(subject.id, watched(subject.id, subject.watched))}
                onAsk={() => setAskOpen(true)}
              />
            )}
          </div>
        </div>

        <div
          style={{
            height: `${ENERGY_LAYOUT.tabBarHeight}px`,
            flex: 'none',
            borderTop: `1px solid ${ENERGY_LINE.hairline}`,
            background: ENERGY_SURFACE.chrome,
            display: 'flex',
            alignItems: 'stretch',
          }}
        >
          {(['map', 'changed', 'watch', 'ask'] as const).map((tab) => {
            const active =
              (tab === 'map' && urlState.substrate === 'spatial') || (tab === 'changed' && urlState.substrate === 'change');
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  if (tab === 'ask') setAskOpen(true);
                  else if (tab === 'watch') { setSubstrate('change'); setSheet('full'); }
                  else { setSubstrate(tab === 'map' ? 'spatial' : 'change'); setSheet(tab === 'changed' ? 'full' : 'half'); }
                }}
                style={{
                  flex: 1,
                  minHeight: `${ENERGY_LAYOUT.touchTargetMin}px`,
                  ...mono(undefined, tab === 'watch' ? ENERGY_SEMANTIC.mint : active ? ENERGY_INK.primary : ENERGY_INK.quiet),
                  background: 'none',
                  border: 'none',
                  borderTop: `2px solid ${active ? ENERGY_SEMANTIC.cyan : 'transparent'}`,
                  cursor: 'pointer',
                }}
              >
                {strings.tabs[tab]}
              </button>
            );
          })}
        </div>

        <FrameBanner source={data.source} strings={strings} />

        {askOpen ? (
          <EnergyAskOverlay data={data} subject={subject} strings={strings} returnLabel={strings.returnToEnergy} compact onClose={() => setAskOpen(false)} />
        ) : null}
      </div>
    );
  }

  /* ══ DESKTOP ═══════════════════════════════════════════════════════════ */
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: ENERGY_SURFACE.void }} data-energy-shell="desktop" lang={locale}>
      {scriptTokens}
      {/* ── CONTEXT BAR ──────────────────────────────────────────────────── */}
      <div
        style={{
          height: `${ENERGY_LAYOUT.contextBarHeight}px`,
          flex: 'none',
          borderBottom: `1px solid ${ENERGY_LINE.hairline}`,
          background: ENERGY_SURFACE.chrome,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flex: 'none' }}>
          <div style={{ width: '18px', height: '18px', border: `1.5px solid ${ENERGY_SEMANTIC.cyan}`, borderRadius: '3px' }} />
          <span style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '-.01em', color: ENERGY_INK.primary }}>{strings.moduleName}</span>
        </div>

        {/* CONTEXTUAL RETURN. Always present; it is how every transient surface is left. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
          <span style={{ color: ENERGY_INK.rule }}>/</span>
          <button type="button" onClick={() => { setSubject(null); setLensOpen(false); }} style={{ fontSize: '13.5px', color: subject === null ? ENERGY_INK.primary : ENERGY_INK.quiet, background: 'none', border: 'none', cursor: 'pointer' }}>
            {strings.substrateCrumb[urlState.substrate]}
          </button>
          {subject === null ? null : (
            <>
              <span style={{ color: ENERGY_INK.rule }}>/</span>
              <button type="button" onClick={() => setLensOpen(true)} style={{ fontSize: '13.5px', color: ENERGY_SEMANTIC.cyan, background: 'none', border: 'none', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {subject.name}
              </button>
            </>
          )}
        </div>

        <Segmented
          items={ENERGY_SUBSTRATES.map((value) => ({
            key: value,
            label: tight ? strings.substrateShort[value] : strings.substrate[value],
            active: urlState.substrate === value,
            onClick: () => setSubstrate(value),
          }))}
        />

        <Segmented
          items={ENERGY_WINDOWS.map((value) => ({
            key: value,
            label: tight ? strings.windowShort[value] : strings.window[value],
            active: urlState.window === value,
            onClick: () => writeUrl({ window: value }),
          }))}
          small
        />

        <TierChip tier={tier} strings={strings} onToggle={() => setTier(tier === 'free' ? 'professional' : 'free')} short={tight} />

        <button
          type="button"
          onClick={() => setReducedMotion(!reducedMotion)}
          aria-pressed={reducedMotion}
          style={{
            ...mono(undefined, reducedMotion ? ENERGY_SEMANTIC.mint : ENERGY_INK.quiet),
            border: `1px solid ${ENERGY_LINE.panel}`,
            borderRadius: ENERGY_RADIUS.chip,
            padding: '5px 9px',
            background: 'none',
            cursor: 'pointer',
            flex: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {abbreviate ? (reducedMotion ? 'RM · ON' : 'RM · OFF') : reducedMotion ? strings.reducedMotionOn : strings.reducedMotionOff}
        </button>

        {/* THE SAND AFFORDANCE, WITHOUT A BALANCE. Main sets no numbers; neither does this. */}
        <span
          data-energy-price="unset"
          style={{
            ...mono(undefined, ENERGY_INK.quiet),
            border: `1px solid ${ENERGY_LINE.sand}`,
            borderRadius: ENERGY_RADIUS.chip,
            padding: '5px 9px',
            flex: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {abbreviate ? ENERGY_ABSENT : strings.priceNotSet}
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* ── MODULE RAIL ───────────────────────────────────────────────── */}
        <nav
          aria-label={strings.moduleName}
          style={{
            width: `${ENERGY_LAYOUT.railWidth}px`,
            flex: 'none',
            borderRight: `1px solid ${ENERGY_LINE.hairline}`,
            background: ENERGY_SURFACE.chrome,
            display: 'flex',
            flexDirection: 'column',
            padding: '12px 0',
          }}
        >
          {strings.railItems.map((item, index) => (
            <button
              key={item}
              type="button"
              onClick={() => setSubstrate(index === 6 ? 'change' : index === 1 ? 'flows' : 'spatial')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 16px',
                fontSize: '13px',
                color: index === 0 ? ENERGY_INK.primary : ENERGY_INK.quiet,
                borderLeft: `2px solid ${index === 0 ? ENERGY_SEMANTIC.cyan : 'transparent'}`,
                background: 'none',
                border: 'none',
                borderLeftWidth: '2px',
                borderLeftStyle: 'solid',
                borderLeftColor: index === 0 ? ENERGY_SEMANTIC.cyan : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: index === 0 ? ENERGY_SEMANTIC.cyan : ENERGY_INK.rule }} />
              <span>{item}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ margin: '0 12px 12px', padding: '11px 12px', border: `1px solid ${ENERGY_LINE.mint}`, borderRadius: ENERGY_RADIUS.panel, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ ...mono(undefined, ENERGY_SEMANTIC.mint), letterSpacing: '.14em' }}>{formatEnergyString(strings.watchActiveTemplate, { count: data.watchCount })}</span>
            <span style={{ fontSize: '11.5px', color: ENERGY_INK.meta, lineHeight: 1.4 }}>
              {tier === 'free' ? strings.watchProfessionalOnly : `${ENERGY_GATES.E02.id} · ${ENERGY_GATES.E02.stops}`}
            </span>
          </div>
        </nav>

        {/* ── THE ONE SUBSTRATE SLOT ────────────────────────────────────── */}
        {/*
          THE SLOT DECLARES WHICH SUBSTRATE IS MOUNTED — not the chart inside it.
          Measured cause for moving it: substrate B renders a LOCATOR MAP, so a
          marker on the map component made the flows substrate report itself as
          spatial. One slot, one declaration, and it is true in every branch
          including the one that renders an absence.
        */}
        <div
          data-energy-substrate={urlState.substrate}
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}
          ref={substrateRef}
        >
          {urlState.substrate === 'spatial' ? (
            <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden', background: ENERGY_SURFACE.substrate }}>
              <EnergySpatialSubstrate data={data} reducedMotion={reducedMotion} bbox={bbox} />

              <div style={{ position: 'absolute', top: '14px', left: '16px', display: 'flex', flexDirection: 'column', gap: '7px', maxWidth: '420px', opacity: layersAsChip && layersOpen ? 0 : 1 }}>
                <span style={{ ...mono(undefined, ENERGY_INK.meta), letterSpacing: '.2em', lineHeight: 1.5 }}>{strings.substrateEyebrow.spatial}</span>
                <span style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-.01em', color: ENERGY_INK.primary, textShadow: '0 1px 10px rgba(0,0,0,.85)' }}>
                  {strings.substrateHeadline.spatial}
                </span>
                <span style={{ fontSize: '12.5px', color: ENERGY_INK.secondary, lineHeight: 1.5, textShadow: '0 1px 8px rgba(0,0,0,.9)' }}>
                  {strings.substrateTextSummary}
                </span>
              </div>

              <LayersPanel strings={strings} asChip={layersAsChip} open={layersOpen} onToggle={() => setLayersOpen(!layersOpen)} />

              {/*
                THE HUD IS CLAMPED INSIDE THE SUBSTRATE BOUNDS — R02's collision
                resolution, so an anchored HUD can never overlap the substrate
                title or leave the slot. The clamp is computed here, where the
                slot's size is known, rather than inside the HUD.
              */}
              {hudSubject === null ? null : (
                <EnergySubjectHud
                  subject={hudSubject}
                  strings={strings}
                  x={Math.min(Math.max(mapWidth * 0.36, 12), Math.max(mapWidth - 302, 12))}
                  y={120}
                  onClose={() => setHudId(null)}
                  onInvestigate={() => { setSubject(hudSubject.id); setHudId(null); }}
                  onToggleWatch={() => toggleWatch(hudSubject.id, watched(hudSubject.id, hudSubject.watched))}
                />
              )}

              {/* Subjects whose geometry is withheld stay reachable, beside the map. */}
              <SubjectList data={data} strings={strings} onSelect={(id) => setHudId(id)} />

              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '38px',
                  background: 'rgba(7,13,22,.96)',
                  borderTop: `1px solid ${ENERGY_LINE.hairline}`,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 16px',
                  gap: '16px',
                }}
              >
                {/*
                  §E · BIDI ISOLATION VIA THE ACCEPTED COMPONENT.

                  `±25 km` is the sharp case L named: `±` is a bidi NEUTRAL, so
                  in an RTL paragraph it can render on the wrong side of the
                  number and the measurement reads as a different measurement.
                  `MachineReadable` (`dir="ltr"` + `unicode-bidi: isolate`) is
                  the accepted primitive with 28 consumers in this tree, adopted
                  rather than re-authored — *"authoring a second isolation
                  primitive for Energy is refused."*
                */}
                <MachineReadable>
                  <PrecisionBadge precision="CORRIDOR_25KM" strings={strings} withRule />
                </MachineReadable>
                <div style={{ flex: 1 }} />
                <MachineReadable>
                  <Meta>{strings.rendererLabel}</Meta>
                </MachineReadable>
              </div>
            </div>
          ) : urlState.substrate === 'change' ? (
            <EnergyChangeGrid data={data} strings={strings} selectedId={urlState.subject} onSelect={setSubject} windowLabel={windowLabel} columns={changeColumns} />
          ) : (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px 22px 10px', borderBottom: `1px solid ${ENERGY_LINE.hairlineSoft}`, display: 'flex', alignItems: 'flex-end', gap: '16px', flex: 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ ...mono(undefined, ENERGY_INK.meta), letterSpacing: '.2em' }}>{strings.substrateEyebrow.flows}</span>
                  <span style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-.01em', color: ENERGY_INK.primary }}>{strings.substrateHeadline.flows}</span>
                </div>
                <div style={{ flex: 1 }} />
                <span style={{ ...mono(undefined, ENERGY_SEMANTIC.amber), border: `1px solid ${ENERGY_LINE.amber}`, padding: '4px 8px', borderRadius: ENERGY_RADIUS.chip }}>
                  {strings.flowsPeriodicNotLive}
                </span>
              </div>
              <EnergyFlowSankey data={data} strings={strings} width={mapWidth} height={320} />
              <EnergyFlowDetail
                data={data}
                strings={strings}
                locator={<EnergySpatialSubstrate data={data} reducedMotion={reducedMotion} bbox={[-6, 60, 26, 42]} />}
              />
            </div>
          )}

          <FrameBanner source={data.source} strings={strings} />
        </div>

        {/* ── THE ONE RIGHT REGION ──────────────────────────────────────── */}
        <aside
          style={{
            width: `${subject === null ? ENERGY_LAYOUT.rightRegionWidth : ENERGY_LAYOUT.rightRegionWidthWithSubject}px`,
            flex: 'none',
            borderLeft: `1px solid ${ENERGY_LINE.hairline}`,
            background: ENERGY_SURFACE.chrome,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          {subject === null ? (
            <ChangeRegion data={data} strings={strings} tier={tier} onSelect={setSubject} onAsk={() => setAskOpen(true)} windowLabel={windowLabel} fallbackWhy={fallingBack ? strings.windowFallbackWhy : null} />
          ) : (
            <EnergySubjectDrawer
              subject={{ ...subject, watched: watched(subject.id, subject.watched) }}
              strings={strings}
              onClose={() => setSubject(null)}
              onOpenLens={() => setLensOpen(true)}
              onToggleWatch={() => toggleWatch(subject.id, watched(subject.id, subject.watched))}
            />
          )}
        </aside>
      </div>

      {lensOpen && subject !== null ? (
        <EnergySituationLens
          subject={{ ...subject, watched: watched(subject.id, subject.watched) }}
          strings={strings}
          returnLabel={subject.name}
          onClose={() => setLensOpen(false)}
          onToggleWatch={() => toggleWatch(subject.id, watched(subject.id, subject.watched))}
          onOpenAsk={() => setAskOpen(true)}
        >
          <EnergyLensDetail
            subject={subject}
            strings={strings}
            facet={<EnergySpatialSubstrate data={data} reducedMotion={reducedMotion} bbox={bbox} />}
          />
        </EnergySituationLens>
      ) : null}

      {askOpen ? (
        <EnergyAskOverlay data={data} subject={subject} strings={strings} returnLabel={subject?.name ?? strings.substrateCrumb[urlState.substrate]} compact={false} onClose={() => setAskOpen(false)} />
      ) : null}
    </div>
  );
}

/* ══ SHELL FURNITURE ═══════════════════════════════════════════════════════ */

function Segmented({
  items,
  small = false,
}: {
  items: readonly { key: string; label: string; active: boolean; onClick: () => void }[];
  small?: boolean;
}): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', border: `1px solid ${ENERGY_LINE.panel}`, borderRadius: ENERGY_RADIUS.panel, padding: '2px', flex: 'none' }}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={item.active}
          onClick={item.onClick}
          style={{
            ...mono(small ? 10 : 10.5, item.active ? ENERGY_SURFACE.void : ENERGY_INK.quiet),
            letterSpacing: small ? '.08em' : '.1em',
            padding: small ? '5px 8px' : '6px 11px',
            borderRadius: ENERGY_RADIUS.chip,
            background: item.active ? (small ? ENERGY_INK.body : ENERGY_INK.primary) : 'transparent',
            border: 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function TierChip({ tier, strings, onToggle, short }: { tier: EnergyTier; strings: EnergyStrings; onToggle: () => void; short?: boolean }): JSX.Element {
  const professional = tier === 'professional';
  return (
    <button
      type="button"
      onClick={onToggle}
      data-energy-tier-state={tier}
      style={{
        ...mono(undefined, professional ? ENERGY_SEMANTIC.violet : ENERGY_INK.quiet),
        border: `1px solid ${professional ? ENERGY_LINE.violet : ENERGY_LINE.achromatic}`,
        borderRadius: ENERGY_RADIUS.chip,
        padding: '5px 9px',
        background: 'none',
        cursor: 'pointer',
        flex: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {short ? (professional ? 'PRO' : 'FREE') : professional ? strings.tierProfessional : strings.tierFree}
    </button>
  );
}

function LayersPanel({ strings, asChip, open, onToggle }: { strings: EnergyStrings; asChip: boolean; open: boolean; onToggle: () => void }): JSX.Element {
  if (asChip && !open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        style={{
          position: 'absolute',
          top: '14px',
          right: '16px',
          ...mono(undefined, ENERGY_INK.body),
          background: 'rgba(10,18,28,.94)',
          border: `1px solid ${ENERGY_LINE.panel}`,
          padding: '6px 10px',
          borderRadius: ENERGY_RADIUS.chip,
          cursor: 'pointer',
        }}
      >
        {strings.layersTitle} · {strings.layers.length}
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: asChip ? '48px' : '14px',
        right: '16px',
        width: '214px',
        background: 'rgba(10,18,28,.96)',
        border: `1px solid ${ENERGY_LINE.panel}`,
        borderRadius: ENERGY_RADIUS.card,
        padding: '12px 13px',
        display: 'flex',
        flexDirection: 'column',
        gap: '9px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionLabel>{strings.layersTitle}</SectionLabel>
        {asChip ? (
          <button type="button" onClick={onToggle} aria-label="Close" style={{ ...mono(11, ENERGY_INK.meta), background: 'none', border: 'none', cursor: 'pointer' }}>
            ✕
          </button>
        ) : null}
      </div>
      {/*
        A LICENSED LAYER IS A ROW, NOT AN EMPTY TOGGLE. The degradation matrix:
        "Licensed layers render as violet UNAVAILABLE ROWS in the layers panel,
        NOT AS EMPTY TOGGLES … Must remain: the statement that the capability
        exists and the tier does not provide it."
      */}
      {strings.layers.map((layer) => (
        <div key={layer.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: ENERGY_INK.body }}>{layer.label}</span>
          <DataTierBadge tier={layer.tier} strings={strings} />
        </div>
      ))}
    </div>
  );
}

function SubjectList({ data, strings, onSelect }: { data: EnergyFrameData; strings: EnergyStrings; onSelect: (id: string) => void }): JSX.Element | null {
  if (data.subjects.length === 0) return null;
  return (
    /*
      THE TEXT PATH TO EVERY SUBJECT. The accessibility contract promises "the
      map is not the only path to any subject", and a subject whose geometry E01
      withholds has NO other path — so this list is not a convenience, it is the
      reachability guarantee. Its heading is omitted because the substrate title
      already states the rule; repeating it put two copies of the same sentence
      on the same surface.
    */
    <div
      aria-label={strings.substrateTextSummary}
      style={{ position: 'absolute', left: '16px', bottom: '52px', display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '300px' }}
    >
      {data.subjects.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minHeight: '32px',
            background: 'rgba(10,18,28,.9)',
            border: `1px solid ${ENERGY_LINE.hairline}`,
            borderRadius: ENERGY_RADIUS.chip,
            padding: '4px 8px',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ width: '4px', height: '14px', background: ENERGY_TONE_HEX[item.tone], borderRadius: '1px', flex: 'none' }} />
          <span style={{ fontSize: '12px', color: ENERGY_INK.body }}>{item.name}</span>
          {item.geometry === null ? <Meta tone={ENERGY_SEMANTIC.violet}>{item.geometryWithheldBy}</Meta> : null}
        </button>
      ))}
    </div>
  );
}

function ChangeRegion({
  data,
  strings,
  tier,
  onSelect,
  onAsk,
  windowLabel,
  fallbackWhy,
}: {
  data: EnergyFrameData;
  strings: EnergyStrings;
  tier: EnergyTier;
  onSelect: (id: string | null) => void;
  onAsk: () => void;
  windowLabel: string;
  fallbackWhy: string | null;
}): JSX.Element {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '13px 16px 11px', borderBottom: `1px solid ${ENERGY_LINE.hairline}`, display: 'flex', flexDirection: 'column', gap: '7px', flex: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <SectionLabel>{tier === 'free' ? strings.tierFree : strings.substrateHeadline.change}</SectionLabel>
          <Meta tone={tier === 'professional' ? ENERGY_SEMANTIC.violet : ENERGY_INK.quiet}>{windowLabel}</Meta>
        </div>
        {/* M05's fallback states itself, in the reader's language, every time it is in force. */}
        {fallbackWhy === null ? null : <span style={{ fontSize: '11.5px', color: ENERGY_INK.quiet, lineHeight: 1.5 }}>{fallbackWhy}</span>}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {data.feed.length === 0 ? (
          <AbsenceBlock zone={data.zones['change.grid'] ?? { readerState: 'NO_DATA', canonicalAbsence: 'NO_DATA', gate: null, whyKey: 'stateWhy' }} strings={strings} />
        ) : (
          data.feed.map((item, index) => (
            <button
              key={`${item.title}-${index}`}
              type="button"
              onClick={() => onSelect(item.subjectId)}
              data-energy-canonical={item.canonicalAbsence ?? undefined}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '12px 16px',
                borderBottom: `1px solid ${ENERGY_LINE.hairlineSoft}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                background: 'none',
                border: 'none',
                borderBottomWidth: '1px',
                borderBottomStyle: 'solid',
                borderBottomColor: ENERGY_LINE.hairlineSoft,
                cursor: item.subjectId === null ? 'default' : 'pointer',
                minHeight: '76px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {item.readerState === null ? (
                  item.changeState === null ? null : <ChangeStateTokens state={item.changeState} labels={strings.changeState} tone={item.tone} />
                ) : (
                  <StateChip state={item.readerState} strings={strings} canonical={item.canonicalAbsence} />
                )}
                <div style={{ flex: 1 }} />
                <Meta>{item.ago}</Meta>
              </div>
              <span style={{ fontSize: '13px', lineHeight: 1.45, color: ENERGY_INK.primary }}>{item.title}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Meta>{item.scopeLabel}</Meta>
                <div style={{ flex: 1 }} />
                <Meta tone={ENERGY_TONE_HEX[item.evidenceTone]}>{item.evidenceLabel}</Meta>
              </div>
            </button>
          ))
        )}

        {/*
          THE FOUR ABSENCE STATES, SHOWN TOGETHER. This panel is frozen design
          furniture and it is the one place all four treatments appear side by
          side, so a reader can learn the vocabulary without having to encounter
          each state by chance. It describes the vocabulary; it asserts no
          coverage, so it is honest in the governed frame too.
        */}
        <AbsenceLegend strings={strings} />

        {tier === 'free' ? (
          <div style={{ margin: '14px 16px', border: `1px solid ${ENERGY_LINE.violet}`, borderRadius: ENERGY_RADIUS.card, padding: '13px 14px', background: 'rgba(155,123,232,.07)', display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <SectionLabel tone={ENERGY_SEMANTIC.violet}>{strings.tierBoundaryTitle}</SectionLabel>
            <span style={{ fontSize: '12.5px', color: ENERGY_INK.body, lineHeight: 1.5 }}>{strings.tierBoundaryBody}</span>
            <Meta>{strings.tierBoundaryNote}</Meta>
          </div>
        ) : null}
      </div>

      <div style={{ flex: 'none', borderTop: `1px solid ${ENERGY_LINE.hairline}`, padding: '11px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button type="button" onClick={onAsk} style={{ flex: 1, textAlign: 'left', fontSize: '12.5px', color: ENERGY_SEMANTIC.cyan, background: 'none', border: 'none', cursor: 'pointer', minHeight: '44px' }}>
          {strings.askTitle}
        </button>
        <Meta>{strings.askZeroCost}</Meta>
      </div>
    </div>
  );
}

function CompactFeed({ data, strings, onSelect }: { data: EnergyFrameData; strings: EnergyStrings; onSelect: (id: string | null) => void }): JSX.Element {
  if (data.feed.length === 0) {
    const zone = data.zones['change.grid'];
    return zone === undefined ? <span /> : <AbsenceBlock zone={zone} strings={strings} />;
  }
  return (
    <>
      {data.feed.map((item, index) => (
        <button
          key={`${item.title}-${index}`}
          type="button"
          onClick={() => onSelect(item.subjectId)}
          style={{
            width: '100%',
            textAlign: 'left',
            minHeight: '76px',
            padding: '12px 16px',
            borderBottom: `1px solid ${ENERGY_LINE.hairlineSoft}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {item.readerState === null ? (
              item.changeState === null ? null : <ChangeStateTokens state={item.changeState} labels={strings.changeState} tone={item.tone} />
            ) : (
              <StateChip state={item.readerState} strings={strings} canonical={item.canonicalAbsence} />
            )}
            <div style={{ flex: 1 }} />
            <Meta>{item.ago}</Meta>
          </div>
          <span style={{ fontSize: '13.5px', lineHeight: 1.45, color: ENERGY_INK.primary }}>{item.title}</span>
          <Meta>{item.scopeLabel}</Meta>
        </button>
      ))}
    </>
  );
}

function CompactSubject({
  data,
  strings,
  subjectId,
  watched,
  onToggleWatch,
  onAsk,
}: {
  data: EnergyFrameData;
  strings: EnergyStrings;
  subjectId: string;
  watched: boolean;
  onToggleWatch: () => void;
  onAsk: () => void;
}): JSX.Element | null {
  const subject = findSubject(data, subjectId);
  if (subject === null) return null;

  return (
    <div>
      <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: '9px', borderBottom: `1px solid ${ENERGY_LINE.hairlineSoft}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {subject.readerState === null ? (
            subject.changeState === null ? null : <ChangeStateTokens state={subject.changeState} labels={strings.changeState} tone={subject.tone} />
          ) : (
            <StateChip state={subject.readerState} strings={strings} canonical={subject.canonicalAbsence} />
          )}
          <Meta>{strings.subjectType[subject.type]}</Meta>
        </div>
        <span style={{ fontSize: '17px', fontWeight: 600, lineHeight: 1.3, color: ENERGY_INK.primary }}>{subject.headline ?? subject.name}</span>
        <span style={{ fontSize: '13.5px', color: ENERGY_INK.secondary, lineHeight: 1.6 }}>
          {subject.assessment ?? strings.stateWhy[subject.readerState ?? 'NO_DATA']}
        </span>
        <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
          <WatchControl watched={watched} strings={strings} onToggle={onToggleWatch} />
          <button
            type="button"
            onClick={onAsk}
            style={{
              flex: 1,
              minHeight: `${ENERGY_LAYOUT.touchTargetControl}px`,
              ...mono(10.5, ENERGY_SEMANTIC.cyan),
              background: 'none',
              border: `1px solid ${ENERGY_LINE.cyan}`,
              borderRadius: ENERGY_RADIUS.panel,
              cursor: 'pointer',
            }}
          >
            {strings.askZeroCost}
          </button>
        </div>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '7px', borderBottom: `1px solid ${ENERGY_LINE.hairlineSoft}` }}>
        <SectionLabel>{strings.lensUncertain}</SectionLabel>
        <span style={{ fontSize: '12.5px', color: ENERGY_INK.secondary, lineHeight: 1.6 }}>{subject.uncertainty ?? ENERGY_ABSENT}</span>
      </div>

      <div style={{ padding: '14px 16px 8px' }}>
        <SectionLabel>{strings.lensTimeline}</SectionLabel>
      </div>
      {subject.timeline.map((entry) => (
        <div key={`${entry.at}-${entry.text}`} style={{ padding: '10px 16px', borderBottom: `1px solid ${ENERGY_LINE.hairlineFaint}`, display: 'flex', gap: '10px' }}>
          <span style={{ width: '3px', flex: 'none', background: ENERGY_TONE_HEX[entry.tone], borderRadius: '1px' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {entry.changeState === null ? null : (
              <ChangeStateTokens state={entry.changeState} labels={strings.changeState} tone={entry.tone} />
            )}
            <span style={{ fontSize: '12.5px', color: ENERGY_INK.body, lineHeight: 1.4 }}>{entry.text}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * THE FOUR TREATMENTS, TOGETHER, ON BOTH SHELLS.
 *
 * "PARITY, NOT SUBSET — Compact carries the same four achromatic-and-violet
 * absence treatments … as desktop." A reader who only ever meets one state at a
 * time never learns that the dashed border and the violet border mean different
 * things, so the vocabulary is shown once, in full, where it can be compared.
 *
 * It describes the vocabulary and asserts no coverage, which is why it is as
 * honest in the governed frame — where nothing is assessed — as in the fixture
 * one.
 */
function AbsenceLegend({ strings }: { strings: EnergyStrings }): JSX.Element {
  return (
    <div data-energy-absence-legend="true" style={{ padding: '13px 16px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
      <SectionLabel>{strings.absenceLegendTitle}</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        <StateChip state="NO_MATERIAL_CHANGE" strings={strings} />
        <StateChip state="COVERAGE_GAP" strings={strings} canonical="NO_DATA_FOR_GEOGRAPHY" />
        <StateChip state="UNAVAILABLE_LICENSED" strings={strings} canonical="TIER_RESTRICTED" />
        <StateChip state="NO_DATA" strings={strings} canonical="NO_DATA" />
      </div>
      <span style={{ fontSize: '11.5px', color: ENERGY_INK.quiet, lineHeight: 1.55 }}>{strings.stateWhy.NO_MATERIAL_CHANGE}</span>
    </div>
  );
}
