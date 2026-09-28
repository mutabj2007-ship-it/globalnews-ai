'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LanguageCode } from '@globalnews-ai/shared';
import {
  Activity,

  Bookmark,
  Building2,
  CandlestickChart,
  ChevronDown,
  Cpu,
  FileText,
  Flag,
  Globe,
  HandHeart,
  History,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  LogOut,
  Newspaper,
  PanelLeft,
  PanelLeftClose,
  Pin,
  PinOff,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Users,
  Vote,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { persistLanguageSelection } from '@/lib/i18n/languages';
import { MI_FOCUS, MI_SAND_FOCUS } from '../miPresentation';
import {
  ACCOUNT_SETTINGS_HREF,
  ANALYSIS_WORKSPACE_HREF,
  ELECTIONS_PREVIEW_HREF,
  IMIHIGO_HREF,
  INTELLIGENCE_DOMAINS,
  RAIL,
  initialOpenGroups,
  type DomainId,
  type RailGroupId,
  type WorkspaceView,
} from './miWorkspaceModel';

export const DOMAIN_ICONS: Readonly<Record<DomainId, LucideIcon>> = {
  map: Globe,
  politics: Landmark,
  economy: TrendingUp,
  market: CandlestickChart,
  energy: Zap,
  conflict: Shield,
  humanitarian: HandHeart,
};

export interface WorkspaceNavProps {
  readonly language: LanguageCode;
  readonly view: WorkspaceView;
  readonly onView: (view: WorkspaceView) => void;
  readonly onFollowing: () => void;
  readonly onSelect: () => void;
  readonly selecting: boolean;
  readonly counts: { readonly newSince: number; readonly saved: number; readonly following: number };
  readonly userName: string | null;
  readonly userEmail: string | null;
  readonly onSignOut: () => void;
  /** Called after any navigation the nav performs, so the drawer / overlay can close. */
  readonly onNavigated?: () => void;
}

const ROW =
  'flex min-h-[44px] w-full items-center gap-3 rounded-[10px] px-2.5 text-left text-[14px] font-semibold text-[#cfe2f2] transition-colors hover:bg-white/[0.05] motion-reduce:transition-none';
const ROW_ACTIVE = 'bg-[#07304f] text-white';
const BADGE =
  'ml-auto inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11.5px] font-bold';

function Badge({ value, strong = false }: { value: number; strong?: boolean }): JSX.Element | null {
  if (value <= 0) return null;
  return (
    <span className={`${BADGE} ${strong ? 'bg-[#1668d9] text-white' : 'bg-[#0b2c4d] text-[#93cdf5]'}`}>{value}</span>
  );
}

function GroupHeader({
  label,
  open,
  onToggle,
  controls,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  controls: string;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className={`${MI_FOCUS} flex min-h-[44px] w-full items-center justify-between px-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#7d92aa]`}
    >
      <span>{label}</span>
      <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
    </button>
  );
}

function RowLink({
  href,
  icon: Icon,
  label,
  sub,
  tag,
  onNavigated,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  sub?: string;
  tag?: string;
  onNavigated?: () => void;
}): JSX.Element {
  return (
    <Link href={href} onClick={onNavigated} className={`${MI_FOCUS} ${ROW}`}>
      <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[#8fb3d4]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {sub !== undefined && <span className="block truncate text-[11.5px] font-normal text-[#7d92aa]">{sub}</span>}
      </span>
      {tag !== undefined && (
        <span className="ml-auto shrink-0 rounded-[6px] border border-[#5a4e38] px-1.5 py-[1px] font-mono text-[10px] uppercase tracking-[0.08em] text-[#c9b48c]">
          {tag}
        </span>
      )}
    </Link>
  );
}

/**
 * THE WORKSPACE NAVIGATION — IA_BOARD.md, verbatim in structure.
 *
 * Every row is navigation or presentation. Nothing here runs AI or calls a
 * provider (INTERACTIONS.md): views change client state, links open existing
 * routes, Following opens the existing popout, Selected stories enters the
 * zero-compute selection mode, and Language is a presentation switch that
 * never reruns an analysis.
 */
export function WorkspaceNav({
  language,
  view,
  onView,
  onFollowing,
  onSelect,
  selecting,
  counts,
  userName,
  userEmail,
  onSignOut,
  onNavigated,
}: WorkspaceNavProps): JSX.Element {
  const w = getDictionary(language).myIntelligence.workspace;
  const [open, setOpen] = useState<ReadonlySet<RailGroupId>>(initialOpenGroups);
  const router = useRouter();

  const toggle = (id: RailGroupId): void =>
    setOpen((was) => {
      const next = new Set(was);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const go = (next: WorkspaceView): void => {
    onView(next);
    onNavigated?.();
  };

  const setLanguage = (next: LanguageCode): void => {
    if (next === language) return;
    /* Presentation only: persist the preference and re-render. Nothing reruns. */
    persistLanguageSelection(next);
    router.refresh();
  };

  const viewRow = (id: WorkspaceView, Icon: LucideIcon, label: string, badge?: ReactNode): JSX.Element => (
    <button
      type="button"
      aria-current={view === id ? 'page' : undefined}
      onClick={() => go(id)}
      className={`${MI_FOCUS} ${ROW} ${view === id ? ROW_ACTIVE : ''}`}
    >
      <Icon aria-hidden="true" className={`h-[18px] w-[18px] shrink-0 ${view === id ? 'text-[#5abff5]' : 'text-[#8fb3d4]'}`} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge}
    </button>
  );

  const initial = (userName ?? userEmail ?? '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <nav aria-label={w.railLabel} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
        {/* ── A · MY INTELLIGENCE ─────────────────────────────────────── */}
        <div className="border-b border-[#0a2744] py-1">
          <GroupHeader label={w.groups.mine} open={open.has('mine')} onToggle={() => toggle('mine')} controls="mi-nav-mine" />
          {open.has('mine') && (
            <div id="mi-nav-mine" className="flex flex-col gap-0.5 pb-1">
              {viewRow('today', LayoutDashboard, w.items.today)}
              {viewRow('forYou', Sparkles, w.items.forYou)}
              {viewRow('newSince', Newspaper, w.items.newSince, <Badge value={counts.newSince} strong />)}
              <p className="px-2.5 pb-0.5 pt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5d7188]">
                {w.groups.collections}
              </p>
              {viewRow('saved', Bookmark, w.items.saved, <Badge value={counts.saved} />)}
              <button
                type="button"
                onClick={() => {
                  onFollowing();
                  onNavigated?.();
                }}
                className={`${MI_FOCUS} ${ROW}`}
              >
                <Flag aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[#8fb3d4]" />
                <span className="min-w-0 flex-1 truncate">{w.items.following}</span>
                <Badge value={counts.following} />
              </button>
              {viewRow('history', History, w.items.history)}
              <button
                type="button"
                aria-pressed={selecting}
                onClick={() => {
                  onSelect();
                  onNavigated?.();
                }}
                className={`${MI_SAND_FOCUS} ${ROW} ${selecting ? 'bg-[#2e2618] text-[#D9B98A]' : ''}`}
              >
                <ListChecks aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[#8fb3d4]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{w.items.selected}</span>
                  <span className="block truncate text-[11.5px] font-normal text-[#7d92aa]">{w.items.selectedSub}</span>
                </span>
              </button>
            </div>
          )}
        </div>

        {/* ── B · INTELLIGENCE ────────────────────────────────────────── */}
        <div className="border-b border-[#0a2744] py-1">
          <GroupHeader label={w.groups.intelligence} open={open.has('intelligence')} onToggle={() => toggle('intelligence')} controls="mi-nav-intelligence" />
          {open.has('intelligence') && (
            <div id="mi-nav-intelligence" className="flex flex-col gap-0.5 pb-1">
              {INTELLIGENCE_DOMAINS.map((domain) => (
                <RowLink
                  key={domain.id}
                  href={domain.href}
                  icon={DOMAIN_ICONS[domain.id]}
                  label={w.domains[domain.id]}
                  tag={domain.preview ? w.preview : undefined}
                  onNavigated={onNavigated}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── SPECIALISTS ─────────────────────────────────────────────── */}
        <div className="border-b border-[#0a2744] py-1">
          <GroupHeader label={w.specialists.group} open={open.has('specialists')} onToggle={() => toggle('specialists')} controls="mi-nav-specialists" />
          {open.has('specialists') && (
            <div id="mi-nav-specialists" className="flex flex-col gap-0.5 pb-1">
              {viewRow('specialists', Users, w.specialists.pageTitle)}
              <RowLink
                href={ELECTIONS_PREVIEW_HREF}
                icon={Vote}
                label={w.specialists.elections}
                sub={w.specialists.countryAware}
                tag={w.preview}
                onNavigated={onNavigated}
              />
              <RowLink href={IMIHIGO_HREF} icon={Building2} label={w.specialists.imihigo} sub={w.specialists.imihigoSub} onNavigated={onNavigated} />
            </div>
          )}
        </div>

        {/* ── C · DEEP INTELLIGENCE ───────────────────────────────────── */}
        <div className="border-b border-[#0a2744] py-1">
          <GroupHeader label={w.groups.deep} open={open.has('deep')} onToggle={() => toggle('deep')} controls="mi-nav-deep" />
          {open.has('deep') && (
            <div id="mi-nav-deep" className="flex flex-col gap-0.5 pb-1">
              {/* Ask AI idle — never /search?q=, which auto-runs analysis. */}
              <RowLink href={ANALYSIS_WORKSPACE_HREF} icon={Activity} label={w.items.analysisWorkspace} sub={w.items.analysisWorkspaceSub} onNavigated={onNavigated} />
              <button
                type="button"
                onClick={() => {
                  onSelect();
                  onNavigated?.();
                }}
                className={`${MI_SAND_FOCUS} ${ROW}`}
              >
                <FileText aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[#8fb3d4]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{w.items.briefings}</span>
                  <span className="block truncate text-[11.5px] font-normal text-[#7d92aa]">{w.items.briefingsSub}</span>
                </span>
              </button>
              {/* D1 — informational, no route, no price; a NEUTRAL tag, never tier violet. */}
              <div className={`${ROW} cursor-default hover:bg-transparent`} data-mi-deep-intelligence="">
                <Cpu aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[#6a7f95]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[#9fb4cb]">{w.items.deepIntelligence}</span>
                  <span className="block truncate text-[11.5px] font-normal text-[#7d92aa]">{w.items.deepIntelligenceSub}</span>
                </span>
                <NotInBetaTag label={w.notInBeta} />
              </div>
            </div>
          )}
        </div>

        {/* ── D · ACCOUNT & CONTROL ───────────────────────────────────── */}
        <div className="py-1">
          <GroupHeader label={w.groups.account} open={open.has('account')} onToggle={() => toggle('account')} controls="mi-nav-account" />
          {open.has('account') && (
            <div id="mi-nav-account" className="flex flex-col gap-0.5 pb-1">
              <RowLink href={ACCOUNT_SETTINGS_HREF} icon={Users} label={w.items.accountItem} onNavigated={onNavigated} />
              <RowLink href={ACCOUNT_SETTINGS_HREF} icon={SlidersHorizontal} label={w.items.preferences} onNavigated={onNavigated} />
              <div className={`${ROW} cursor-default hover:bg-transparent`}>
                <Globe aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[#8fb3d4]" />
                <span className="min-w-0 flex-1 truncate">{w.items.language}</span>
                <span role="group" aria-label={w.items.language} className="ml-auto flex gap-1">
                  {(['en', 'pl'] as const).map((code) => (
                    <button
                      key={code}
                      type="button"
                      aria-pressed={language === code}
                      onClick={() => setLanguage(code)}
                      className={`${MI_FOCUS} min-h-[44px] min-w-[44px] rounded-full border px-2 text-[12px] font-bold uppercase ${
                        language === code ? 'border-[#1b6fa8] bg-[#07304f] text-[#cfe6ff]' : 'border-[#1d3a5a] text-[#9fb4cb]'
                      }`}
                    >
                      {code}
                    </button>
                  ))}
                </span>
              </div>
              {/* D7 — a status line, not a destination. No price, credit or balance. */}
              <div className={`${ROW} cursor-default hover:bg-transparent`} data-mi-plan-status="">
                <Cpu aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[#8fb3d4]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{w.items.plan}</span>
                  <span className="block truncate text-[11.5px] font-normal text-[#7d92aa]">{w.items.planStatus}</span>
                </span>
              </div>
              <RowLink href={ACCOUNT_SETTINGS_HREF} icon={Settings} label={w.items.settings} onNavigated={onNavigated} />
            </div>
          )}
        </div>
      </div>

      {/* Identity footer: avatar · name · plan line · Sign out. */}
      <div className="flex items-center gap-3 border-t border-[#0a2744] px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <span aria-hidden="true" className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full border border-[#1b6fa8] bg-[#07304f] text-[14px] font-bold text-[#cfe6ff]">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-white">{userName ?? userEmail ?? ''}</span>
          <span className="block truncate text-[12px] text-[#7d92aa]">{w.items.betaAccess}</span>
        </span>
        <button
          type="button"
          onClick={onSignOut}
          aria-label={w.items.signOut}
          title={w.items.signOut}
          className={`${MI_FOCUS} flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-[#9fb4cb] hover:text-white`}
        >
          <LogOut aria-hidden="true" className="h-[18px] w-[18px]" />
        </button>
      </div>
    </nav>
  );
}

/** D1 — the Not-in-Beta tag, neutral edge (#1d3a5a). */
export function NotInBetaTag({ label }: { label: string }): JSX.Element {
  return (
    <span className="ml-auto shrink-0 rounded-[8px] border border-[#1d3a5a] px-1.5 py-[2px] text-[11px] font-semibold text-[#cfe2f2]" data-mi-not-in-beta="">
      {label}
    </span>
  );
}

/**
 * THE DESKTOP RAIL (≥ lg). Collapsed 64px is always present; expanded 280px
 * overlays the workspace with a scrim (Esc / scrim / collapse close it);
 * pinned 280px pushes the workspace. Pin is page state only (D11).
 */
export function WorkspaceRail(
  props: WorkspaceNavProps & {
    readonly expanded: boolean;
    readonly pinned: boolean;
    readonly onExpandedChange: (expanded: boolean) => void;
    readonly onPinnedChange: (pinned: boolean) => void;
  },
): JSX.Element {
  const { language, view, onView, counts, expanded, pinned, onExpandedChange, onPinnedChange, selecting, onSelect, onFollowing, userName, userEmail } = props;
  const w = getDictionary(language).myIntelligence.workspace;
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const showFull = expanded || pinned;

  const close = useCallback(() => {
    onExpandedChange(false);
    openerRef.current?.focus();
  }, [onExpandedChange]);

  useEffect(() => {
    if (!expanded || pinned) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, expanded, pinned]);

  const icon = (label: string, Icon: LucideIcon, onClick: () => void, active = false, badge = 0, control?: string): JSX.Element => (
    <button
      type="button"
      data-mi-control={control}
      aria-label={label}
      title={label}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`${MI_FOCUS} relative flex h-[44px] w-[44px] items-center justify-center rounded-[10px] ${active ? 'bg-[#07304f] text-[#5abff5]' : 'text-[#8fb3d4] hover:bg-white/[0.05]'}`}
    >
      <Icon aria-hidden="true" className="h-[19px] w-[19px]" />
      {badge > 0 && (
        <span className="absolute right-[3px] top-[3px] min-w-[16px] rounded-full bg-[#1668d9] px-1 text-[10px] font-bold leading-[16px] text-white">
          {badge}
        </span>
      )}
    </button>
  );

  const openFull = (): void => onExpandedChange(true);
  const initial = (userName ?? userEmail ?? '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <>
      {/* The collapsed rail, always in flow unless pinned. */}
      {!pinned && (
        <aside
          data-mi-rail="collapsed"
          aria-label={w.railLabel}
          style={{ width: RAIL.collapsedPx }}
          className="sticky top-[64px] z-30 hidden h-[calc(100dvh-64px)] shrink-0 flex-col items-center gap-1 border-r border-[#0a2744] bg-[#020d1d] py-3 lg:flex xl:top-[62px] xl:h-[calc(100dvh-62px)]"
        >
          <button
            ref={openerRef}
            type="button"
            aria-expanded={expanded}
            aria-label={w.openRail}
            title={w.openRail}
            onClick={openFull}
            className={`${MI_FOCUS} mb-2 flex h-[44px] w-[44px] items-center justify-center rounded-[10px] border border-[#1d3a5a] text-[#cfe2f2]`}
          >
            <PanelLeft aria-hidden="true" className="h-[19px] w-[19px]" />
          </button>
          {icon(w.items.today, LayoutDashboard, () => onView('today'), view === 'today')}
          {icon(w.items.forYou, Sparkles, () => onView('forYou'), view === 'forYou')}
          {icon(w.items.newSince, Newspaper, () => onView('newSince'), view === 'newSince', counts.newSince)}
          <span aria-hidden="true" className="my-1.5 h-px w-8 bg-[#0a2744]" />
          {icon(w.items.saved, Bookmark, () => onView('saved'), view === 'saved')}
          {icon(w.items.following, Flag, onFollowing)}
          {icon(w.items.history, History, () => onView('history'), view === 'history')}
          {icon(w.items.selected, ListChecks, onSelect, selecting, 0, selecting ? 'selection-mode-active' : 'select')}
          <span aria-hidden="true" className="my-1.5 h-px w-8 bg-[#0a2744]" />
          {icon(w.groups.intelligence, LayoutGrid, openFull)}
          {icon(w.specialists.group, Users, () => onView('specialists'), view === 'specialists')}
          {icon(w.groups.deep, Activity, openFull)}
          <span className="flex-1" />
          {icon(w.groups.account, SlidersHorizontal, openFull)}
          <button
            type="button"
            aria-label={w.account}
            title={userName ?? userEmail ?? w.account}
            onClick={openFull}
            className={`${MI_FOCUS} flex h-[44px] w-[44px] items-center justify-center rounded-full border border-[#1b6fa8] bg-[#07304f] text-[14px] font-bold text-[#cfe6ff]`}
          >
            {initial}
          </button>
        </aside>
      )}

      {/* Expanded overlay (not pinned): a scrim below the header, and the 280px panel. */}
      {expanded && !pinned && (
        <div aria-hidden="true" onClick={close} className="fixed inset-x-0 bottom-0 top-[64px] z-40 hidden bg-[rgba(1,6,15,0.62)] lg:block xl:top-[62px]" />
      )}
      {showFull && (
        <aside
          data-mi-rail={pinned ? 'pinned' : 'expanded'}
          aria-label={w.railLabel}
          style={{ width: RAIL.expandedPx }}
          className={`${pinned ? 'sticky' : 'fixed left-0'} top-[64px] z-50 hidden h-[calc(100dvh-64px)] shrink-0 flex-col border-r border-[#0a2744] bg-[#020d1d] lg:flex xl:top-[62px] xl:h-[calc(100dvh-62px)]`}
        >
          <div className="flex items-center gap-2 border-b border-[#0a2744] px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7d92aa]">{w.workspaceLabel}</span>
              <span className="block truncate text-[16px] font-bold text-white">{getDictionary(language).myIntelligence.accountMenuItem}</span>
            </span>
            <button
              type="button"
              aria-pressed={pinned}
              aria-label={pinned ? w.unpin : w.pin}
              title={pinned ? w.unpin : w.pin}
              onClick={() => onPinnedChange(!pinned)}
              className={`${MI_FOCUS} flex h-[44px] w-[44px] items-center justify-center rounded-[10px] border ${pinned ? 'border-[#1b6fa8] bg-[#07304f] text-[#cfe6ff]' : 'border-[#1d3a5a] text-[#cfe2f2]'}`}
            >
              {pinned ? <PinOff aria-hidden="true" className="h-[18px] w-[18px]" /> : <Pin aria-hidden="true" className="h-[18px] w-[18px]" />}
            </button>
            <button
              type="button"
              aria-label={w.collapseRail}
              title={w.collapseRail}
              onClick={() => {
                onPinnedChange(false);
                close();
              }}
              className={`${MI_FOCUS} flex h-[44px] w-[44px] items-center justify-center rounded-[10px] text-[#cfe2f2]`}
            >
              <PanelLeftClose aria-hidden="true" className="h-[19px] w-[19px]" />
            </button>
          </div>
          <WorkspaceNav {...props} onNavigated={pinned ? undefined : () => onExpandedChange(false)} />
        </aside>
      )}
    </>
  );
}

/**
 * THE PHONE DRAWER (< lg). Full height, width min(viewport − 48, 340), scrim,
 * Esc closes, and it closes after any navigation (SPEC.md). Focus returns to
 * the menu button that opened it.
 */
export function WorkspaceDrawer(
  props: WorkspaceNavProps & { readonly open: boolean; readonly onClose: () => void },
): JSX.Element | null {
  const { open, onClose, language } = props;
  const w = getDictionary(language).myIntelligence.workspace;
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] lg:hidden" data-mi-drawer="">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-[rgba(1,6,15,0.66)]" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={w.railLabel}
        tabIndex={-1}
        className="absolute inset-y-0 left-0 flex w-[min(calc(100vw-48px),340px)] flex-col border-r border-[#0a2744] bg-[#020d1d] pt-[env(safe-area-inset-top)] outline-none"
      >
        <div className="flex items-center gap-2 border-b border-[#0a2744] px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7d92aa]">{w.workspaceLabel}</span>
            <span className="block truncate text-[16px] font-bold text-white">{getDictionary(language).myIntelligence.accountMenuItem}</span>
          </span>
          <button
            type="button"
            aria-label={w.closeMenu}
            onClick={onClose}
            className={`${MI_FOCUS} flex h-[44px] w-[44px] items-center justify-center rounded-[10px] text-[#cfe2f2]`}
          >
            <X aria-hidden="true" className="h-[20px] w-[20px]" />
          </button>
        </div>
        <WorkspaceNav {...props} onNavigated={onClose} />
      </div>
    </div>
  );
}

